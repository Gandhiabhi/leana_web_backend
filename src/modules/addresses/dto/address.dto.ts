import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AddressType } from '@prisma/client';

export class CreateAddressDto {
  @ApiPropertyOptional({ enum: AddressType, default: AddressType.SHIPPING })
  @IsOptional()
  @IsEnum(AddressType)
  type?: AddressType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

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

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}
