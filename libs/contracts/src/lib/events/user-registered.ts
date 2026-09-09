import { z } from 'zod';

/**
 * Published by User Service after a new user successfully registers.
 * Not part of the checkout saga - a standalone domain event. Consumed by
 * Notification Service (Stage 6) to send a welcome email. Deliberately
 * excludes the password hash and any other sensitive field - only what a
 * downstream consumer legitimately needs.
 */
export const userRegisteredPayloadSchema = z.object({
  userId: z.uuid(),
  email: z.email(),
  firstName: z.string().min(1),
});

export type UserRegisteredPayload = z.infer<typeof userRegisteredPayloadSchema>;
