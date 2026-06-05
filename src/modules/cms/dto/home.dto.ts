import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateHomeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() heroEyebrow?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() heroTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() heroSubtitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() heroImage?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() heroCtaLabel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() heroCtaLink?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() editorialTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() editorialBody?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() editorialImage?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() testimonialQuote?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() testimonialAuthor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() videoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() videoPoster?: string;
}

export class HomeFeatureDto {
  @ApiProperty() @IsString() @MaxLength(120) title!: string;
  @ApiProperty() @IsString() @MaxLength(300) description!: string;
  @ApiProperty() @IsString() image!: string;
  @ApiProperty() @IsString() link!: string;
}

export class SetFeaturedProductsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  productIds!: string[];
}
