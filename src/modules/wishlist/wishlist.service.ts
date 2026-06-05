import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { productInclude, toFrontendProduct } from '../products/products.mapper';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId, product: { deletedAt: null } },
      orderBy: { createdAt: 'desc' },
      include: { product: { include: productInclude } },
    });
    return {
      ids: items.map((i) => i.productId),
      products: items.map((i) => toFrontendProduct(i.product)),
    };
  }

  async add(userId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
    });
    return this.list(userId);
  }

  async remove(userId: string, productId: string) {
    await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
    return this.list(userId);
  }

  async toggle(userId: string, productId: string) {
    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    return existing ? this.remove(userId, productId) : this.add(userId, productId);
  }
}
