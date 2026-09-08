/**
 * Every event type currently in the checkout saga catalog. Adding a new
 * event means: add it here, add its Zod payload schema in `events/`, and
 * register it in the eventSchemaRegistry (see envelope.ts).
 */
export const EventType = {
  ORDER_CREATED: 'OrderCreated',
  INVENTORY_RESERVED: 'InventoryReserved',
  INVENTORY_RESERVATION_FAILED: 'InventoryReservationFailed',
  PAYMENT_AUTHORIZED: 'PaymentAuthorized',
  PAYMENT_AUTHORIZATION_FAILED: 'PaymentAuthorizationFailed',
  PAYMENT_CAPTURE_REQUESTED: 'PaymentCaptureRequested',
  PAYMENT_CAPTURED: 'PaymentCaptured',
  PAYMENT_CAPTURE_FAILED: 'PaymentCaptureFailed',
  ORDER_CONFIRMED: 'OrderConfirmed',
  ORDER_FAILED: 'OrderFailed',
  INVENTORY_RESERVATION_RELEASED: 'InventoryReservationReleased',
  PAYMENT_AUTHORIZATION_VOIDED: 'PaymentAuthorizationVoided',
} as const;

export type EventTypeValue = (typeof EventType)[keyof typeof EventType];
