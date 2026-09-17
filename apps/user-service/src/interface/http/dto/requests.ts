import { z } from 'zod';

export const registerRequestSchema = z.object({
  email: z.email(),
  // Deliberately not enforcing composition rules (uppercase/symbol/etc.)
  // here - length is the strongest practical signal, per current NIST
  // guidance (SP 800-63B), which argues against forced composition rules.
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const updateProfileRequestSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
