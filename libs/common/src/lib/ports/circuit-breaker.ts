/**
 * Shared contract for circuit-breaker-wrapped calls. The actual `opossum`
 * wiring is implemented per-adapter (e.g. the REST client adapter in
 * Order Service wrapping calls to Product Catalog, or the Stripe adapter in
 * Payment Service) in later stages - this interface just standardizes the
 * shape so every wrapped call looks the same regardless of which adapter
 * it lives in.
 */
export interface CircuitBreakerOptions {
  /** Time in ms before a request is considered timed out. */
  timeoutMs: number;
  /** % of failures within the rolling window that trips the breaker open. */
  errorThresholdPercentage: number;
  /** Time in ms the breaker stays open before allowing a trial request. */
  resetTimeoutMs: number;
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * A callable that has been wrapped with circuit-breaker behavior. `fire`
 * mirrors opossum's own API naming so adapters built against this
 * interface map directly onto an opossum-backed implementation.
 */
export interface CircuitBreakerPort<TInput, TOutput> {
  fire(input: TInput): Promise<TOutput>;
  getState(): CircuitBreakerState;
}
