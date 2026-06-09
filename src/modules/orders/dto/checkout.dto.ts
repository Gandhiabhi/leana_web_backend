import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export enum CheckoutPaymentMethod {
  COD = 'cod',
  RAZORPAY = 'razorpay',
  UPI = 'upi',
}

export class OrderAddressDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  line1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiProperty({ description: 'Indian PIN code (6 digits)' })
  @IsString()
  @Matches(/^[1-9][0-9]{5}$/, { message: 'Enter a valid 6-digit Indian PIN code' })
  postalCode!: string;

  @ApiProperty({ example: 'IN', description: 'Country code — India only for now' })
  @IsString()
  @Matches(/^(IN|India)$/i, { message: 'Delivery is currently available in India only' })
  country!: string;

  @ApiProperty({ description: 'Indian mobile number (10 digits, optional +91 prefix)' })
  @IsString()
  @Matches(/^(\+91[\-\s]?)?[6-9]\d{9}$/, {
    message: 'Enter a valid 10-digit Indian mobile number',
  })
  phone!: string;
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

  @ApiPropertyOptional({ enum: CheckoutPaymentMethod, default: CheckoutPaymentMethod.COD })
  @IsOptional()
  @IsEnum(CheckoutPaymentMethod)
  paymentMethod?: CheckoutPaymentMethod;

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

export class RazorpayVerifyDto {
  @ApiProperty()
  @IsString()
  orderId!: string;

  @ApiProperty()
  @IsString()
  razorpayOrderId!: string;

  @ApiProperty()
  @IsString()
  razorpayPaymentId!: string;

  @ApiProperty()
  @IsString()
  razorpaySignature!: string;
}
