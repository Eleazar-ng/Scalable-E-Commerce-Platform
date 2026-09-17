import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';
import { ValidationException } from '../errors/exceptions';

describe('ZodValidationPipe', () => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().int().positive(),
  });

  it('returns the parsed value when valid', () => {
    const pipe = new ZodValidationPipe(schema);
    const result = pipe.transform({ email: 'jane@example.com', age: 30 });
    expect(result).toEqual({ email: 'jane@example.com', age: 30 });
  });

  it('throws a ValidationException on invalid input', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(() => pipe.transform({ email: 'not-an-email', age: -1 })).toThrow(ValidationException);
  });

  it('includes formatted per-field issues in the exception context', () => {
    const pipe = new ZodValidationPipe(schema);
    try {
      pipe.transform({ email: 'not-an-email', age: -1 });
      fail('expected transform to throw');
    } catch (error) {
      const exception = error as ValidationException;
      expect(exception.context['issues']).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'email' }),
          expect.objectContaining({ path: 'age' }),
        ])
      );
    }
  });

  it('strips unknown fields not defined in the schema (default Zod object behavior)', () => {
    const pipe = new ZodValidationPipe(schema);
    const result = pipe.transform({ email: 'jane@example.com', age: 30, extra: 'ignored' });
    expect(result).toEqual({ email: 'jane@example.com', age: 30 });
  });
});
