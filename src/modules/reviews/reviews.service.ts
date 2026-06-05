import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/utils/pagination.util';
import { ProductsService } from '../products/products.service';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { CreateReviewDto, QueryReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
  ) {}

  /** Public: approved reviews for a product. */
  async listForProduct(productId: string, query: QueryReviewDto) {
    const where: Prisma.ReviewWhereInput = { productId, status: ReviewStatus.APPROVED };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async create(user: AuthenticatedUser | undefined, dto: CreateReviewDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    let authorName = dto.authorName?.trim();
    let verified = false;

    if (user) {
      const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
      authorName =
        [dbUser?.firstName, dbUser?.lastName].filter(Boolean).join(' ') || dbUser?.email || 'Customer';

      // Verified purchase check.
      const purchased = await this.prisma.orderItem.findFirst({
        where: {
          productId: dto.productId,
          order: { userId: user.id, status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
        },
      });
      verified = Boolean(purchased);
    }

    if (!authorName) {
      throw new BadRequestException('authorName is required for anonymous reviews');
    }

    return this.prisma.review.create({
      data: {
        productId: dto.productId,
        userId: user?.id,
        authorName,
        rating: dto.rating,
        title: dto.title,
        body: dto.body,
        verified,
        status: ReviewStatus.PENDING,
      },
    });
  }

  // ── Admin ──

  async findAllAdmin(query: QueryReviewDto) {
    const where: Prisma.ReviewWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { name: true, slug: true } } },
      }),
      this.prisma.review.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async updateStatus(id: string, status: ReviewStatus) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');

    const updated = await this.prisma.review.update({ where: { id }, data: { status } });
    await this.products.recalculateRating(review.productId);
    return updated;
  }

  async flag(id: string, flagged = true) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    return this.prisma.review.update({ where: { id }, data: { flagged } });
  }

  async remove(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    await this.prisma.review.delete({ where: { id } });
    await this.products.recalculateRating(review.productId);
    return { id, deleted: true };
  }

  async metrics() {
    const [total, pending, approved, rejected, flagged, avg] = await this.prisma.$transaction([
      this.prisma.review.count(),
      this.prisma.review.count({ where: { status: ReviewStatus.PENDING } }),
      this.prisma.review.count({ where: { status: ReviewStatus.APPROVED } }),
      this.prisma.review.count({ where: { status: ReviewStatus.REJECTED } }),
      this.prisma.review.count({ where: { flagged: true } }),
      this.prisma.review.aggregate({ where: { status: ReviewStatus.APPROVED }, _avg: { rating: true } }),
    ]);
    return {
      total,
      pending,
      approved,
      rejected,
      flagged,
      averageRating: Number((avg._avg.rating ?? 0).toFixed(2)),
    };
  }
}
