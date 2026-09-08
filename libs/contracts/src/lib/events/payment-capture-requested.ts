import { z } from 'zod';

/**
 * Published by Order Service once BOTH InventoryReserved and
 * PaymentAuthorized have been received for the same order - this is the
 * "gate" in the gated-capture saga design. Consumed by Payment Service to
 * actually capture the previously authorized charge.
 */
export const paymentCaptureRequestedPayloadSchema = z.object({
  orderId: z.uuid(),
  paymentIntentId: z.string(),
});

export type PaymentCaptureRequestedPayload = z.infer<
  typeof paymentCaptureRequestedPayloadSchema
>;
