import { z } from 'zod';

/**
 * Published by Product Catalog Service after successfully reserving stock
 * for every line item in an order. Consumed by Order Service to check
 * whether both saga branches (inventory + payment) have now succeeded.
 */
export const inventoryReservedPayloadSchema = z.object({
  orderId: z.uuid(),
  reservationId: z.uuid(),
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
});

export type InventoryReservedPayload = z.infer<typeof inventoryReservedPayloadSchema>;
