import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { AppConfig } from '../../config/configuration';

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
}

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  readonly enabled: boolean;
  readonly keyId: string;
  readonly currency: string;
  private readonly keySecret: string;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const cfg = this.config.get('razorpay', { infer: true });
    this.keyId = cfg.keyId;
    this.keySecret = cfg.keySecret;
    this.currency = cfg.currency;
    this.enabled = Boolean(cfg.keyId && cfg.keySecret);
    if (!this.enabled) {
      this.logger.warn('Razorpay is not configured — online payments disabled');
    }
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;
  }

  async createOrder(amountInRupees: number, receipt: string): Promise<RazorpayOrderResult> {
    if (!this.enabled) {
      throw new InternalServerErrorException('Razorpay is not configured');
    }
    const amount = Math.round(amountInRupees * 100);
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency: this.currency.toUpperCase(),
        receipt,
        payment_capture: 1,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Razorpay order failed: ${err}`);
      throw new InternalServerErrorException('Could not start Razorpay payment');
    }
    const json = (await res.json()) as { id: string; amount: number; currency: string };
    return { id: json.id, amount: json.amount, currency: json.currency };
  }

  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    if (!this.enabled) return false;
    const expected = createHmac('sha256', this.keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    return expected === signature;
  }

  async fetchPaymentDetails(paymentId: string): Promise<{
    method?: string;
    bank?: string;
    vpa?: string;
    wallet?: string;
    card?: { last4?: string; network?: string; type?: string };
    email?: string;
    contact?: string;
  } | null> {
    if (!this.enabled) return null;
    try {
      const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
        headers: { Authorization: this.authHeader() },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        method?: string;
        bank?: string;
        vpa?: string;
        wallet?: string;
        email?: string;
        contact?: string;
        card?: { last4?: string; network?: string; type?: string };
      };
      return {
        method: json.method,
        bank: json.bank,
        vpa: json.vpa,
        wallet: json.wallet,
        email: json.email,
        contact: json.contact,
        card: json.card,
      };
    } catch (err) {
      this.logger.warn(`Could not fetch Razorpay payment ${paymentId}: ${(err as Error).message}`);
      return null;
    }
  }
}
