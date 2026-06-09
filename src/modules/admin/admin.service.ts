import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const COUNTED_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [revenueAgg, orderCount, customerCount, recentOrders, lowStockCount] =
      await this.prisma.$transaction([
        this.prisma.order.aggregate({
          where: { status: { in: COUNTED_STATUSES } },
          _sum: { total: true },
          _count: true,
        }),
        this.prisma.order.count({ where: { status: { in: COUNTED_STATUSES } } }),
        this.prisma.user.count({ where: { role: Role.CUSTOMER, deletedAt: null } }),
        this.prisma.order.findMany({
          where: { status: { not: OrderStatus.PENDING } },
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            email: true,
            status: true,
            total: true,
            createdAt: true,
          },
        }),
        this.prisma.product.count({
          where: { deletedAt: null, trackStock: true, stock: { lte: 5 } },
        }),
      ]);

    const topProducts = await this.topProducts(5);
    const totalRevenue = Number(revenueAgg._sum.total ?? 0);
    return {
      revenue: totalRevenue,
      orders: orderCount,
      customers: customerCount,
      averageOrderValue: orderCount > 0 ? Number((totalRevenue / orderCount).toFixed(2)) : 0,
      lowStockCount,
      recentOrders: recentOrders.map((o) => ({ ...o, total: Number(o.total) })),
      topProducts,
    };
  }

  async revenueByMonth(months = 12) {
    const rows = await this.prisma.$queryRaw<Array<{ period: string; amount: number }>>(Prisma.sql`
      SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS period,
             COALESCE(SUM(total), 0)::float8 AS amount
      FROM orders
      WHERE status = ANY(${COUNTED_STATUSES}::"OrderStatus"[])
        AND "createdAt" >= (now() - (${months} || ' months')::interval)
      GROUP BY 1
      ORDER BY 1
    `);
    return rows.map((r) => ({ period: r.period, amount: Number(r.amount) }));
  }

  async topProducts(limit = 10) {
    const rows = await this.prisma.$queryRaw<
      Array<{ productId: string | null; name: string; revenue: number; units: number }>
    >(Prisma.sql`
      SELECT oi."productId" AS "productId", oi.name AS name,
             COALESCE(SUM(oi."lineTotal"), 0)::float8 AS revenue,
             COALESCE(SUM(oi.quantity), 0)::int AS units
      FROM order_items oi
      JOIN orders o ON o.id = oi."orderId"
      WHERE o.status = ANY(${COUNTED_STATUSES}::"OrderStatus"[])
      GROUP BY oi."productId", oi.name
      ORDER BY revenue DESC
      LIMIT ${limit}
    `);
    return rows.map((r) => ({ ...r, revenue: Number(r.revenue), units: Number(r.units) }));
  }

  async customerMetrics() {
    const [total, ltv] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { role: Role.CUSTOMER, deletedAt: null } }),
      this.prisma.order.aggregate({
        where: { status: { in: COUNTED_STATUSES } },
        _avg: { total: true },
      }),
    ]);
    const byTier = await this.prisma.user.groupBy({
      by: ['tier'],
      where: { role: Role.CUSTOMER, deletedAt: null },
      _count: true,
    });

    const repeatRows = await this.prisma.$queryRaw<Array<{ repeat: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS repeat FROM (
        SELECT "userId" FROM orders
        WHERE "userId" IS NOT NULL AND status = ANY(${COUNTED_STATUSES}::"OrderStatus"[])
        GROUP BY "userId" HAVING COUNT(*) > 1
      ) sub
    `);

    return {
      totalCustomers: total,
      byTier: byTier.map((t) => ({ tier: t.tier, count: t._count })),
      averageOrderValue: Number((ltv._avg.total ?? 0).toFixed(2)),
      repeatCustomers: Number(repeatRows[0]?.repeat ?? 0),
      repeatRate: total > 0 ? Number(((Number(repeatRows[0]?.repeat ?? 0) / total) * 100).toFixed(1)) : 0,
    };
  }

  async listCustomers(search?: string, skip = 0, take = 20) {
    const where: Prisma.UserWhereInput = {
      role: Role.CUSTOMER,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          tier: true,
          loyaltyPoints: true,
          location: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const userIds = users.map((u) => u.id);
    const spentRows =
      userIds.length > 0
        ? await this.prisma.order.groupBy({
            by: ['userId'],
            where: {
              userId: { in: userIds },
              status: { in: COUNTED_STATUSES },
            },
            _sum: { total: true },
          })
        : [];
    const spentByUser = new Map(
      spentRows.map((row) => [row.userId, Number(row._sum.total ?? 0)]),
    );

    const mapped = users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      tier: u.tier,
      loyaltyPoints: u.loyaltyPoints,
      createdAt: u.createdAt,
      orderCount: u._count.orders,
      totalSpent: spentByUser.get(u.id) ?? 0,
    }));

    return { users: mapped, total };
  }
}
