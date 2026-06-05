import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipeBuilder,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsString } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { UploadService } from './upload.service';

const ALLOWED_FOLDERS = ['products', 'banners', 'cms', 'categories', 'collections', 'avatars'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

class DeleteAssetDto {
  @IsString()
  publicId!: string;
}

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post(':folder')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ResponseMessage('File uploaded')
  @ApiOperation({ summary: 'Upload an image to a folder (products|banners|cms|...)' })
  upload(
    @Param('folder') folder: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^image\/(jpeg|png|webp|gif|avif)$/ })
        .addMaxSizeValidator({ maxSize: MAX_FILE_SIZE })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    const safeFolder = ALLOWED_FOLDERS.includes(folder) ? folder : 'misc';
    return this.uploadService.upload(file.buffer, safeFolder);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'List uploaded media assets' })
  list(@Query('folder') folder?: string) {
    return this.uploadService.list(folder);
  }

  @Delete()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('File deleted')
  @ApiOperation({ summary: 'Delete a media asset by Cloudinary publicId' })
  remove(@Body() dto: DeleteAssetDto) {
    return this.uploadService.remove(dto.publicId);
  }
}
