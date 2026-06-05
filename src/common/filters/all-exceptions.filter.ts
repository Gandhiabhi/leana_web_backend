import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

interface ErrorBody {
  success: false;
  statusCode: number;
  message: string;
  error: string;
  details?: unknown;
  timestamp: string;
  path: string;
}

/**
 * Centralized exception filter.
 * - Maps HttpExceptions, Prisma known errors, and unknown errors to a
 *   consistent error envelope.
 * - Never leaks stack traces or raw DB errors to clients in production.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'InternalServerError';
    let details: unknown;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const body = res as Record<string, unknown>;
        message = Array.isArray(body.message)
          ? (body.message as string[]).join(', ')
          : (body.message as string) ?? exception.message;
        if (Array.isArray(body.message)) details = body.message;
      }
      error = exception.name;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ statusCode, message, error } = this.mapPrismaError(exception));
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Invalid query parameters';
      error = 'PrismaValidationError';
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      if (process.env.NODE_ENV === 'production') {
        message = 'Internal server error';
        details = undefined;
      }
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${statusCode}: ${message}`);
    }

    const body: ErrorBody = {
      success: false,
      statusCode,
      message,
      error,
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(body);
  }

  private mapPrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    statusCode: number;
    message: string;
    error: string;
  } {
    switch (exception.code) {
      case 'P2002': {
        const target = (exception.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
        return {
          statusCode: HttpStatus.CONFLICT,
          message: `A record with this ${target} already exists`,
          error: 'UniqueConstraintViolation',
        };
      }
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'The requested record was not found',
          error: 'RecordNotFound',
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Related record constraint failed',
          error: 'ForeignKeyConstraintViolation',
        };
      default:
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'A database error occurred',
          error: `PrismaError:${exception.code}`,
        };
    }
  }
}
