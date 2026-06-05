import { Injectable, NotFoundException } from '@nestjs/common';
import { BannerPlacement } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';

@Injectable()
export class BannersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async listActive(placement?: BannerPlacement) {
    const now = new Date();
    return this.prisma.banner.findMany({
      where: {
        active: true,
        ...(placement ? { placement } : {}),
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { position: 'asc' },
    });
  }

  findAllAdmin() {
    return this.prisma.banner.findMany({ orderBy: [{ placement: 'asc' }, { position: 'asc' }] });
  }

  create(dto: CreateBannerDto) {
    return this.prisma.banner.create({
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateBannerDto) {
    await this.ensureExists(id);
    return this.prisma.banner.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.startsAt ? { startsAt: new Date(dto.startsAt) } : {}),
        ...(dto.endsAt ? { endsAt: new Date(dto.endsAt) } : {}),
      },
    });
  }

  async remove(id: string) {
    const banner = await this.ensureExists(id);
    if (banner.publicId) await this.cloudinary.deleteByPublicId(banner.publicId);
    await this.prisma.banner.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async ensureExists(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    return banner;
  }
}
