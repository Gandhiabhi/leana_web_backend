import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { slugify, uniqueSlug } from '../../common/utils/slug.util';
import { CreateCollectionDto, UpdateCollectionDto } from './dto/collection.dto';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllPublic() {
    const collections = await this.prisma.collection.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { position: 'asc' },
    });
    return collections.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      image: c.image,
    }));
  }

  async findAllAdmin() {
    return this.prisma.collection.findMany({
      where: { deletedAt: null },
      orderBy: { position: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  async findBySlug(slug: string) {
    const collection = await this.prisma.collection.findFirst({ where: { slug, deletedAt: null } });
    if (!collection) throw new NotFoundException('Collection not found');
    return collection;
  }

  async create(dto: CreateCollectionDto) {
    const slug = await uniqueSlug(dto.slug || dto.name, (s) =>
      this.prisma.collection.findUnique({ where: { slug: s } }).then(Boolean),
    );
    return this.prisma.collection.create({ data: { ...dto, slug } });
  }

  async update(id: string, dto: UpdateCollectionDto) {
    await this.ensureExists(id);
    const data: Prisma.CollectionUpdateInput = { ...dto };
    if (dto.slug) data.slug = slugify(dto.slug);
    return this.prisma.collection.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.collection.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.collection.findFirst({ where: { id, deletedAt: null } });
    if (!exists) throw new NotFoundException('Collection not found');
  }
}
