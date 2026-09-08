import { z } from 'zod';

/**
 * Published by Payment Service after voiding a previously successful
 * auth-hold, as a compensating action in response to OrderFailed. Purely
 * informational downstream (mainly useful for observability/tracing the
 * saga's compensation path).
 */
export const paymentAuthorizationVoidedPayloadSchema = z.object({
  orderId: z.uuid(),
  paymentIntentId: z.string(),
});

export type PaymentAuthorizationVoidedPayload = z.infer<
  typeof paymentAuthorizationVoidedPayloadSchema
>;
