import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { StockMovementReason } from '@prisma/client';

export class AdjustStockDto {
  @ApiProperty({ description: 'Positive to add stock, negative to remove' })
  @IsInt()
  change!: number;

  @ApiPropertyOptional({ enum: StockMovementReason, default: StockMovementReason.ADJUSTMENT })
  @IsOptional()
  @IsEnum(StockMovementReason)
  reason?: StockMovementReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class SetStockDto {
  @ApiProperty()
  @IsInt()
  stock!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
