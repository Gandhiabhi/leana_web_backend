import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { QueryProductDto } from './dto/query-product.dto';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List products with filtering, sorting, search & pagination' })
  findAll(@Query() query: QueryProductDto) {
    return this.productsService.findAll(query);
  }

  @Get('admin')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'List products incl. drafts/archived (admin)' })
  findAllAdmin(@Query() query: QueryProductDto) {
    return this.productsService.findAllAdmin(query);
  }

  @Get('admin/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get a product by id (admin)' })
  findByIdAdmin(@Param('id') id: string) {
    return this.productsService.findByIdAdmin(id);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get a product by slug' })
  findOne(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Public()
  @Get(':slug/related')
  @ApiOperation({ summary: 'Get related products' })
  findRelated(@Param('slug') slug: string) {
    return this.productsService.findRelated(slug);
  }

  @Post()
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('Product created')
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('Product updated')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Patch(':id/featured')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('Product featured state toggled')
  toggleFeatured(@Param('id') id: string) {
    return this.productsService.toggleFeatured(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Product deleted')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
