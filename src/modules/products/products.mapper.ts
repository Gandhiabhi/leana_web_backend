import { Prisma, ProductBadge } from '@prisma/client';

/** Eager relations required to serialize a product for the storefront. */
export const productInclude = {
  category: true,
  collection: true,
  images: { orderBy: { position: 'asc' } },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

const badgeMap: Record<ProductBadge, 'new' | 'bestseller' | 'limited'> = {
  [ProductBadge.NEW]: 'new',
  [ProductBadge.BESTSELLER]: 'bestseller',
  [ProductBadge.LIMITED]: 'limited',
};

/**
 * Serializes a product into the exact shape the existing frontend `Product`
 * type expects, so storefront components work without refactoring.
 */
export function toFrontendProduct(p: ProductWithRelations) {
  const gallery = p.images.length > 0 ? p.images.map((img) => img.url) : p.image ? [p.image] : [];
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline ?? '',
    description: p.description ?? '',
    price: Number(p.price),
    comparePrice: p.comparePrice != null ? Number(p.comparePrice) : undefined,
    image: p.image ?? gallery[0] ?? '',
    gallery,
    category: p.category?.name ?? '',
    categorySlug: p.category?.slug ?? '',
    collection: p.collection?.name ?? '',
    collectionSlug: p.collection?.slug ?? '',
    badge: p.badge ? badgeMap[p.badge] : undefined,
    featured: p.featured,
    stock: p.stock,
    rating: p.ratingAverage,
    reviews: p.reviewsCount,
    volume: p.volume ?? '',
    ingredients: p.ingredients,
    usage: p.usage ?? '',
    status: p.status,
    sku: p.sku ?? undefined,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export type FrontendProduct = ReturnType<typeof toFrontendProduct>;
