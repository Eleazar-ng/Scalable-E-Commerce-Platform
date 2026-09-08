import { randomUUID } from 'crypto';
import { createEventEnvelope, parseEventEnvelope } from './envelope';
import { EventType } from './event-type';

describe('createEventEnvelope', () => {
  it('builds a valid envelope for OrderCreated', () => {
    const orderId = randomUUID();
    const correlationId = randomUUID();

    const envelope = createEventEnvelope({
      eventType: EventType.ORDER_CREATED,
      aggregateType: 'Order',
      aggregateId: orderId,
      correlationId,
      payload: {
        orderId,
        customerId: randomUUID(),
        items: [{ productId: randomUUID(), quantity: 2, unitPriceCents: 1500 }],
        totalAmountCents: 3000,
        currency: 'USD',
      },
    });

    expect(envelope.eventType).toBe('OrderCreated');
    expect(envelope.aggregateId).toBe(orderId);
    expect(envelope.correlationId).toBe(correlationId);
    expect(envelope.version).toBe(1);
    expect(envelope.eventId).toBeDefined();
    expect(() => new Date(envelope.occurredAt).toISOString()).not.toThrow();
  });

  it('throws when the payload does not match the event type schema', () => {
    expect(() =>
      createEventEnvelope({
        eventType: EventType.ORDER_CREATED,
        aggregateType: 'Order',
        aggregateId: randomUUID(),
        correlationId: randomUUID(),
        // @ts-expect-error - deliberately invalid payload for the test
        payload: { orderId: 'not-a-uuid' },
      })
    ).toThrow();
  });
});

describe('parseEventEnvelope', () => {
  it('round-trips a valid envelope', () => {
    const orderId = randomUUID();
    const original = createEventEnvelope({
      eventType: EventType.INVENTORY_RESERVED,
      aggregateType: 'Order',
      aggregateId: orderId,
      correlationId: randomUUID(),
      payload: {
        orderId,
        reservationId: randomUUID(),
        items: [{ productId: randomUUID(), quantity: 1 }],
      },
    });

    const parsed = parseEventEnvelope(JSON.parse(JSON.stringify(original)));
    expect(parsed).toEqual(original);
  });

  it('throws on an unknown eventType', () => {
    expect(() =>
      parseEventEnvelope({
        eventId: randomUUID(),
        eventType: 'SomeUnregisteredEvent',
        aggregateType: 'Order',
        aggregateId: randomUUID(),
        correlationId: randomUUID(),
        occurredAt: new Date().toISOString(),
        version: 1,
        payload: {},
      })
    ).toThrow(/Unknown eventType/);
  });

  it('throws when the envelope itself is malformed', () => {
    expect(() => parseEventEnvelope({ not: 'an envelope' })).toThrow();
  });
});
