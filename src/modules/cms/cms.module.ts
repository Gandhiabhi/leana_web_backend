import { Module } from '@nestjs/common';
import { HomeService } from './home.service';
import { CmsPagesService } from './cms-pages.service';
import { BannersService } from './banners.service';
import { CmsController } from './cms.controller';

@Module({
  providers: [HomeService, CmsPagesService, BannersService],
  controllers: [CmsController],
  exports: [HomeService, CmsPagesService, BannersService],
})
export class CmsModule {}
