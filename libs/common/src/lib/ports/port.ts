/**
 * Naming/shape convention for "ports" (the interface half of ports &
 * adapters) across the platform. Not every port will fit this exact shape,
 * but default to it unless there's a good reason not to - consistency here
 * makes every adapter (Stripe, Resend/SendGrid, etc.) predictable to read.
 *
 * Example:
 *
 *   export interface PaymentGatewayPort extends Port<AuthorizeInput, AuthorizeResult> {
 *     authorize(input: AuthorizeInput): Promise<AuthorizeResult>;
 *     capture(paymentIntentId: string): Promise<CaptureResult>;
 *     ...
 *   }
 */
export interface Port<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}

/**
 * Marker interface for adapters implementing a Port. Adapters live in each
 * service (e.g. `StripePaymentAdapter implements PaymentGatewayPort`) - this
 * module only defines the shared shape/conventions, not concrete adapters.
 */
export type Adapter<TPort> = TPort;
