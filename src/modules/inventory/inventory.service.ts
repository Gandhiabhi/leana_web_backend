import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockMovementReason } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { AdjustStockDto, SetStockDto } from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationQueryDto) {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { stock: 'asc' },
        select: {
          id: true,
          name: true,
          sku: true,
          image: true,
          stock: true,
          lowStockAlert: true,
          trackStock: true,
        },
      }),
      this.prisma.product.count({ where }),
    ]);
    const data = items.map((p) => ({ ...p, lowStock: p.trackStock && p.stock <= p.lowStockAlert }));
    return paginate(data, total, query.page, query.limit);
  }

  async lowStock() {
    const products = await this.prisma.$queryRaw<
      Array<{ id: string; name: string; stock: number; lowStockAlert: number }>
    >`SELECT id, name, stock, "lowStockAlert" FROM products
       WHERE "deletedAt" IS NULL AND "trackStock" = true AND stock <= "lowStockAlert"
       ORDER BY stock ASC LIMIT 100`;
    return products;
  }

  async adjust(productId: string, dto: AdjustStockDto, actorId?: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { stock: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.stock + dto.change < 0) {
      throw new BadRequestException('Adjustment would result in negative stock');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: dto.change } },
        select: { id: true, name: true, stock: true },
      });
      await tx.stockMovement.create({
        data: {
          productId,
          change: dto.change,
          reason: dto.reason ?? StockMovementReason.ADJUSTMENT,
          note: dto.note,
          createdById: actorId,
        },
      });
      return updated;
    });
  }

  async setStock(productId: string, dto: SetStockDto, actorId?: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { stock: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const change = dto.stock - product.stock;
    return this.adjust(productId, { change, reason: StockMovementReason.ADJUSTMENT, note: dto.note }, actorId);
  }

  async movements(query: PaginationQueryDto) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { name: true, sku: true } } },
      }),
      this.prisma.stockMovement.count(),
    ]);
    return paginate(data, total, query.page, query.limit);
  }
}
