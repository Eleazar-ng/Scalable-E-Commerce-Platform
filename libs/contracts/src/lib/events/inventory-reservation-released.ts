import { z } from 'zod';

/**
 * Published by Product Catalog Service after releasing a previously
 * successful inventory reservation, as a compensating action in response to
 * OrderFailed. Purely informational downstream (mainly useful for
 * observability/tracing the saga's compensation path).
 */
export const inventoryReservationReleasedPayloadSchema = z.object({
  orderId: z.uuid(),
  reservationId: z.uuid(),
});

export type InventoryReservationReleasedPayload = z.infer<
  typeof inventoryReservationReleasedPayloadSchema
>;
