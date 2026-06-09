import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { slugify, uniqueSlug } from '../../common/utils/slug.util';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Storefront listing — active categories with live product counts. */
  async findAllPublic() {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { position: 'asc' },
      include: {
        _count: {
          select: { products: { where: { status: 'ACTIVE', deletedAt: null } } },
        },
      },
    });
    return categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      image: c.image,
      count: c._count.products,
    }));
  }

  async findAllAdmin() {
    return this.prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: { position: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findFirst({
      where: { slug, deletedAt: null },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const slug = await uniqueSlug(dto.slug || dto.name, (s) =>
      this.prisma.category.findUnique({ where: { slug: s } }).then(Boolean),
    );
    const nextPosition =
      dto.position ??
      ((await this.prisma.category.aggregate({ where: { deletedAt: null }, _max: { position: true } }))
        ._max.position ?? -1) + 1;

    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        image: dto.image,
        parentId: dto.parentId,
        position: nextPosition,
        isActive: dto.isActive ?? true,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.ensureExists(id);
    const data: Prisma.CategoryUpdateInput = { ...dto };
    if (dto.slug) data.slug = slugify(dto.slug);
    return this.prisma.category.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.category.findFirst({ where: { id, deletedAt: null } });
    if (!exists) throw new NotFoundException('Category not found');
  }
}
