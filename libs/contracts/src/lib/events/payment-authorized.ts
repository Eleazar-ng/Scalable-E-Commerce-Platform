import { z } from 'zod';

/**
 * Published by Payment Service after successfully placing an auth-hold via
 * Stripe (PaymentIntent in "requires_capture" status). Consumed by Order
 * Service to check whether both saga branches have now succeeded.
 */
export const paymentAuthorizedPayloadSchema = z.object({
  orderId: z.uuid(),
  paymentIntentId: z.string(), // Stripe PaymentIntent id
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
});

export type PaymentAuthorizedPayload = z.infer<typeof paymentAuthorizedPayloadSchema>;
