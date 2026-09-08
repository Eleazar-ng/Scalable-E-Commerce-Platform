import { z } from 'zod';

/**
 * Published by Product Catalog Service when one or more line items could
 * not be reserved (e.g. insufficient stock). Consumed by Order Service to
 * trigger compensation on the payment branch, if it already succeeded.
 */
export const inventoryReservationFailedPayloadSchema = z.object({
  orderId: z.uuid(),
  reason: z.enum(['INSUFFICIENT_STOCK', 'PRODUCT_NOT_FOUND', 'UNKNOWN']),
  failedItems: z
    .array(
      z.object({
        productId: z.uuid(),
        requestedQuantity: z.number().int().positive(),
        availableQuantity: z.number().int().nonnegative(),
      })
    )
    .optional(),
});

export type InventoryReservationFailedPayload = z.infer<
  typeof inventoryReservationFailedPayloadSchema
>;
