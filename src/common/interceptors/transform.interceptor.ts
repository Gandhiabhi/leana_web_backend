import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse, PaginatedResult, PaginationMeta } from '../interfaces/api-response.interface';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';

function isPaginated<T>(value: unknown): value is PaginatedResult<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'meta' in value &&
    Array.isArray((value as PaginatedResult<T>).data)
  );
}

/**
 * Wraps every successful response in a consistent envelope:
 * { success, statusCode, message, data, meta?, timestamp, path }
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const customMessage = this.reflector.getAllAndOverride<string | undefined>(
      RESPONSE_MESSAGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    return next.handle().pipe(
      map((payload): ApiResponse<T> => {
        let data: T = payload as T;
        let meta: PaginationMeta | undefined;

        if (isPaginated<unknown>(payload)) {
          data = payload.data as unknown as T;
          meta = payload.meta;
        }

        return {
          success: true,
          statusCode: response.statusCode,
          message: customMessage ?? 'Success',
          data,
          ...(meta ? { meta } : {}),
          timestamp: new Date().toISOString(),
          path: request.url,
        };
      }),
    );
  }
}
