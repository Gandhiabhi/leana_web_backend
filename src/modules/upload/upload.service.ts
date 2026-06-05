import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';

@Injectable()
export class UploadService {
  constructor(
    private readonly cloudinary: CloudinaryService,
    private readonly prisma: PrismaService,
  ) {}

  async upload(buffer: Buffer, folder: string) {
    const result = await this.cloudinary.uploadBuffer(buffer, folder);
    await this.prisma.mediaAsset.create({
      data: {
        url: result.url,
        publicId: result.publicId,
        folder,
        format: result.format,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
      },
    });
    return result;
  }

  async remove(publicId: string) {
    await this.cloudinary.deleteByPublicId(publicId);
    await this.prisma.mediaAsset.deleteMany({ where: { publicId } });
    return { publicId, deleted: true };
  }

  list(folder?: string) {
    return this.prisma.mediaAsset.findMany({
      where: folder ? { folder } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
