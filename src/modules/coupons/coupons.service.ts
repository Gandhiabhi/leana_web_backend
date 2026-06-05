import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Coupon, CouponType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto';

export interface CouponEvaluation {
  coupon: Coupon;
  discount: number;
}

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates a coupon against an order subtotal and (optionally) a user's
   * redemption history. Returns the computed discount. Throws on any failure.
   */
  async evaluate(code: string, subtotal: number, userId?: string): Promise<CouponEvaluation> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
    });

    if (!coupon || !coupon.active) {
      throw new BadRequestException('Invalid coupon code');
    }

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException('This coupon is not active yet');
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BadRequestException('This coupon has expired');
    }
    if (Number(coupon.minOrder) > subtotal) {
      throw new BadRequestException(`Minimum order of $${Number(coupon.minOrder)} required`);
    }
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }
    if (coupon.perUserLimit != null && userId) {
      const used = await this.prisma.order.count({
        where: { userId, couponId: coupon.id, status: { not: 'CANCELLED' } },
      });
      if (used >= coupon.perUserLimit) {
        throw new BadRequestException('You have already used this coupon');
      }
    }

    const discount =
      coupon.type === CouponType.PERCENT
        ? (subtotal * Number(coupon.value)) / 100
        : Number(coupon.value);

    return { coupon, discount: Math.min(Number(discount.toFixed(2)), subtotal) };
  }

  async validate(code: string, subtotal: number, userId?: string) {
    const { coupon, discount } = await this.evaluate(code, subtotal, userId);
    return {
      valid: true,
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
      discount,
      total: Number((subtotal - discount).toFixed(2)),
    };
  }

  // ── Admin ──

  async findAll(query: PaginationQueryDto) {
    const where: Prisma.CouponWhereInput = query.search
      ? { code: { contains: query.search, mode: 'insensitive' } }
      : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.coupon.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.coupon.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async create(dto: CreateCouponDto) {
    return this.prisma.coupon.create({
      data: {
        ...dto,
        code: dto.code.trim().toUpperCase(),
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateCouponDto) {
    await this.ensureExists(id);
    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.startsAt ? { startsAt: new Date(dto.startsAt) } : {}),
        ...(dto.expiresAt ? { expiresAt: new Date(dto.expiresAt) } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.coupon.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.coupon.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Coupon not found');
  }
}
