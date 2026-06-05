import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto, UpdateCollectionDto } from './dto/collection.dto';

@ApiTags('Collections')
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List active collections' })
  findAll() {
    return this.collectionsService.findAllPublic();
  }

  @Get('admin/all')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  findAllAdmin() {
    return this.collectionsService.findAllAdmin();
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get a collection by slug' })
  findOne(@Param('slug') slug: string) {
    return this.collectionsService.findBySlug(slug);
  }

  @Post()
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('Collection created')
  create(@Body() dto: CreateCollectionDto) {
    return this.collectionsService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('Collection updated')
  update(@Param('id') id: string, @Body() dto: UpdateCollectionDto) {
    return this.collectionsService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Collection deleted')
  remove(@Param('id') id: string) {
    return this.collectionsService.remove(id);
  }
}
