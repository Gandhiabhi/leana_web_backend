import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { UpdateNotificationPreferencesDto } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Emits a notification (broadcast when userId is omitted). */
  async emit(params: {
    type: NotificationType;
    title: string;
    body: string;
    userId?: string;
    data?: Prisma.InputJsonValue;
  }) {
    return this.prisma.notification.create({
      data: {
        type: params.type,
        title: params.title,
        body: params.body,
        userId: params.userId,
        data: params.data,
      },
    });
  }

  async list(userId: string, query: PaginationQueryDto, unreadOnly?: boolean) {
    const where: Prisma.NotificationWhereInput = {
      OR: [{ userId }, { userId: null }],
      ...(unreadOnly ? { read: false } : {}),
    };
    const [data, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { OR: [{ userId }, { userId: null }], read: false } }),
    ]);
    return { ...paginate(data, total, query.page, query.limit), unreadCount: unread };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, OR: [{ userId }, { userId: null }] },
      data: { read: true },
    });
    return { id, read: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { OR: [{ userId }, { userId: null }], read: false },
      data: { read: true },
    });
    return { success: true };
  }

  async getPreferences(userId: string) {
    const prefs = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    return (
      prefs ?? {
        userId,
        orders: true,
        stock: true,
        reviews: true,
        marketing: false,
        weekly: true,
      }
    );
  }

  async updatePreferences(userId: string, dto: UpdateNotificationPreferencesDto) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }
}
