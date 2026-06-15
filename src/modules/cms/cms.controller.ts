import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BannerPlacement, Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { HomeService } from './home.service';
import { CmsPagesService } from './cms-pages.service';
import { BannersService } from './banners.service';
import { HomeFeatureDto, SetFeaturedProductsDto, UpdateHomeDto, UpdateHomeFeatureDto } from './dto/home.dto';
import { CreateCmsPageDto, QueryCmsPageDto, UpdateCmsPageDto } from './dto/cms-page.dto';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';

@ApiTags('CMS')
@Controller('cms')
export class CmsController {
  constructor(
    private readonly home: HomeService,
    private readonly pages: CmsPagesService,
    private readonly banners: BannersService,
  ) {}

  // ── Home (storefront singleton) ──

  @Public()
  @Get('home')
  @ApiOperation({ summary: 'Get home page content + featured products' })
  getHome() {
    return this.home.getPublic();
  }

  @Patch('home')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('Home content updated')
  updateHome(@Body() dto: UpdateHomeDto) {
    return this.home.update(dto);
  }

  @Patch('home/featured-products')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('Featured products updated')
  setFeatured(@Body() dto: SetFeaturedProductsDto) {
    return this.home.setFeaturedProducts(dto);
  }

  @Post('home/features')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('Feature added')
  addFeature(@Body() dto: HomeFeatureDto) {
    return this.home.addFeature(dto);
  }

  @Patch('home/features/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('Feature updated')
  updateFeature(@Param('id') id: string, @Body() dto: UpdateHomeFeatureDto) {
    return this.home.updateFeature(id, dto);
  }

  @Delete('home/features/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('Feature removed')
  removeFeature(@Param('id') id: string) {
    return this.home.removeFeature(id);
  }

  // ── CMS pages ──

  @Public()
  @Get('pages')
  @ApiOperation({ summary: 'List published pages' })
  listPages(@Query() query: QueryCmsPageDto) {
    return this.pages.listPublished(query);
  }

  @Get('pages/admin')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  listPagesAdmin(@Query() query: QueryCmsPageDto) {
    return this.pages.findAllAdmin(query);
  }

  @Public()
  @Get('pages/:slug')
  @ApiOperation({ summary: 'Get a published page by slug' })
  getPage(@Param('slug') slug: string) {
    return this.pages.getPublishedBySlug(slug);
  }

  @Post('pages')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('Page created')
  createPage(@Body() dto: CreateCmsPageDto) {
    return this.pages.create(dto);
  }

  @Patch('pages/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('Page updated')
  updatePage(@Param('id') id: string, @Body() dto: UpdateCmsPageDto) {
    return this.pages.update(id, dto);
  }

  @Delete('pages/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Page deleted')
  removePage(@Param('id') id: string) {
    return this.pages.remove(id);
  }

  // ── Banners ──

  @Public()
  @Get('banners')
  @ApiOperation({ summary: 'List active banners (optionally by placement)' })
  listBanners(@Query('placement') placement?: BannerPlacement) {
    return this.banners.listActive(placement);
  }

  @Get('banners/admin')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  listBannersAdmin() {
    return this.banners.findAllAdmin();
  }

  @Post('banners')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('Banner created')
  createBanner(@Body() dto: CreateBannerDto) {
    return this.banners.create(dto);
  }

  @Patch('banners/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('Banner updated')
  updateBanner(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.banners.update(id, dto);
  }

  @Delete('banners/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('Banner deleted')
  removeBanner(@Param('id') id: string) {
    return this.banners.remove(id);
  }
}
