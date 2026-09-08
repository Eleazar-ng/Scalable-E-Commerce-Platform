import { z } from 'zod';

/**
 * Published by Order Service whenever any branch of the saga fails
 * (inventory reservation, payment authorization, or capture) - the saga's
 * failure terminal event. Consumed by Product Catalog Service and Payment
 * Service to release/void whichever branch had already succeeded, and by
 * Notification Service to inform the customer.
 */
export const orderFailedPayloadSchema = z.object({
  orderId: z.uuid(),
  customerId: z.uuid(),
  failedStage: z.enum(['INVENTORY_RESERVATION', 'PAYMENT_AUTHORIZATION', 'PAYMENT_CAPTURE']),
  reason: z.string(),
});

export type OrderFailedPayload = z.infer<typeof orderFailedPayloadSchema>;
