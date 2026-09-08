import { z } from 'zod';

/**
 * Published by Payment Service if capture fails after a successful
 * auth-hold (rare, but possible - e.g. the hold expired, or a late-stage
 * gateway error). Consumed by Order Service to trigger full compensation
 * (release inventory reservation, void the auth-hold if still voidable).
 */
export const paymentCaptureFailedPayloadSchema = z.object({
  orderId: z.uuid(),
  paymentIntentId: z.string(),
  reason: z.enum(['HOLD_EXPIRED', 'GATEWAY_ERROR', 'UNKNOWN']),
});

export type PaymentCaptureFailedPayload = z.infer<typeof paymentCaptureFailedPayloadSchema>;
