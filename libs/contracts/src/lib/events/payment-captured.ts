import { z } from 'zod';

/**
 * Published by Payment Service after the Stripe capture succeeds. Consumed
 * by Order Service to confirm the order, and by Notification Service to
 * send an order confirmation.
 */
export const paymentCapturedPayloadSchema = z.object({
  orderId: z.uuid(),
  paymentIntentId: z.string(),
  capturedAmountCents: z.number().int().positive(),
});

export type PaymentCapturedPayload = z.infer<typeof paymentCapturedPayloadSchema>;
