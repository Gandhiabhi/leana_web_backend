import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { AppConfig } from '../../config/configuration';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter?: Transporter;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const mail = this.config.get('mail', { infer: true });
    this.from = mail.from;
    this.frontendUrl = this.config.get('frontendUrl', { infer: true });

    if (mail.host && mail.user) {
      this.transporter = nodemailer.createTransport({
        host: mail.host,
        port: mail.port,
        secure: mail.port === 465,
        auth: { user: mail.user, pass: mail.password },
      });
    } else {
      this.logger.warn('SMTP is not configured — emails will be logged instead of sent');
    }
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.debug(`[MAIL:dev] To=${to} | Subject="${subject}"\n${html}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, html });
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}/verify-email?token=${token}`;
    await this.send(
      to,
      'Verify your Leana Professional account',
      `<p>Welcome to Leana Professional.</p>
       <p>Please confirm your email by clicking the link below:</p>
       <p><a href="${link}">Verify my email</a></p>
       <p>This link expires in 24 hours.</p>`,
    );
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}/reset-password?token=${token}`;
    await this.send(
      to,
      'Reset your Leana Professional password',
      `<p>We received a request to reset your password.</p>
       <p><a href="${link}">Choose a new password</a></p>
       <p>If you did not request this, you can safely ignore this email.</p>
       <p>This link expires in 1 hour.</p>`,
    );
  }
}
