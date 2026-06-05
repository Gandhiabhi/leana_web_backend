import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type SettingValue = Record<string, unknown>;

const DEFAULTS: Record<string, SettingValue> = {
  general: { name: 'Leana Professional', email: 'studio@leana.com', currency: 'USD', bio: '' },
  branding: { logoUrl: '', brandColor: '#0d0d0d', voiceKeywords: [] },
  checkout: { preOrders: false, loyalty: true, giftWrapping: false, abandonedRecovery: true },
};

const PUBLIC_GROUPS = ['general', 'branding'];

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getGroup(group: string): Promise<SettingValue> {
    const setting = await this.prisma.setting.findUnique({ where: { key: group } });
    return { ...(DEFAULTS[group] ?? {}), ...((setting?.value as SettingValue) ?? {}) };
  }

  async getPublic(): Promise<Record<string, SettingValue>> {
    const result: Record<string, SettingValue> = {};
    for (const group of PUBLIC_GROUPS) {
      result[group] = await this.getGroup(group);
    }
    return result;
  }

  async setGroup(group: string, value: SettingValue): Promise<SettingValue> {
    const merged = { ...(await this.getGroup(group)), ...value };
    await this.prisma.setting.upsert({
      where: { key: group },
      update: { value: merged as Prisma.InputJsonValue, group },
      create: { key: group, group, value: merged as Prisma.InputJsonValue },
    });
    return merged;
  }
}
