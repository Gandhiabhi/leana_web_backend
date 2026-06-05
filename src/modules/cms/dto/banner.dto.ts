import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { BannerPlacement } from '@prisma/client';

export class CreateBannerDto {
  @ApiProperty() @IsString() @MaxLength(160) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) subtitle?: string;
  @ApiProperty() @IsString() image!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() publicId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() link?: string;

  @ApiPropertyOptional({ enum: BannerPlacement, default: BannerPlacement.HOME_HERO })
  @IsOptional()
  @IsEnum(BannerPlacement)
  placement?: BannerPlacement;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsDateString() startsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endsAt?: string;
}

export class UpdateBannerDto extends PartialType(CreateBannerDto) {}
