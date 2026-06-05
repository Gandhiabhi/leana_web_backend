import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { CouponType } from '@prisma/client';

export class CreateCouponDto {
  @ApiProperty({ example: 'WELCOME10' })
  @IsString()
  @MaxLength(40)
  code!: string;

  @ApiProperty({ enum: CouponType })
  @IsEnum(CouponType)
  type!: CouponType;

  @ApiProperty({ example: 10, description: 'Percent (0-100) or fixed amount' })
  @IsNumber()
  @Min(0)
  value!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrder?: number;

  @ApiPropertyOptional({ description: 'Total redemption cap' })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({ description: 'Per-user redemption cap' })
  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}

export class ValidateCouponDto {
  @ApiProperty({ example: 'WELCOME10' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 128 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  subtotal!: number;
}
