import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // Stripe webhooks require the raw request body for signature verification.
    rawBody: true,
  });

  const config = app.get(ConfigService<AppConfig, true>);
  const logger = app.get(PinoLogger);
  app.useLogger(logger);

  const isProduction = config.get('isProduction', { infer: true });
  const apiPrefix = config.get('apiPrefix', { infer: true });
  const apiVersion = config.get('apiVersion', { infer: true });
  const port = config.get('port', { infer: true });
  const corsOrigins = config.get('corsOrigins', { infer: true });

  // Security headers
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser(config.get('cookie.secret', { infer: true })));

  // Trust the first proxy (Vercel/Render/Fly) so req.ip and secure cookies work.
  app.set('trust proxy', 1);

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: apiVersion.replace('v', '') });

  // Defense-in-depth: ValidationPipe is also registered globally via APP_PIPE.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Leana Professional API')
      .setDescription('Production REST API for the Leana Professional ecommerce platform')
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('leana_refresh_token')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port);
  logger.log(`🚀 API ready at http://localhost:${port}/${apiPrefix}/${apiVersion}`, 'Bootstrap');
  if (!isProduction) {
    logger.log(`📚 Swagger docs at http://localhost:${port}/${apiPrefix}/docs`, 'Bootstrap');
  }
}

void bootstrap();
