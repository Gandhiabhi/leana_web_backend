import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class OrderAddressDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  lastName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  line1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  city!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  postalCode!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  country!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}

export class CheckoutDto {
  @ApiProperty({ example: 'amelie@studio.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ type: OrderAddressDto })
  @ValidateNested()
  @Type(() => OrderAddressDto)
  shippingAddress!: OrderAddressDto;

  @ApiPropertyOptional({ type: OrderAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrderAddressDto)
  billingAddress?: OrderAddressDto;

  @ApiPropertyOptional({ description: 'Coupon code to apply' })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ description: 'Guest cart session id' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
