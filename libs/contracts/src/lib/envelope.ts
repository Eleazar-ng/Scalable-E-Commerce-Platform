import { randomUUID } from 'crypto';
import { z } from 'zod';
import { EventType, EventTypeValue } from './event-type';
import { orderCreatedPayloadSchema } from './events/order-created';
import { inventoryReservedPayloadSchema } from './events/inventory-reserved';
import { inventoryReservationFailedPayloadSchema } from './events/inventory-reservation-failed';
import { paymentAuthorizedPayloadSchema } from './events/payment-authorized';
import { paymentAuthorizationFailedPayloadSchema } from './events/payment-authorization-failed';
import { paymentCaptureRequestedPayloadSchema } from './events/payment-capture-requested';
import { paymentCapturedPayloadSchema } from './events/payment-captured';
import { paymentCaptureFailedPayloadSchema } from './events/payment-capture-failed';
import { orderConfirmedPayloadSchema } from './events/order-confirmed';
import { orderFailedPayloadSchema } from './events/order-failed';
import { inventoryReservationReleasedPayloadSchema } from './events/inventory-reservation-released';
import { paymentAuthorizationVoidedPayloadSchema } from './events/payment-authorization-voided';
import { userRegisteredPayloadSchema } from './events/user-registered';

/**
 * Every event in the platform is wrapped in this envelope. `correlationId`
 * is what ties every event in a single checkout saga instance together -
 * always propagate the same correlationId from OrderCreated through to the
 * saga's terminal event (OrderConfirmed/OrderFailed) and its compensations.
 */
export const eventEnvelopeSchema = z.object({
  eventId: z.uuid(),
  eventType: z.string(),
  aggregateType: z.string(),
  aggregateId: z.uuid(),
  correlationId: z.uuid(),
  occurredAt: z.iso.datetime(),
  version: z.number().int().positive(),
  payload: z.unknown(),
});

export type EventEnvelope<TPayload = unknown> = Omit<
  z.infer<typeof eventEnvelopeSchema>,
  'payload'
> & { payload: TPayload };

/**
 * Maps each EventType to its payload schema. Used by the kafka-client lib
 * to validate a message's payload against the correct schema once the
 * envelope's `eventType` field is known - this is what makes the consumer
 * adapter generic instead of needing a switch statement per service.
 */
export const eventSchemaRegistry = {
  [EventType.ORDER_CREATED]: orderCreatedPayloadSchema,
  [EventType.INVENTORY_RESERVED]: inventoryReservedPayloadSchema,
  [EventType.INVENTORY_RESERVATION_FAILED]: inventoryReservationFailedPayloadSchema,
  [EventType.PAYMENT_AUTHORIZED]: paymentAuthorizedPayloadSchema,
  [EventType.PAYMENT_AUTHORIZATION_FAILED]: paymentAuthorizationFailedPayloadSchema,
  [EventType.PAYMENT_CAPTURE_REQUESTED]: paymentCaptureRequestedPayloadSchema,
  [EventType.PAYMENT_CAPTURED]: paymentCapturedPayloadSchema,
  [EventType.PAYMENT_CAPTURE_FAILED]: paymentCaptureFailedPayloadSchema,
  [EventType.ORDER_CONFIRMED]: orderConfirmedPayloadSchema,
  [EventType.ORDER_FAILED]: orderFailedPayloadSchema,
  [EventType.INVENTORY_RESERVATION_RELEASED]: inventoryReservationReleasedPayloadSchema,
  [EventType.PAYMENT_AUTHORIZATION_VOIDED]: paymentAuthorizationVoidedPayloadSchema,
  [EventType.USER_REGISTERED]: userRegisteredPayloadSchema,
} as const satisfies Record<EventTypeValue, z.ZodType>;

/**
 * Builds a fully-formed, schema-valid envelope for a given event type.
 * Throws (via Zod) if the payload doesn't match that event type's schema -
 * this is the point at which a producer's bug gets caught immediately,
 * before anything reaches Kafka or an outbox row.
 */
export function createEventEnvelope<TEventType extends EventTypeValue>(params: {
  eventType: TEventType;
  aggregateType: string;
  aggregateId: string;
  correlationId: string;
  payload: z.infer<(typeof eventSchemaRegistry)[TEventType]>;
}): EventEnvelope {
  const schema = eventSchemaRegistry[params.eventType];
  const validatedPayload = schema.parse(params.payload);

  return {
    eventId: randomUUID(),
    eventType: params.eventType,
    aggregateType: params.aggregateType,
    aggregateId: params.aggregateId,
    correlationId: params.correlationId,
    occurredAt: new Date().toISOString(),
    version: 1,
    payload: validatedPayload,
  };
}

/**
 * Validates a raw envelope (e.g. just parsed from a Kafka message) against
 * both the envelope shape and the payload schema for its declared
 * eventType. Returns the payload typed to that event, or throws.
 */
export function parseEventEnvelope(raw: unknown): EventEnvelope {
  const envelope = eventEnvelopeSchema.parse(raw);
  const schema = eventSchemaRegistry[envelope.eventType as EventTypeValue];

  if (!schema) {
    throw new Error(`Unknown eventType "${envelope.eventType}" - no schema registered`);
  }

  return {
    ...envelope,
    payload: schema.parse(envelope.payload),
  };
}
