import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { productInclude, toFrontendProduct } from '../products/products.mapper';
import { HomeFeatureDto, SetFeaturedProductsDto, UpdateHomeDto } from './dto/home.dto';

const HOME_DEFAULTS = {
  heroEyebrow: 'Edition no. 07 — Spring',
  heroTitle: 'A study in luminous restraint.',
  heroSubtitle: 'Skin care composed like a fragrance — measured, layered and quietly powerful.',
  heroImage: '',
  heroCtaLabel: 'Shop the edit',
  heroCtaLink: '/shop',
  editorialTitle: 'Ingredients we are quietly obsessed with.',
  editorialBody: 'Sourced from botanical houses in Provence, Kerala and the Atlas mountains.',
  editorialImage: '',
  testimonialQuote: 'Leana feels less like a product and more like a private ceremony.',
  testimonialAuthor: '— Vogue',
  videoUrl: '',
  videoPoster: '',
  featuredProductIds: [] as string[],
};

@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreate() {
    const existing = await this.prisma.homeContent.findFirst({
      include: { features: { orderBy: { position: 'asc' } } },
    });
    if (existing) return existing;
    return this.prisma.homeContent.create({
      data: HOME_DEFAULTS,
      include: { features: { orderBy: { position: 'asc' } } },
    });
  }

  /** Public: home content + resolved featured products. */
  async getPublic() {
    const home = await this.getOrCreate();
    const featuredProducts = await this.prisma.product.findMany({
      where: { id: { in: home.featuredProductIds }, deletedAt: null, status: 'ACTIVE' },
      include: productInclude,
    });
    // Preserve admin-defined ordering.
    const ordered = home.featuredProductIds
      .map((id) => featuredProducts.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map(toFrontendProduct);

    return { ...home, featuredProducts: ordered };
  }

  async update(dto: UpdateHomeDto) {
    const home = await this.getOrCreate();
    return this.prisma.homeContent.update({
      where: { id: home.id },
      data: dto,
      include: { features: { orderBy: { position: 'asc' } } },
    });
  }

  async setFeaturedProducts(dto: SetFeaturedProductsDto) {
    const home = await this.getOrCreate();
    return this.prisma.homeContent.update({
      where: { id: home.id },
      data: { featuredProductIds: dto.productIds },
      include: { features: { orderBy: { position: 'asc' } } },
    });
  }

  async addFeature(dto: HomeFeatureDto) {
    const home = await this.getOrCreate();
    const count = await this.prisma.homeFeature.count({ where: { homeContentId: home.id } });
    await this.prisma.homeFeature.create({
      data: { ...dto, homeContentId: home.id, position: count },
    });
    return this.getOrCreate();
  }

  async updateFeature(id: string, dto: Partial<HomeFeatureDto>) {
    const feature = await this.prisma.homeFeature.findUnique({ where: { id } });
    if (!feature) throw new NotFoundException('Feature not found');
    await this.prisma.homeFeature.update({ where: { id }, data: dto });
    return this.getOrCreate();
  }

  async removeFeature(id: string) {
    await this.prisma.homeFeature.deleteMany({ where: { id } });
    return this.getOrCreate();
  }
}
