import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/utils/pagination.util';
import { slugify, uniqueSlug } from '../../common/utils/slug.util';
import { CreateCmsPageDto, QueryCmsPageDto, UpdateCmsPageDto } from './dto/cms-page.dto';

@Injectable()
export class CmsPagesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(query: QueryCmsPageDto) {
    const where: Prisma.CmsPageWhereInput = {
      published: true,
      ...(query.type ? { type: query.type } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.cmsPage.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { publishedAt: 'desc' },
        select: { id: true, slug: true, title: true, type: true, excerpt: true, coverImage: true, publishedAt: true },
      }),
      this.prisma.cmsPage.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async getPublishedBySlug(slug: string) {
    const page = await this.prisma.cmsPage.findFirst({ where: { slug, published: true } });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async findAllAdmin(query: QueryCmsPageDto) {
    const where: Prisma.CmsPageWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.cmsPage.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.cmsPage.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async create(dto: CreateCmsPageDto) {
    const slug = await uniqueSlug(dto.slug || dto.title, (s) =>
      this.prisma.cmsPage.findUnique({ where: { slug: s } }).then(Boolean),
    );
    return this.prisma.cmsPage.create({
      data: { ...dto, slug, publishedAt: dto.published ? new Date() : null },
    });
  }

  async update(id: string, dto: UpdateCmsPageDto) {
    const existing = await this.prisma.cmsPage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Page not found');
    return this.prisma.cmsPage.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.slug ? { slug: slugify(dto.slug) } : {}),
        ...(dto.published && !existing.published ? { publishedAt: new Date() } : {}),
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.cmsPage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Page not found');
    await this.prisma.cmsPage.delete({ where: { id } });
    return { id, deleted: true };
  }
}
