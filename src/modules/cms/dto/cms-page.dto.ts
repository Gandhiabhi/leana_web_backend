import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CmsPageType } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class CreateCmsPageDto {
  @ApiProperty() @IsString() @MaxLength(200) title!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(220) slug?: string;

  @ApiPropertyOptional({ enum: CmsPageType, default: CmsPageType.PAGE })
  @IsOptional()
  @IsEnum(CmsPageType)
  type?: CmsPageType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) excerpt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() body?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() coverImage?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) seoTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(320) seoDescription?: string;
}

export class UpdateCmsPageDto extends PartialType(CreateCmsPageDto) {}

export class QueryCmsPageDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CmsPageType })
  @IsOptional()
  @IsEnum(CmsPageType)
  type?: CmsPageType;
}
