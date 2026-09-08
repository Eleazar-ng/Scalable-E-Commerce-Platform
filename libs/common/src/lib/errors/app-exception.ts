import { HttpStatus } from '@nestjs/common';

/**
 * Additional structured context attached to an AppException.
 * Kept intentionally loose (Record<string, unknown>) so each call site can
 * attach whatever is relevant (service name, operation, correlation id,
 * downstream identifiers, etc.) without needing to extend a rigid shape.
 */
export type ErrorContext = Record<string, unknown>;

export interface AppExceptionOptions {
  /** Stable, machine-readable error code, e.g. "ORDER_NOT_FOUND" */
  code: string;
  /** Human-readable message, safe to log and (usually) safe to surface */
  message: string;
  /** HTTP status this maps to when surfaced via the REST layer */
  httpStatus: HttpStatus;
  /** Whether the *cause* of this error is expected to succeed on retry */
  retryable: boolean;
  /** Freeform structured context for logs/observability */
  context?: ErrorContext;
  /** Original error, if this exception wraps a lower-level failure */
  cause?: unknown;
}

/**
 * Base exception for all application/domain errors across every service.
 *
 * This is the single type the global ExceptionFilter (see exception.filter.ts)
 * knows how to format consistently. Prefer one of the subclasses below over
 * throwing AppException directly, unless none of them fit.
 */
export class AppException extends Error {
  public readonly code: string;
  public readonly httpStatus: HttpStatus;
  public readonly retryable: boolean;
  public readonly context: ErrorContext;
  public readonly cause?: unknown;
  public readonly timestamp: string;

  constructor(options: AppExceptionOptions) {
    super(options.message);
    this.name = this.constructor.name;
    this.code = options.code;
    this.httpStatus = options.httpStatus;
    this.retryable = options.retryable;
    this.context = options.context ?? {};
    this.cause = options.cause;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace (V8 only, no-op elsewhere)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
