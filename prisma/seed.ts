/* eslint-disable no-console */
import {
  CouponType,
  PrismaClient,
  ProductBadge,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PLACEHOLDER = (seed: string) =>
  `https://res.cloudinary.com/demo/image/upload/leana/${seed}.jpg`;

const categories = [
  { slug: 'serums', name: 'Serums', position: 1 },
  { slug: 'moisturisers', name: 'Moisturisers', position: 2 },
  { slug: 'oils', name: 'Facial Oils', position: 3 },
  { slug: 'essence', name: 'Essence', position: 4 },
  { slug: 'eyes', name: 'Eye Care', position: 5 },
  { slug: 'colour', name: 'Colour', position: 6 },
];

const collections = [
  {
    slug: 'night-ritual',
    name: 'The Night Ritual',
    description: 'A two-step overnight restoration that resets skin while you sleep.',
  },
  {
    slug: 'daily-ritual',
    name: 'The Daily Ritual',
    description: 'Effortless luminosity, every morning.',
  },
  {
    slug: 'editors-edit',
    name: "Editor's Edit",
    description: 'Hand-picked seasonal favourites from our beauty studio.',
  },
];

const products = [
  {
    slug: 'luminous-night-serum',
    name: 'Luminous Night Serum',
    tagline: 'Overnight renewal concentrate',
    description:
      'A weightless concentrate of bakuchiol, niacinamide and squalane that resets the skin while you sleep.',
    price: 128,
    comparePrice: 148,
    categorySlug: 'serums',
    collectionSlug: 'night-ritual',
    badge: ProductBadge.BESTSELLER,
    featured: true,
    stock: 24,
    rating: 4.9,
    reviews: 412,
    volume: '30 ml',
    ingredients: ['Bakuchiol', 'Niacinamide 5%', 'Squalane', 'Centella Asiatica'],
    usage: 'Apply 3-4 drops to clean skin every evening. Follow with moisturiser.',
  },
  {
    slug: 'ceremony-radiance-cream',
    name: 'Ceremony Radiance Cream',
    tagline: 'Daily luminous moisturiser',
    description:
      'A silken cream that drenches the skin in marula oil and peptides for an all-day inner light.',
    price: 96,
    categorySlug: 'moisturisers',
    collectionSlug: 'daily-ritual',
    badge: ProductBadge.NEW,
    featured: true,
    stock: 41,
    rating: 4.8,
    reviews: 287,
    volume: '50 ml',
    ingredients: ['Marula Oil', 'Peptide Complex', 'Hyaluronic Acid', 'Vitamin E'],
    usage: 'Massage upward each morning over serum.',
  },
  {
    slug: 'amber-facial-oil',
    name: 'Amber Facial Oil',
    tagline: 'Nutrient-dense glow elixir',
    description:
      'A golden blend of nine cold-pressed oils that restores suppleness and a glass-like finish.',
    price: 142,
    categorySlug: 'oils',
    collectionSlug: 'night-ritual',
    badge: ProductBadge.BESTSELLER,
    featured: true,
    stock: 12,
    rating: 4.9,
    reviews: 521,
    volume: '30 ml',
    ingredients: ['Rosehip', 'Argan', 'Jojoba', 'Sea Buckthorn'],
    usage: 'Press 2 drops into damp skin morning and night.',
  },
  {
    slug: 'matte-velvet-lip',
    name: 'Matte Velvet Lip',
    tagline: 'Sculpted satin pigment',
    description:
      'A modern matte that wears like a second skin with conditioning shea and meadowfoam.',
    price: 48,
    categorySlug: 'colour',
    collectionSlug: 'editors-edit',
    badge: ProductBadge.LIMITED,
    featured: false,
    stock: 8,
    rating: 4.7,
    reviews: 198,
    volume: '3.5 g',
    ingredients: ['Shea Butter', 'Meadowfoam Seed Oil', 'Mineral Pigments'],
    usage: 'Apply directly to clean lips. Layer for depth.',
  },
  {
    slug: 'essence-of-bloom',
    name: 'Essence of Bloom',
    tagline: 'Hydrating treatment essence',
    description:
      'A bi-phase essence layering rose ferment with hyaluronic acid for plush, dewy hydration.',
    price: 84,
    categorySlug: 'essence',
    collectionSlug: 'daily-ritual',
    badge: ProductBadge.NEW,
    featured: false,
    stock: 33,
    rating: 4.8,
    reviews: 156,
    volume: '120 ml',
    ingredients: ['Rose Ferment', 'Hyaluronic Acid', 'Beta-Glucan'],
    usage: 'Press into skin after cleansing. Use morning and evening.',
  },
  {
    slug: 'obsidian-eye-cream',
    name: 'Obsidian Eye Cream',
    tagline: 'Sculpting eye contour',
    description:
      'Caffeine, peptides and licorice root visibly lift, brighten and depuff the eye area.',
    price: 76,
    categorySlug: 'eyes',
    collectionSlug: 'editors-edit',
    featured: false,
    stock: 19,
    rating: 4.6,
    reviews: 89,
    volume: '15 ml',
    ingredients: ['Caffeine', 'Peptides', 'Licorice Root'],
    usage: 'Gently tap around the orbital bone morning and night.',
  },
];

async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

  // ── Admin users ──
  // Each entry is upserted, so re-running the seed keeps these accounts in sync.
  const adminAccounts = [
    {
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@leana.com',
      password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!',
      firstName: 'Leana',
      lastName: 'Admin',
    },
    {
      // Requested operator account — full SUPER_ADMIN access to the admin panel.
      email: 'abhishek123@gamil.com',
      password: 'abhi123',
      firstName: 'Abhishek',
      lastName: 'Admin',
    },
  ];

  for (const account of adminAccounts) {
    const passwordHash = await bcrypt.hash(account.password, 12);
    await prisma.user.upsert({
      where: { email: account.email },
      update: {
        role: Role.SUPER_ADMIN,
        passwordHash,
        firstName: account.firstName,
        lastName: account.lastName,
        emailVerified: true,
      },
      create: {
        email: account.email,
        passwordHash,
        firstName: account.firstName,
        lastName: account.lastName,
        role: Role.SUPER_ADMIN,
        emailVerified: true,
      },
    });
    console.log(`   ✓ Admin user: ${account.email} (password: ${account.password})`);
  }

  // ── Categories ──
  const categoryMap = new Map<string, string>();
  for (const c of categories) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, position: c.position, image: PLACEHOLDER(c.slug) },
      create: { ...c, image: PLACEHOLDER(c.slug) },
    });
    categoryMap.set(c.slug, cat.id);
  }
  console.log(`   ✓ ${categories.length} categories`);

  // ── Collections ──
  const collectionMap = new Map<string, string>();
  for (const c of collections) {
    const col = await prisma.collection.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description },
      create: { ...c, image: PLACEHOLDER(c.slug) },
    });
    collectionMap.set(c.slug, col.id);
  }
  console.log(`   ✓ ${collections.length} collections`);

  // ── Products ──
  const featuredIds: string[] = [];
  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        price: p.price,
        comparePrice: p.comparePrice ?? null,
        stock: p.stock,
        featured: p.featured,
        badge: p.badge ?? null,
        ratingAverage: p.rating,
        reviewsCount: p.reviews,
      },
      create: {
        slug: p.slug,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        price: p.price,
        comparePrice: p.comparePrice ?? null,
        image: PLACEHOLDER(p.slug),
        badge: p.badge ?? null,
        featured: p.featured,
        stock: p.stock,
        ratingAverage: p.rating,
        reviewsCount: p.reviews,
        volume: p.volume,
        ingredients: p.ingredients,
        usage: p.usage,
        categoryId: categoryMap.get(p.categorySlug),
        collectionId: collectionMap.get(p.collectionSlug),
        images: {
          create: [
            { url: PLACEHOLDER(p.slug), position: 0 },
            { url: PLACEHOLDER(`${p.slug}-2`), position: 1 },
          ],
        },
      },
    });
    if (p.featured) featuredIds.push(product.id);
  }
  console.log(`   ✓ ${products.length} products`);

  // ── Home content (singleton) ──
  const existingHome = await prisma.homeContent.findFirst();
  if (!existingHome) {
    await prisma.homeContent.create({
      data: {
        heroEyebrow: 'Edition no. 07 — Spring',
        heroTitle: 'A study in luminous restraint.',
        heroSubtitle:
          'Skin care composed like a fragrance — measured, layered and quietly powerful.',
        heroImage: PLACEHOLDER('hero'),
        heroCtaLabel: 'Shop the edit',
        heroCtaLink: '/shop',
        editorialTitle: 'Ingredients we are quietly obsessed with.',
        editorialBody:
          'Sourced from botanical houses in Provence, Kerala and the Atlas mountains.',
        editorialImage: PLACEHOLDER('ingredients'),
        testimonialQuote:
          'Skin you can almost hear. Leana feels less like a product and more like a private ceremony.',
        testimonialAuthor: '— Vogue, March 2026',
        videoUrl: 'https://cdn.coverr.co/videos/coverr-a-woman-applying-skin-care-cream-9251/1080p.mp4',
        videoPoster: PLACEHOLDER('portrait'),
        featuredProductIds: featuredIds,
        features: {
          create: [
            { title: 'Slow Botany', description: 'Cold-pressed actives, traceable to the source.', image: PLACEHOLDER('ingredients'), link: '/about', position: 0 },
            { title: 'The Night Ritual', description: 'A two-step overnight restoration.', image: PLACEHOLDER('hero'), link: '/shop', position: 1 },
            { title: 'Studio Portraits', description: 'Photographed in natural Provence light.', image: PLACEHOLDER('portrait'), link: '/about', position: 2 },
          ],
        },
      },
    });
    console.log('   ✓ Home content');
  }

  // ── Sample coupon ──
  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      type: CouponType.PERCENT,
      value: 10,
      minOrder: 0,
      active: true,
    },
  });
  console.log('   ✓ Sample coupon WELCOME10');

  console.log('✅ Seeding complete');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
