import { z } from 'zod';

/**
 * Published by Payment Service when the Stripe auth-hold fails (card
 * declined, gateway error, etc.). Consumed by Order Service to trigger
 * compensation on the inventory branch, if it already succeeded.
 */
export const paymentAuthorizationFailedPayloadSchema = z.object({
  orderId: z.uuid(),
  reason: z.enum(['CARD_DECLINED', 'GATEWAY_ERROR', 'INSUFFICIENT_FUNDS', 'UNKNOWN']),
  gatewayErrorCode: z.string().optional(), // raw Stripe error code, for logs
});

export type PaymentAuthorizationFailedPayload = z.infer<
  typeof paymentAuthorizationFailedPayloadSchema
>;
