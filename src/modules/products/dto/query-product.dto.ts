import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBooleanString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ProductBadge } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export enum ProductSort {
  FEATURED = 'featured',
  PRICE_LOW = 'price_low',
  PRICE_HIGH = 'price_high',
  NEWEST = 'newest',
  RATING = 'rating',
  NAME = 'name',
}

export class QueryProductDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by category slug' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by collection slug' })
  @IsOptional()
  @IsString()
  collection?: string;

  @ApiPropertyOptional({ enum: ProductBadge })
  @IsOptional()
  @IsEnum(ProductBadge)
  badge?: ProductBadge;

  @ApiPropertyOptional({ description: 'Only featured products' })
  @IsOptional()
  @IsBooleanString()
  featured?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === '' ? undefined : parseFloat(value as string),
  )
  @IsNumber()
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === '' ? undefined : parseFloat(value as string),
  )
  @IsNumber()
  maxPrice?: number;

  @ApiPropertyOptional({ enum: ProductSort, default: ProductSort.FEATURED })
  @IsOptional()
  @IsEnum(ProductSort)
  sort?: ProductSort = ProductSort.FEATURED;
}
