import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { AppConfig } from '../../config/configuration';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly client?: Stripe;
  private readonly webhookSecret: string;
  readonly currency: string;
  readonly enabled: boolean;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const stripe = this.config.get('stripe', { infer: true });
    this.webhookSecret = stripe.webhookSecret;
    this.currency = stripe.currency;
    this.enabled = Boolean(stripe.secretKey);

    if (this.enabled) {
      this.client = new Stripe(stripe.secretKey);
    } else {
      this.logger.warn('Stripe secret key not configured — payment endpoints are disabled');
    }
  }

  private get stripe(): Stripe {
    if (!this.client) {
      throw new InternalServerErrorException('Stripe is not configured');
    }
    return this.client;
  }

  /** Stripe works in the smallest currency unit (cents). */
  private toMinorUnits(amount: number): number {
    return Math.round(amount * 100);
  }

  async createPaymentIntent(params: {
    amount: number;
    metadata: Record<string, string>;
    idempotencyKey: string;
    receiptEmail?: string;
  }): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create(
      {
        amount: this.toMinorUnits(params.amount),
        currency: this.currency,
        metadata: params.metadata,
        receipt_email: params.receiptEmail,
        automatic_payment_methods: { enabled: true },
      },
      { idempotencyKey: params.idempotencyKey },
    );
  }

  async retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.retrieve(id);
  }

  async refund(params: {
    paymentIntentId: string;
    amount?: number;
    idempotencyKey: string;
  }): Promise<Stripe.Refund> {
    return this.stripe.refunds.create(
      {
        payment_intent: params.paymentIntentId,
        ...(params.amount != null ? { amount: this.toMinorUnits(params.amount) } : {}),
      },
      { idempotencyKey: params.idempotencyKey },
    );
  }

  /** Verifies the Stripe-Signature header against the raw request body. */
  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    if (!this.webhookSecret) {
      throw new InternalServerErrorException('Stripe webhook secret not configured');
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
  }
}
