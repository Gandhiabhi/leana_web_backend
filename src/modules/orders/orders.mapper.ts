import { Prisma } from '@prisma/client';

export const orderInclude = {
  items: true,
  payment: true,
  statusHistory: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function toFrontendOrder(o: OrderWithRelations) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    paymentStatus: o.paymentStatus,
    email: o.email,
    customerName: o.customerName,
    subtotal: Number(o.subtotal),
    discountTotal: Number(o.discountTotal),
    shippingTotal: Number(o.shippingTotal),
    taxTotal: Number(o.taxTotal),
    total: Number(o.total),
    currency: o.currency,
    couponCode: o.couponCode ?? undefined,
    notes: o.notes ?? undefined,
    shippingAddress: o.shippingAddress ?? undefined,
    billingAddress: o.billingAddress ?? undefined,
    items: o.items.map((item) => ({
      id: item.id,
      productId: item.productId ?? undefined,
      name: item.name,
      sku: item.sku ?? undefined,
      image: item.image ?? undefined,
      unitPrice: Number(item.unitPrice),
      quantity: item.quantity,
      lineTotal: Number(item.lineTotal),
    })),
    payment: o.payment
      ? {
          status: o.payment.status,
          provider: o.payment.provider,
          amount: Number(o.payment.amount),
          refundedAmount: Number(o.payment.refundedAmount),
          clientSecret: o.payment.stripeClientSecret ?? undefined,
        }
      : undefined,
    statusHistory: o.statusHistory.map((h) => ({
      status: h.status,
      note: h.note ?? undefined,
      createdAt: h.createdAt,
    })),
    placedAt: o.placedAt ?? undefined,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}
