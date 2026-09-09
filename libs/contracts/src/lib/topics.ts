/**
 * Topic-per-aggregate strategy: every event about a given aggregate goes to
 * the same topic, keyed by aggregateId. This preserves per-aggregate
 * ordering (e.g. PaymentAuthorized is always processed before
 * PaymentCaptured for the same order) which the checkout saga's
 * correctness depends on. See docs/01_architecture_decisions.md.
 */
export const KafkaTopics = {
  ORDER_EVENTS: 'order-events',
  PAYMENT_EVENTS: 'payment-events',
  CATALOG_EVENTS: 'catalog-events',
  USER_EVENTS: 'user-events',
} as const;

export type KafkaTopic = (typeof KafkaTopics)[keyof typeof KafkaTopics];
