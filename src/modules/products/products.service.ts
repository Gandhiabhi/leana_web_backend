import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { paginate } from '../../common/utils/pagination.util';
import { uniqueSlug } from '../../common/utils/slug.util';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { ProductSort, QueryProductDto } from './dto/query-product.dto';
import {
  FrontendProduct,
  productInclude,
  ProductWithRelations,
  toFrontendProduct,
} from './products.mapper';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Storefront ──

  async findAll(query: QueryProductDto): Promise<PaginatedResult<FrontendProduct>> {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      status: ProductStatus.ACTIVE,
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.collection ? { collection: { slug: query.collection } } : {}),
      ...(query.badge ? { badge: query.badge } : {}),
      ...(query.featured === 'true' ? { featured: true } : {}),
      ...(query.minPrice != null || query.maxPrice != null
        ? {
            price: {
              ...(query.minPrice != null ? { gte: query.minPrice } : {}),
              ...(query.maxPrice != null ? { lte: query.maxPrice } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { tagline: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { ingredients: { has: query.search } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: this.buildOrderBy(query.sort),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginate(items.map(toFrontendProduct), total, query.page, query.limit);
  }

  async findBySlug(slug: string): Promise<FrontendProduct> {
    const product = await this.prisma.product.findFirst({
      where: { slug, deletedAt: null, status: ProductStatus.ACTIVE },
      include: productInclude,
    });
    if (!product) throw new NotFoundException('Product not found');
    return toFrontendProduct(product);
  }

  async findRelated(slug: string, limit = 3): Promise<FrontendProduct[]> {
    const product = await this.prisma.product.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true, categoryId: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const related = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        status: ProductStatus.ACTIVE,
        id: { not: product.id },
        ...(product.categoryId ? { categoryId: product.categoryId } : {}),
      },
      include: productInclude,
      take: limit,
      orderBy: { reviewsCount: 'desc' },
    });
    return related.map(toFrontendProduct);
  }

  // ── Admin ──

  async findAllAdmin(query: QueryProductDto): Promise<PaginatedResult<FrontendProduct>> {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(query.badge ? { badge: query.badge } : {}),
      ...(query.featured === 'true' ? { featured: true } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: this.buildOrderBy(query.sort),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginate(items.map(toFrontendProduct), total, query.page, query.limit);
  }

  async findByIdAdmin(id: string): Promise<FrontendProduct> {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: productInclude,
    });
    if (!product) throw new NotFoundException('Product not found');
    return toFrontendProduct(product);
  }

  async create(dto: CreateProductDto): Promise<FrontendProduct> {
    const slug = await uniqueSlug(dto.slug || dto.name, (s) =>
      this.prisma.product.findUnique({ where: { slug: s } }).then(Boolean),
    );

    const { images, ...rest } = dto;
    const product = await this.prisma.product.create({
      data: {
        ...rest,
        slug,
        image: dto.image ?? images?.[0]?.url,
        ...(images && images.length
          ? { images: { create: images.map((img, i) => ({ ...img, position: i })) } }
          : {}),
      },
      include: productInclude,
    });
    return toFrontendProduct(product);
  }

  async update(id: string, dto: UpdateProductDto): Promise<FrontendProduct> {
    await this.ensureExists(id);
    const { images, ...rest } = dto;

    const product = await this.prisma.$transaction(async (tx) => {
      if (images) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        if (images.length) {
          await tx.productImage.createMany({
            data: images.map((img, i) => ({ ...img, productId: id, position: i })),
          });
        }
      }
      return tx.product.update({
        where: { id },
        data: { ...rest, ...(images?.length ? { image: rest.image ?? images[0].url } : {}) },
        include: productInclude,
      });
    });
    return toFrontendProduct(product);
  }

  async toggleFeatured(id: string): Promise<FrontendProduct> {
    const product = await this.ensureExists(id);
    const updated = await this.prisma.product.update({
      where: { id },
      data: { featured: !product.featured },
      include: productInclude,
    });
    return toFrontendProduct(updated);
  }

  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    await this.ensureExists(id);
    await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }

  /** Recomputes rating aggregate from approved reviews. Called by ReviewsService. */
  async recalculateRating(productId: string): Promise<void> {
    const agg = await this.prisma.review.aggregate({
      where: { productId, status: 'APPROVED' },
      _avg: { rating: true },
      _count: true,
    });
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        ratingAverage: agg._avg.rating ?? 0,
        reviewsCount: agg._count,
      },
    });
  }

  private buildOrderBy(sort?: ProductSort): Prisma.ProductOrderByWithRelationInput[] {
    switch (sort) {
      case ProductSort.PRICE_LOW:
        return [{ price: 'asc' }];
      case ProductSort.PRICE_HIGH:
        return [{ price: 'desc' }];
      case ProductSort.NEWEST:
        return [{ createdAt: 'desc' }];
      case ProductSort.RATING:
        return [{ ratingAverage: 'desc' }];
      case ProductSort.NAME:
        return [{ name: 'asc' }];
      case ProductSort.FEATURED:
      default:
        return [{ featured: 'desc' }, { reviewsCount: 'desc' }];
    }
  }

  private async ensureExists(id: string): Promise<ProductWithRelations> {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: productInclude,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }
}
