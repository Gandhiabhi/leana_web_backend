import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { AppConfig } from '../../config/configuration';

export interface UploadedImage {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly rootFolder: string;
  readonly enabled: boolean;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const cfg = this.config.get('cloudinary', { infer: true });
    this.rootFolder = cfg.folder;
    this.enabled = Boolean(cfg.cloudName && cfg.apiKey && cfg.apiSecret);

    if (this.enabled) {
      cloudinary.config({
        cloud_name: cfg.cloudName,
        api_key: cfg.apiKey,
        api_secret: cfg.apiSecret,
        secure: true,
      });
    } else {
      this.logger.warn('Cloudinary is not fully configured — uploads are disabled');
    }
  }

  private assertEnabled(): void {
    if (!this.enabled) throw new InternalServerErrorException('Cloudinary is not configured');
  }

  /**
   * Uploads a file buffer to a sub-folder with optimization + format auto.
   * @param subFolder e.g. "products", "banners", "cms"
   */
  async uploadBuffer(buffer: Buffer, subFolder: string): Promise<UploadedImage> {
    this.assertEnabled();
    const folder = `${this.rootFolder}/${subFolder}`;

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, uploaded) => {
          if (error || !uploaded) return reject(error ?? new Error('Upload failed'));
          resolve(uploaded);
        },
      );
      stream.end(buffer);
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  }

  async deleteByPublicId(publicId: string): Promise<void> {
    if (!this.enabled) return;
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      this.logger.warn(`Failed to delete Cloudinary asset ${publicId}: ${(err as Error).message}`);
    }
  }
}
