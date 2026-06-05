import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class ConnectIntegrationDto {
  @ApiPropertyOptional({ description: 'Provider credentials/config (stored securely, returned masked)' })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateIntegrationDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
