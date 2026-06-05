import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  StockMovementReason,
} from '@prisma/client';
import { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { StripeService } from '../../integrations/stripe/stripe.service';
import { CartOwner, CartService, CartWithItems } from '../cart/cart.service';
import { CouponsService } from '../coupons/coupons.service';
import { CheckoutDto } from './dto/checkout.dto';
import { QueryOrderDto } from './dto/order-admin.dto';
import { orderInclude, toFrontendOrder } from './orders.mapper';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly coupons: CouponsService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  // ── Checkout ──

  async checkout(owner: CartOwner, dto: CheckoutDto) {
    const ownerWithSession: CartOwner = owner.userId
      ? owner
      : { sessionId: dto.sessionId ?? owner.sessionId };

    const cart = await this.cart.getCartEntity(ownerWithSession);
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    this.assertStockAvailable(cart);

    const lineItems = cart.items.map((item) => {
      const unitPrice =
        item.variant?.price != null ? Number(item.variant.price) : Number(item.product.price);
      return {
        productId: item.productId,
        variantId: item.variantId ?? undefined,
        name: item.product.name,
        sku: item.variant?.sku ?? item.product.sku ?? undefined,
        image: item.product.image ?? undefined,
        unitPrice,
        quantity: item.quantity,
        lineTotal: Number((unitPrice * item.quantity).toFixed(2)),
      };
    });

    const subtotal = Number(lineItems.reduce((s, l) => s + l.lineTotal, 0).toFixed(2));

    let discount = 0;
    let couponId: string | undefined;
    let couponCode: string | undefined;
    if (dto.couponCode) {
      const evaluation = await this.coupons.evaluate(dto.couponCode, subtotal, owner.userId);
      discount = evaluation.discount;
      couponId = evaluation.coupon.id;
      couponCode = evaluation.coupon.code;
    }

    const commerce = this.config.get('commerce', { infer: true });
    const discountedSubtotal = subtotal - discount;
    const shipping =
      discountedSubtotal <= 0 || discountedSubtotal >= commerce.freeShippingThreshold
        ? 0
        : commerce.defaultShippingFee;
    const tax = Number(((discountedSubtotal * commerce.taxRate) / 100).toFixed(2));
    const total = Number((discountedSubtotal + shipping + tax).toFixed(2));

    const orderNumber = await this.generateOrderNumber();
    const customerName = `${dto.shippingAddress.firstName} ${dto.shippingAddress.lastName}`.trim();

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        userId: owner.userId,
        email: dto.email.toLowerCase(),
        customerName,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.REQUIRES_PAYMENT,
        subtotal,
        discountTotal: discount,
        shippingTotal: shipping,
        taxTotal: tax,
        total,
        currency: this.stripe.currency,
        couponId,
        couponCode,
        shippingAddress: dto.shippingAddress as unknown as Prisma.InputJsonValue,
        billingAddress: (dto.billingAddress ?? dto.shippingAddress) as unknown as Prisma.InputJsonValue,
        notes: dto.notes,
        items: { create: lineItems },
        statusHistory: { create: { status: OrderStatus.PENDING, note: 'Order created' } },
      },
      include: orderInclude,
    });

    // Create the payment record + Stripe PaymentIntent (idempotent on order id).
    let clientSecret: string | undefined;
    if (this.stripe.enabled) {
      const intent = await this.stripe.createPaymentIntent({
        amount: total,
        metadata: { orderId: order.id, orderNumber },
        idempotencyKey: `order_${order.id}`,
        receiptEmail: dto.email,
      });
      clientSecret = intent.client_secret ?? undefined;
      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          provider: 'stripe',
          stripePaymentIntentId: intent.id,
          stripeClientSecret: clientSecret,
          idempotencyKey: `order_${order.id}`,
          amount: total,
          currency: this.stripe.currency,
          status: PaymentStatus.REQUIRES_PAYMENT,
        },
      });
    } else {
      // Dev/manual mode: no Stripe configured.
      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          provider: 'manual',
          amount: total,
          currency: this.stripe.currency,
          status: PaymentStatus.REQUIRES_PAYMENT,
        },
      });
    }

    const fresh = await this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude,
    });
    return { order: toFrontendOrder(fresh), clientSecret };
  }

  // ── Payment lifecycle (called by PaymentsService webhook handler) ──

  async markPaidByPaymentIntent(paymentIntentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
      include: { order: { include: { items: true } } },
    });
    if (!payment) {
      this.logger.warn(`No payment found for intent ${paymentIntentId}`);
      return;
    }
    if (payment.order.status !== OrderStatus.PENDING) {
      // Already processed — idempotent no-op.
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.SUCCEEDED },
      });
      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          status: OrderStatus.PAID,
          paymentStatus: PaymentStatus.SUCCEEDED,
          placedAt: new Date(),
          statusHistory: { create: { status: OrderStatus.PAID, note: 'Payment received' } },
        },
      });

      // Decrement stock and record movements.
      for (const item of payment.order.items) {
        if (!item.productId) continue;
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            change: -item.quantity,
            reason: StockMovementReason.PURCHASE,
            reference: payment.order.orderNumber,
          },
        });
      }

      if (payment.order.couponId) {
        await tx.coupon.update({
          where: { id: payment.order.couponId },
          data: { usedCount: { increment: 1 } },
        });
      }

      // Clear the buyer's cart.
      if (payment.order.userId) {
        const cart = await tx.cart.findUnique({ where: { userId: payment.order.userId } });
        if (cart) await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      }

      await tx.notification.create({
        data: {
          type: 'ORDER',
          title: 'New order received',
          body: `Order ${payment.order.orderNumber} for $${Number(payment.order.total)}`,
          data: { orderId: payment.orderId } as Prisma.InputJsonValue,
        },
      });
    });
  }

  async markFailedByPaymentIntent(paymentIntentId: string, reason?: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    if (!payment) return;
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED, failureReason: reason },
    });
    await this.prisma.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: PaymentStatus.FAILED },
    });
  }

  // ── Customer queries ──

  async listForUser(userId: string, query: PaginationQueryDto) {
    const where: Prisma.OrderWhereInput = { userId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(data.map(toFrontendOrder), total, query.page, query.limit);
  }

  async getForUser(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return toFrontendOrder(order);
  }

  // ── Admin ──

  async findAllAdmin(query: QueryOrderDto) {
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { orderNumber: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { customerName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(data.map(toFrontendOrder), total, query.page, query.limit);
  }

  async getByIdAdmin(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new NotFoundException('Order not found');
    return toFrontendOrder(order);
  }

  async updateStatus(id: string, status: OrderStatus, note: string | undefined, actorId?: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.REFUNDED) {
      throw new ForbiddenException('Refunded orders cannot change status');
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status,
        statusHistory: { create: { status, note, changedById: actorId } },
      },
      include: orderInclude,
    });
    return toFrontendOrder(updated);
  }

  async metrics() {
    const [open, shipped, delivered, refunded, totalOrders, revenue] =
      await this.prisma.$transaction([
        this.prisma.order.count({ where: { status: { in: [OrderStatus.PAID, OrderStatus.PROCESSING] } } }),
        this.prisma.order.count({ where: { status: OrderStatus.SHIPPED } }),
        this.prisma.order.count({ where: { status: OrderStatus.DELIVERED } }),
        this.prisma.order.count({ where: { status: OrderStatus.REFUNDED } }),
        this.prisma.order.count({ where: { status: { not: OrderStatus.PENDING } } }),
        this.prisma.order.aggregate({
          where: { status: { notIn: [OrderStatus.PENDING, OrderStatus.CANCELLED] } },
          _sum: { total: true },
        }),
      ]);

    const totalRevenue = Number(revenue._sum.total ?? 0);
    return {
      open,
      shipped,
      delivered,
      refunded,
      totalOrders,
      totalRevenue,
      refundRate: totalOrders > 0 ? Number(((refunded / totalOrders) * 100).toFixed(1)) : 0,
      averageOrderValue: totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0,
    };
  }

  // ── helpers ──

  private assertStockAvailable(cart: CartWithItems): void {
    for (const item of cart.items) {
      if (item.product.deletedAt) {
        throw new BadRequestException(`"${item.product.name}" is no longer available`);
      }
      if (item.product.trackStock && item.quantity > item.product.stock) {
        throw new BadRequestException(
          `Only ${item.product.stock} of "${item.product.name}" remaining`,
        );
      }
    }
  }

  private async generateOrderNumber(): Promise<string> {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const candidate = `LP-${Math.floor(10000 + Math.random() * 90000)}`;
      const exists = await this.prisma.order.findUnique({ where: { orderNumber: candidate } });
      if (!exists) return candidate;
    }
    return `LP-${Date.now().toString().slice(-8)}`;
  }
}
