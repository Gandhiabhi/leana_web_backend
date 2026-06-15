import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
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
import { RazorpayService } from '../../integrations/razorpay/razorpay.service';
import { CartOwner, CartService, CartWithItems } from '../cart/cart.service';
import { CouponsService } from '../coupons/coupons.service';
import { CheckoutDto, CheckoutPaymentMethod } from './dto/checkout.dto';
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
    private readonly razorpay: RazorpayService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  // ── Checkout ──

  async checkout(owner: CartOwner, dto: CheckoutDto) {
    if (!owner.userId) {
      throw new UnauthorizedException('You must be signed in to place an order');
    }

    const ownerWithSession: CartOwner = { userId: owner.userId, sessionId: dto.sessionId ?? owner.sessionId };

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
    const currency = this.razorpay.currency || 'INR';
    const paymentMethod = dto.paymentMethod ?? CheckoutPaymentMethod.COD;

    const normalizedAddress = {
      ...dto.shippingAddress,
      country: 'IN',
      phone: dto.shippingAddress.phone.replace(/\s+/g, ''),
    };

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
        currency,
        couponId,
        couponCode,
        shippingAddress: normalizedAddress as unknown as Prisma.InputJsonValue,
        billingAddress: (dto.billingAddress ?? normalizedAddress) as unknown as Prisma.InputJsonValue,
        notes: dto.notes,
        items: { create: lineItems },
        statusHistory: { create: { status: OrderStatus.PENDING, note: 'Order created' } },
      },
      include: orderInclude,
    });

    await this.saveShippingAddressForUser(owner.userId, normalizedAddress);

    if (paymentMethod === CheckoutPaymentMethod.COD) {
      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          provider: 'cod',
          amount: total,
          currency,
          status: PaymentStatus.REQUIRES_PAYMENT,
        },
      });
      await this.confirmCodOrder(order.id);
      await this.cart.clear(ownerWithSession);
      const fresh = await this.prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderInclude,
      });
      return { order: toFrontendOrder(fresh), paymentMethod: 'cod' as const };
    }

    if (
      paymentMethod === CheckoutPaymentMethod.RAZORPAY ||
      paymentMethod === CheckoutPaymentMethod.UPI
    ) {
      if (this.razorpay.enabled) {
        const rzOrder = await this.razorpay.createOrder(total, orderNumber);
        await this.prisma.payment.create({
          data: {
            orderId: order.id,
            provider: 'razorpay',
            amount: total,
            currency,
            status: PaymentStatus.REQUIRES_PAYMENT,
            metadata: {
              razorpayOrderId: rzOrder.id,
              method: paymentMethod,
            } as Prisma.InputJsonValue,
          },
        });
        const fresh = await this.prisma.order.findUniqueOrThrow({
          where: { id: order.id },
          include: orderInclude,
        });
        return {
          order: toFrontendOrder(fresh),
          paymentMethod,
          razorpayOrderId: rzOrder.id,
          razorpayKeyId: this.razorpay.keyId,
          amount: total,
          currency,
        };
      }

      throw new BadRequestException(
        'Online payment is not configured. Choose Cash on Delivery or add Razorpay keys.',
      );
    }

    // Legacy Stripe fallback (unused by Indian checkout UI)
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

  async verifyRazorpayPayment(
    orderId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    owner: CartOwner,
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, provider: 'razorpay' },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const meta = payment.metadata as { razorpayOrderId?: string } | null;
    if (meta?.razorpayOrderId !== razorpayOrderId) {
      throw new BadRequestException('Payment order mismatch');
    }

    const valid = this.razorpay.verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );
    if (!valid) throw new BadRequestException('Invalid payment signature');

    if (payment.order.status === OrderStatus.PENDING) {
      const checkoutMethod = (meta as { method?: string } | null)?.method;
      const paymentDetails = await this.razorpay.fetchPaymentDetails(razorpayPaymentId);
      const resolvedMethod = paymentDetails?.method ?? checkoutMethod ?? 'razorpay';

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
          metadata: {
            ...(meta ?? {}),
            razorpayPaymentId,
            paymentMethod: resolvedMethod,
            vpa: paymentDetails?.vpa,
            bank: paymentDetails?.bank,
            wallet: paymentDetails?.wallet,
            cardLast4: paymentDetails?.card?.last4,
            cardNetwork: paymentDetails?.card?.network,
            payerEmail: paymentDetails?.email,
            payerContact: paymentDetails?.contact,
          } as Prisma.InputJsonValue,
        },
      });
      await this.fulfillOrder(orderId);
      if (payment.order.userId && payment.order.shippingAddress) {
        await this.saveShippingAddressForUser(
          payment.order.userId,
          payment.order.shippingAddress as {
            firstName: string;
            lastName: string;
            line1: string;
            line2?: string;
            city: string;
            state?: string;
            postalCode: string;
            country: string;
            phone?: string;
          },
        );
      }
      await this.cart.clear(owner);
    }

    const fresh = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: orderInclude,
    });
    return { order: toFrontendOrder(fresh) };
  }

  /** COD: confirm order without marking as paid — payment collected on delivery. */
  async confirmCodOrder(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.status !== OrderStatus.PENDING) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PROCESSING,
          paymentStatus: PaymentStatus.REQUIRES_PAYMENT,
          placedAt: new Date(),
          statusHistory: {
            create: { status: OrderStatus.PROCESSING, note: 'Order confirmed — cash on delivery' },
          },
        },
      });
      await this.decrementStockAndNotify(tx, order);
    });
  }

  private async saveShippingAddressForUser(
    userId: string | undefined,
    addr: {
      firstName: string;
      lastName: string;
      line1: string;
      line2?: string;
      city: string;
      state?: string;
      postalCode: string;
      country: string;
      phone?: string;
    },
  ): Promise<void> {
    if (!userId) return;
    const existing = await this.prisma.address.findFirst({
      where: {
        userId,
        line1: addr.line1,
        postalCode: addr.postalCode,
        city: addr.city,
      },
    });
    if (existing) return;
    const count = await this.prisma.address.count({ where: { userId } });
    await this.prisma.address.create({
      data: {
        userId,
        type: 'SHIPPING',
        label: 'Checkout',
        firstName: addr.firstName,
        lastName: addr.lastName,
        line1: addr.line1,
        line2: addr.line2,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        country: addr.country,
        phone: addr.phone,
        isDefault: count === 0,
      },
    });
  }

  private async decrementStockAndNotify(
    tx: Prisma.TransactionClient,
    order: { id: string; orderNumber: string; couponId: string | null; items: { productId: string | null; quantity: number }[] },
  ): Promise<void> {
    for (const item of order.items) {
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
          reference: order.orderNumber,
        },
      });
    }
    if (order.couponId) {
      await tx.coupon.update({
        where: { id: order.couponId },
        data: { usedCount: { increment: 1 } },
      });
    }
    await tx.notification.create({
      data: {
        type: 'ORDER',
        title: 'New order received',
        body: `Order ${order.orderNumber} placed`,
        data: { orderId: order.id } as Prisma.InputJsonValue,
      },
    });
  }

  /** Marks order paid (online payment), decrements stock, increments coupon usage. */
  async fulfillOrder(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.status !== OrderStatus.PENDING) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PROCESSING,
          paymentStatus: PaymentStatus.SUCCEEDED,
          placedAt: new Date(),
          statusHistory: {
            create: { status: OrderStatus.PROCESSING, note: 'Payment received — order processing' },
          },
        },
      });
      await this.decrementStockAndNotify(tx, order);
    });
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
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.SUCCEEDED },
    });
    await this.fulfillOrder(payment.orderId);

    if (payment.order.userId) {
      await this.cart.clear({ userId: payment.order.userId });
    }
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
        this.prisma.order.count({
          where: { status: { in: [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.CONFIRMED] } },
        }),
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
