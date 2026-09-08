import { z } from 'zod';

/**
 * Published by Order Service once payment capture succeeds - the saga's
 * happy-path terminal event. Consumed by Notification Service to send an
 * order confirmation.
 */
export const orderConfirmedPayloadSchema = z.object({
  orderId: z.uuid(),
  customerId: z.uuid(),
  confirmedAt: z.iso.datetime(),
});

export type OrderConfirmedPayload = z.infer<typeof orderConfirmedPayloadSchema>;
