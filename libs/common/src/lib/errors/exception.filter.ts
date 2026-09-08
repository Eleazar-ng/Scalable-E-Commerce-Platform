import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from './app-exception';

/**
 * Consistent shape every service returns for errors, regardless of whether
 * the failure originated as an AppException, a raw NestJS HttpException, or
 * an unexpected/unhandled error.
 */
export interface ErrorResponseBody {
  code: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path: string;
  context?: Record<string, unknown>;
}

/**
 * Global exception filter. Register once per service:
 *
 *   app.useGlobalFilters(new GlobalExceptionFilter());
 *
 * Catches AppException (and its subclasses), NestJS's built-in
 * HttpException, and anything else unhandled, and normalizes all of them
 * into ErrorResponseBody so every service in the platform returns errors in
 * the same shape.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.toErrorResponse(exception, request.url);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${body.code} ${body.message}`,
        exception instanceof Error ? exception.stack : undefined
      );
    } else {
      this.logger.warn(`${body.code} ${body.message}`);
    }

    response.status(body.statusCode).json(body);
  }

  private toErrorResponse(exception: unknown, path: string): ErrorResponseBody {
    if (exception instanceof AppException) {
      return {
        code: exception.code,
        message: exception.message,
        statusCode: exception.httpStatus,
        timestamp: exception.timestamp,
        path,
        context: exception.context,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string' ? res : (res as { message?: string }).message ?? exception.message;
      return {
        code: HttpStatus[status] ?? 'HTTP_ERROR',
        message: Array.isArray(message) ? message.join('; ') : message,
        statusCode: status,
        timestamp: new Date().toISOString(),
        path,
      };
    }

    // Unknown/unexpected error - never leak internals to the caller.
    return {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: new Date().toISOString(),
      path,
    };
  }
}
