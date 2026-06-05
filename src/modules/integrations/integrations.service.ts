import { Injectable, NotFoundException } from '@nestjs/common';
import { Integration, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConnectIntegrationDto } from './dto/integration.dto';

const CATALOG = [
  { key: 'stripe', name: 'Stripe', category: 'Payments', description: 'Accept card payments.' },
  { key: 'cloudinary', name: 'Cloudinary', category: 'Media', description: 'Image hosting & optimization.' },
  { key: 'klaviyo', name: 'Klaviyo', category: 'Marketing', description: 'Email & SMS marketing.' },
  { key: 'mailchimp', name: 'Mailchimp', category: 'Marketing', description: 'Newsletter campaigns.' },
  { key: 'shippo', name: 'Shippo', category: 'Fulfilment', description: 'Shipping labels & tracking.' },
  { key: 'ga4', name: 'Google Analytics 4', category: 'Analytics', description: 'Web analytics.' },
  { key: 'meta-pixel', name: 'Meta Pixel', category: 'Analytics', description: 'Conversion tracking.' },
  { key: 'slack', name: 'Slack', category: 'Operations', description: 'Order & stock alerts.' },
];

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  private mask(integration: Integration) {
    const config = (integration.config as Record<string, unknown> | null) ?? null;
    const maskedConfig = config
      ? Object.fromEntries(Object.keys(config).map((k) => [k, '••••••']))
      : null;
    return { ...integration, config: maskedConfig };
  }

  async list() {
    // Ensure the catalog exists, then return current state.
    await this.prisma.$transaction(
      CATALOG.map((i) =>
        this.prisma.integration.upsert({
          where: { key: i.key },
          update: { name: i.name, category: i.category, description: i.description },
          create: i,
        }),
      ),
    );
    const integrations = await this.prisma.integration.findMany({ orderBy: { category: 'asc' } });
    return integrations.map((i) => this.mask(i));
  }

  async connect(key: string, dto: ConnectIntegrationDto) {
    const integration = await this.ensureExists(key);
    const updated = await this.prisma.integration.update({
      where: { id: integration.id },
      data: {
        connected: true,
        enabled: true,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
      },
    });
    return this.mask(updated);
  }

  async setEnabled(key: string, enabled: boolean) {
    const integration = await this.ensureExists(key);
    if (!integration.connected) {
      throw new NotFoundException('Integration must be connected before it can be enabled');
    }
    const updated = await this.prisma.integration.update({
      where: { id: integration.id },
      data: { enabled },
    });
    return this.mask(updated);
  }

  async disconnect(key: string) {
    const integration = await this.ensureExists(key);
    const updated = await this.prisma.integration.update({
      where: { id: integration.id },
      data: { connected: false, enabled: false, config: Prisma.JsonNull },
    });
    return this.mask(updated);
  }

  private async ensureExists(key: string): Promise<Integration> {
    const integration = await this.prisma.integration.findUnique({ where: { key } });
    if (!integration) throw new NotFoundException('Integration not found');
    return integration;
  }
}
