import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() orders?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() stock?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() reviews?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() marketing?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() weekly?: boolean;
}
