import { PipeTransform, Injectable } from '@nestjs/common';
import { z, ZodError, ZodType } from 'zod';
import { ValidationException } from '../errors/exceptions';

/**
 * Generic NestJS pipe that validates a request body (or param/query) against
 * a Zod schema, consistent with how the `contracts` lib validates Kafka
 * event payloads - one validation library across the whole platform rather
 * than mixing in class-validator for REST.
 *
 * Usage:
 *   @Post('register')
 *   register(@Body(new ZodValidationPipe(registerRequestSchema)) dto: RegisterRequest) { ... }
 *
 * On failure, throws a ValidationException (common's exception taxonomy),
 * which GlobalExceptionFilter formats consistently with every other error
 * in the platform - not a raw Zod error or Nest's default 400 shape.
 */
@Injectable()
export class ZodValidationPipe<TSchema extends ZodType> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.infer<TSchema> {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new ValidationException('Request validation failed', {
        issues: this.formatIssues(result.error),
      });
    }

    return result.data;
  }

  private formatIssues(error: ZodError): Array<{ path: string; message: string }> {
    return error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  }
}
