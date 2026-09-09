/**
 * Internal domain event raised by the User aggregate. Deliberately NOT the
 * same type as the Kafka contract (UserRegisteredPayload in the contracts
 * lib) - the domain layer stays free of any dependency on Kafka/outbox
 * concerns. The application layer (handlers, Stage 2.3) is responsible for
 * translating a UserDomainEvent into a contracts-lib envelope + outbox row.
 */
export type UserDomainEvent = {
  type: 'UserRegistered';
  userId: string;
  email: string;
  firstName: string;
};
