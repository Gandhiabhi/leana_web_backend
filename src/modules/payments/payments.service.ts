import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma, StockMovementReason } from '@prisma/client';
import Stripe from 'stripe';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from '../../integrations/stripe/stripe.service';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly orders: OrdersService,
  ) {}

  /** Verifies and processes a Stripe webhook event (idempotent). */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<{ received: boolean }> {
    let event: Stripe.Event;
    try {
      event = this.stripe.constructEvent(rawBody, signature);
    } catch (err) {
      this.logger.warn(`Stripe signature verification failed: ${(err as Error).message}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    // Idempotency guard: never process the same event twice.
    try {
      await this.prisma.stripeWebhookEvent.create({
        data: { eventId: event.id, type: event.type },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { received: true };
      }
      throw err;
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await this.orders.markPaidByPaymentIntent(intent.id);
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await this.orders.markFailedByPaymentIntent(
          intent.id,
          intent.last_payment_error?.message,
        );
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        if (typeof charge.payment_intent === 'string') {
          await this.syncRefundFromStripe(charge.payment_intent, charge.amount_refunded / 100);
        }
        break;
      }
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }

    return { received: true };
  }

  /** Admin-initiated refund. */
  async refundOrder(orderId: string, amount?: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, items: true },
    });
    if (!order || !order.payment) throw new NotFoundException('Order or payment not found');
    if (order.payment.status === PaymentStatus.REFUNDED) {
      throw new BadRequestException('Order already fully refunded');
    }
    if (!order.payment.stripePaymentIntentId) {
      throw new BadRequestException('This payment cannot be refunded via Stripe');
    }

    const refundAmount = amount ?? Number(order.payment.amount) - Number(order.payment.refundedAmount);
    if (refundAmount <= 0) throw new BadRequestException('Nothing left to refund');

    await this.stripe.refund({
      paymentIntentId: order.payment.stripePaymentIntentId,
      amount: refundAmount,
      idempotencyKey: `refund_${order.id}_${randomUUID()}`,
    });

    await this.applyRefund(orderId, refundAmount, order.items, order.orderNumber);
    return this.orders.getByIdAdmin(orderId);
  }

  private async syncRefundFromStripe(paymentIntentId: string, totalRefunded: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
      include: { order: { include: { items: true } } },
    });
    if (!payment) return;
    if (Number(payment.refundedAmount) >= totalRefunded) return; // already synced

    const delta = totalRefunded - Number(payment.refundedAmount);
    await this.applyRefund(payment.orderId, delta, payment.order.items, payment.order.orderNumber, totalRefunded);
  }

  private async applyRefund(
    orderId: string,
    deltaAmount: number,
    items: { productId: string | null; quantity: number }[],
    orderNumber: string,
    absoluteRefunded?: number,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { orderId } });
      const newRefunded = absoluteRefunded ?? Number(payment.refundedAmount) + deltaAmount;
      const fullyRefunded = newRefunded >= Number(payment.amount);

      await tx.payment.update({
        where: { orderId },
        data: {
          refundedAmount: newRefunded,
          status: fullyRefunded ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: fullyRefunded ? OrderStatus.REFUNDED : OrderStatus.PROCESSING,
          paymentStatus: fullyRefunded
            ? PaymentStatus.REFUNDED
            : PaymentStatus.PARTIALLY_REFUNDED,
          statusHistory: {
            create: {
              status: fullyRefunded ? OrderStatus.REFUNDED : OrderStatus.PROCESSING,
              note: `Refund of $${deltaAmount.toFixed(2)} processed`,
            },
          },
        },
      });

      // Restock on full refund.
      if (fullyRefunded) {
        for (const item of items) {
          if (!item.productId) continue;
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              change: item.quantity,
              reason: StockMovementReason.RETURN,
              reference: orderNumber,
            },
          });
        }
      }
    });
  }
}
