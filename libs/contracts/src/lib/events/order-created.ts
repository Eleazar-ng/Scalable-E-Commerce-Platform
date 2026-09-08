import { z } from 'zod';

/**
 * Published by Order Service once a pending order is created. Consumed
 * independently by both Product Catalog Service (to reserve inventory) and
 * Payment Service (to auth-hold payment) - this is the fan-out point of the
 * choreography.
 */
export const orderCreatedPayloadSchema = z.object({
  orderId: z.uuid(),
  customerId: z.uuid(),
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        quantity: z.number().int().positive(),
        unitPriceCents: z.number().int().nonnegative(),
      })
    )
    .min(1),
  totalAmountCents: z.number().int().nonnegative(),
  currency: z.string().length(3), // ISO 4217, e.g. "USD"
});

export type OrderCreatedPayload = z.infer<typeof orderCreatedPayloadSchema>;
