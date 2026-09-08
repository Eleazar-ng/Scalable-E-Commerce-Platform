import { HttpStatus } from '@nestjs/common';
import { AppException, ErrorContext } from './app-exception';

/**
 * Input failed validation (bad request body, invalid query params, a Zod
 * parse failure at a service boundary, etc.). Never retryable — the caller
 * must fix the input.
 */
export class ValidationException extends AppException {
  constructor(message: string, context?: ErrorContext, cause?: unknown) {
    super({
      code: 'VALIDATION_ERROR',
      message,
      httpStatus: HttpStatus.BAD_REQUEST,
      retryable: false,
      context,
      cause,
    });
  }
}

/**
 * A requested resource/aggregate does not exist.
 */
export class NotFoundException extends AppException {
  constructor(message: string, context?: ErrorContext) {
    super({
      code: 'NOT_FOUND',
      message,
      httpStatus: HttpStatus.NOT_FOUND,
      retryable: false,
      context,
    });
  }
}

/**
 * The request conflicts with current state (e.g. optimistic concurrency
 * failure, duplicate resource, invalid state transition). Not retryable
 * as-is; the caller needs to re-read state and decide what to do.
 */
export class ConflictException extends AppException {
  constructor(message: string, context?: ErrorContext) {
    super({
      code: 'CONFLICT',
      message,
      httpStatus: HttpStatus.CONFLICT,
      retryable: false,
      context,
    });
  }
}

/**
 * A business/domain rule was violated (e.g. "cannot capture a payment that
 * was never authorized"). Distinct from ConflictException because this is
 * about domain invariants, not optimistic-concurrency/state races.
 */
export class DomainException extends AppException {
  constructor(message: string, context?: ErrorContext) {
    super({
      code: 'DOMAIN_RULE_VIOLATION',
      message,
      httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
      retryable: false,
      context,
    });
  }
}

/**
 * A downstream/external dependency failed (another microservice over REST,
 * Stripe, Kafka broker unreachable, etc.). `retryable` defaults to true
 * since most external failures are transient, but callers can override this
 * when they know better (e.g. a 4xx from a downstream service is usually not
 * retryable, a 5xx or network timeout usually is).
 *
 * Consumed downstream by the exponential backoff / circuit breaker logic:
 * only retryable ExternalServiceExceptions should be retried automatically.
 */
export class ExternalServiceException extends AppException {
  constructor(
    message: string,
    options: { retryable?: boolean; context?: ErrorContext; cause?: unknown } = {}
  ) {
    super({
      code: 'EXTERNAL_SERVICE_ERROR',
      message,
      httpStatus: HttpStatus.BAD_GATEWAY,
      retryable: options.retryable ?? true,
      context: options.context,
      cause: options.cause,
    });
  }
}

/**
 * Caller is not authenticated, or their credentials are invalid/expired.
 */
export class UnauthorizedException extends AppException {
  constructor(message = 'Unauthorized', context?: ErrorContext) {
    super({
      code: 'UNAUTHORIZED',
      message,
      httpStatus: HttpStatus.UNAUTHORIZED,
      retryable: false,
      context,
    });
  }
}

/**
 * Caller is authenticated but not permitted to perform this action.
 */
export class ForbiddenException extends AppException {
  constructor(message = 'Forbidden', context?: ErrorContext) {
    super({
      code: 'FORBIDDEN',
      message,
      httpStatus: HttpStatus.FORBIDDEN,
      retryable: false,
      context,
    });
  }
}
