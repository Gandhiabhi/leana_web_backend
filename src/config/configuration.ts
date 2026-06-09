/**
 * Typed configuration tree. Consumed via `ConfigService<AppConfig, true>`
 * so every lookup is fully type-safe (e.g. config.get('jwt.accessSecret')).
 */
export interface AppConfig {
  env: string;
  isProduction: boolean;
  port: number;
  apiPrefix: string;
  apiVersion: string;
  corsOrigins: string[];
  database: {
    url: string;
    directUrl: string;
  };
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  cookie: {
    secret: string;
    domain: string;
  };
  security: {
    bcryptSaltRounds: number;
    maxLoginAttempts: number;
    accountLockMinutes: number;
  };
  throttle: {
    ttl: number;
    limit: number;
  };
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
    folder: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
    currency: string;
  };
  razorpay: {
    keyId: string;
    keySecret: string;
    currency: string;
  };
  mail: {
    host: string;
    port: number;
    user: string;
    password: string;
    from: string;
  };
  frontendUrl: string;
  commerce: {
    freeShippingThreshold: number;
    defaultShippingFee: number;
    taxRate: number;
  };
}

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default (): AppConfig => {
  const env = process.env.NODE_ENV ?? 'development';
  return {
    env,
    isProduction: env === 'production',
    port: toNumber(process.env.PORT, 4000),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    apiVersion: process.env.API_VERSION ?? 'v1',
    corsOrigins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    database: {
      url: process.env.DATABASE_URL ?? '',
      directUrl: process.env.DIRECT_URL ?? '',
    },
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    },
    cookie: {
      secret: process.env.COOKIE_SECRET ?? '',
      domain: process.env.COOKIE_DOMAIN ?? 'localhost',
    },
    security: {
      bcryptSaltRounds: toNumber(process.env.BCRYPT_SALT_ROUNDS, 12),
      maxLoginAttempts: toNumber(process.env.MAX_LOGIN_ATTEMPTS, 5),
      accountLockMinutes: toNumber(process.env.ACCOUNT_LOCK_MINUTES, 15),
    },
    throttle: {
      ttl: toNumber(process.env.THROTTLE_TTL, 60),
      limit: toNumber(process.env.THROTTLE_LIMIT, 120),
    },
    supabase: {
      url: process.env.SUPABASE_URL ?? '',
      anonKey: process.env.SUPABASE_ANON_KEY ?? '',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    },
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
      apiKey: process.env.CLOUDINARY_API_KEY ?? '',
      apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
      folder: process.env.CLOUDINARY_FOLDER ?? 'leana',
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY ?? '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
      currency: process.env.STRIPE_CURRENCY ?? 'usd',
    },
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID ?? '',
      keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
      currency: process.env.RAZORPAY_CURRENCY ?? 'INR',
    },
    mail: {
      host: process.env.SMTP_HOST ?? '',
      port: toNumber(process.env.SMTP_PORT, 587),
      user: process.env.SMTP_USER ?? '',
      password: process.env.SMTP_PASSWORD ?? '',
      from: process.env.MAIL_FROM ?? 'Leana Professional <no-reply@leana.com>',
    },
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    commerce: {
      freeShippingThreshold: toNumber(process.env.FREE_SHIPPING_THRESHOLD, 120),
      defaultShippingFee: toNumber(process.env.DEFAULT_SHIPPING_FEE, 12),
      taxRate: toNumber(process.env.TAX_RATE, 0),
    },
  };
};
