import { HttpStatus } from '@nestjs/common';
import {
  ConflictException,
  DomainException,
  ExternalServiceException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  ValidationException,
} from './exceptions';

describe('exception taxonomy', () => {
  it('ValidationException maps to 400 and is not retryable', () => {
    const err = new ValidationException('bad input', { field: 'email' });
    expect(err.httpStatus).toBe(HttpStatus.BAD_REQUEST);
    expect(err.retryable).toBe(false);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.context).toEqual({ field: 'email' });
  });

  it('NotFoundException maps to 404', () => {
    const err = new NotFoundException('order not found');
    expect(err.httpStatus).toBe(HttpStatus.NOT_FOUND);
    expect(err.retryable).toBe(false);
  });

  it('ConflictException maps to 409', () => {
    const err = new ConflictException('duplicate order');
    expect(err.httpStatus).toBe(HttpStatus.CONFLICT);
  });

  it('DomainException maps to 422', () => {
    const err = new DomainException('cannot capture unauthorized payment');
    expect(err.httpStatus).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(err.code).toBe('DOMAIN_RULE_VIOLATION');
  });

  it('ExternalServiceException defaults to retryable=true', () => {
    const err = new ExternalServiceException('stripe timeout');
    expect(err.retryable).toBe(true);
    expect(err.httpStatus).toBe(HttpStatus.BAD_GATEWAY);
  });

  it('ExternalServiceException allows overriding retryable to false', () => {
    const err = new ExternalServiceException('stripe rejected card', { retryable: false });
    expect(err.retryable).toBe(false);
  });

  it('UnauthorizedException and ForbiddenException map to 401/403', () => {
    expect(new UnauthorizedException().httpStatus).toBe(HttpStatus.UNAUTHORIZED);
    expect(new ForbiddenException().httpStatus).toBe(HttpStatus.FORBIDDEN);
  });

  it('every exception carries an ISO timestamp', () => {
    const err = new NotFoundException('x');
    expect(() => new Date(err.timestamp).toISOString()).not.toThrow();
  });
});
