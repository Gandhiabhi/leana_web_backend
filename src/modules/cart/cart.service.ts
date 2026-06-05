import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { productInclude, toFrontendProduct } from '../products/products.mapper';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';

const cartInclude = {
  items: {
    orderBy: { createdAt: 'asc' },
    include: { product: { include: productInclude }, variant: true },
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

export interface CartOwner {
  userId?: string;
  sessionId?: string;
}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(owner: CartOwner) {
    const cart = await this.resolveCart(owner, false);
    return cart ? this.serialize(cart) : this.emptyCart();
  }

  /** Raw cart entity with items + product relations (used by checkout). */
  async getCartEntity(owner: CartOwner): Promise<CartWithItems | null> {
    return this.resolveCart(owner, false);
  }

  async clearByCartId(cartId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({ where: { cartId } });
  }

  async addItem(owner: CartOwner, dto: AddCartItemDto) {
    const cart = await this.resolveCart(owner, true);
    const quantity = dto.quantity ?? 1;

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null },
      select: { id: true, stock: true, trackStock: true, name: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId: dto.productId, variantId: dto.variantId ?? null },
    });
    const desiredQty = (existing?.quantity ?? 0) + quantity;

    if (product.trackStock && desiredQty > product.stock) {
      throw new BadRequestException(`Only ${product.stock} of "${product.name}" in stock`);
    }

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: desiredQty },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: dto.productId,
          variantId: dto.variantId,
          quantity,
        },
      });
    }
    return this.getCart(owner);
  }

  async updateItem(owner: CartOwner, itemId: string, dto: UpdateCartItemDto) {
    const cart = await this.resolveCart(owner, false);
    if (!cart) throw new NotFoundException('Cart not found');

    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Cart item not found');

    if (item.product.trackStock && dto.quantity > item.product.stock) {
      throw new BadRequestException(`Only ${item.product.stock} in stock`);
    }

    await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity: dto.quantity } });
    return this.getCart(owner);
  }

  async removeItem(owner: CartOwner, itemId: string) {
    const cart = await this.resolveCart(owner, false);
    if (!cart) throw new NotFoundException('Cart not found');
    await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
    return this.getCart(owner);
  }

  async clear(owner: CartOwner) {
    const cart = await this.resolveCart(owner, false);
    if (cart) await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.emptyCart();
  }

  /** Merges a guest cart (by sessionId) into the authenticated user's cart. */
  async merge(userId: string, sessionId: string) {
    const guestCart = await this.prisma.cart.findUnique({
      where: { sessionId },
      include: cartInclude,
    });
    if (!guestCart || guestCart.items.length === 0) {
      return this.getCart({ userId });
    }

    const userCart = await this.resolveCart({ userId }, true);

    await this.prisma.$transaction(async (tx) => {
      for (const item of guestCart.items) {
        const existing = await tx.cartItem.findFirst({
          where: { cartId: userCart.id, productId: item.productId, variantId: item.variantId },
        });
        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + item.quantity },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: userCart.id,
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
            },
          });
        }
      }
      await tx.cart.delete({ where: { id: guestCart.id } });
    });

    return this.getCart({ userId });
  }

  // ── helpers ──

  private async resolveCart(owner: CartOwner, create: true): Promise<CartWithItems>;
  private async resolveCart(owner: CartOwner, create: false): Promise<CartWithItems | null>;
  private async resolveCart(owner: CartOwner, create: boolean): Promise<CartWithItems | null> {
    if (!owner.userId && !owner.sessionId) {
      throw new BadRequestException('A user session or guest cart id is required');
    }

    const where: Prisma.CartWhereInput = owner.userId
      ? { userId: owner.userId }
      : { sessionId: owner.sessionId };

    let cart = await this.prisma.cart.findFirst({ where, include: cartInclude });
    if (!cart && create) {
      cart = await this.prisma.cart.create({
        data: owner.userId ? { userId: owner.userId } : { sessionId: owner.sessionId },
        include: cartInclude,
      });
    }
    return cart;
  }

  private serialize(cart: CartWithItems) {
    const lines = cart.items.map((item) => {
      const unitPrice = item.variant?.price != null ? Number(item.variant.price) : Number(item.product.price);
      return {
        id: item.id,
        quantity: item.quantity,
        variantId: item.variantId ?? undefined,
        unitPrice,
        lineTotal: Number((unitPrice * item.quantity).toFixed(2)),
        product: toFrontendProduct(item.product),
      };
    });
    const subtotal = Number(lines.reduce((sum, l) => sum + l.lineTotal, 0).toFixed(2));
    const count = lines.reduce((sum, l) => sum + l.quantity, 0);
    return { id: cart.id, lines, subtotal, count };
  }

  private emptyCart() {
    return { id: null, lines: [], subtotal: 0, count: 0 };
  }
}
