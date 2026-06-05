import { plainToInstance, Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Strongly-typed, fail-fast validation of process environment.
 * The application refuses to boot if any required variable is missing or invalid.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  @Transform(({ value }) => parseInt(value as string, 10))
  PORT = 4000;

  @IsString()
  @IsOptional()
  API_PREFIX = 'api';

  @IsString()
  @IsOptional()
  API_VERSION = 'v1';

  @IsString()
  @IsOptional()
  CORS_ORIGINS = '';

  // ── Database ──
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  DIRECT_URL!: string;

  // ── JWT ──
  @IsString()
  @MinLength(16)
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRES_IN = '15m';

  @IsString()
  @MinLength(16)
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN = '7d';

  @IsString()
  @MinLength(16)
  COOKIE_SECRET!: string;

  @IsString()
  @IsOptional()
  COOKIE_DOMAIN = 'localhost';

  // ── Security ──
  @IsInt()
  @Min(8)
  @Max(15)
  @Transform(({ value }) => parseInt((value as string) ?? '12', 10))
  @IsOptional()
  BCRYPT_SALT_ROUNDS = 12;

  @IsInt()
  @Transform(({ value }) => parseInt((value as string) ?? '5', 10))
  @IsOptional()
  MAX_LOGIN_ATTEMPTS = 5;

  @IsInt()
  @Transform(({ value }) => parseInt((value as string) ?? '15', 10))
  @IsOptional()
  ACCOUNT_LOCK_MINUTES = 15;

  @IsInt()
  @Transform(({ value }) => parseInt((value as string) ?? '60', 10))
  @IsOptional()
  THROTTLE_TTL = 60;

  @IsInt()
  @Transform(({ value }) => parseInt((value as string) ?? '120', 10))
  @IsOptional()
  THROTTLE_LIMIT = 120;

  // ── Supabase (optional) ──
  @IsString()
  @IsOptional()
  SUPABASE_URL = '';

  @IsString()
  @IsOptional()
  SUPABASE_ANON_KEY = '';

  @IsString()
  @IsOptional()
  SUPABASE_SERVICE_ROLE_KEY = '';

  // ── Cloudinary ──
  @IsString()
  @IsOptional()
  CLOUDINARY_CLOUD_NAME = '';

  @IsString()
  @IsOptional()
  CLOUDINARY_API_KEY = '';

  @IsString()
  @IsOptional()
  CLOUDINARY_API_SECRET = '';

  @IsString()
  @IsOptional()
  CLOUDINARY_FOLDER = 'leana';

  // ── Stripe ──
  @IsString()
  @IsOptional()
  STRIPE_SECRET_KEY = '';

  @IsString()
  @IsOptional()
  STRIPE_WEBHOOK_SECRET = '';

  @IsString()
  @IsOptional()
  STRIPE_CURRENCY = 'usd';

  // ── Mail ──
  @IsString()
  @IsOptional()
  SMTP_HOST = '';

  @IsInt()
  @Transform(({ value }) => parseInt((value as string) ?? '587', 10))
  @IsOptional()
  SMTP_PORT = 587;

  @IsString()
  @IsOptional()
  SMTP_USER = '';

  @IsString()
  @IsOptional()
  SMTP_PASSWORD = '';

  @IsString()
  @IsOptional()
  MAIL_FROM = 'Leana Professional <no-reply@leana.com>';

  @IsString()
  @IsOptional()
  FRONTEND_URL = 'http://localhost:5173';

  // ── Commerce ──
  @IsInt()
  @Transform(({ value }) => parseInt((value as string) ?? '120', 10))
  @IsOptional()
  FREE_SHIPPING_THRESHOLD = 120;

  @IsInt()
  @Transform(({ value }) => parseInt((value as string) ?? '12', 10))
  @IsOptional()
  DEFAULT_SHIPPING_FEE = 12;

  @IsInt()
  @Transform(({ value }) => parseInt((value as string) ?? '0', 10))
  @IsOptional()
  TAX_RATE = 0;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    forbidUnknownValues: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return validated;
}
