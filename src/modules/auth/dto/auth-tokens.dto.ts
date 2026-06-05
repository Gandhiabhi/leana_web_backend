import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Refresh token. Optional when sent via httpOnly cookie.',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
