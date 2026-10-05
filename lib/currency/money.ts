export type RateSource = "auto" | "manual"

export interface MoneyFields {
  /** Amount in the user's base currency: round2(original_amount * exchange_rate). */
  amount: number
  /** Amount in the original currency. */
  original_amount: number
  /** Original currency code. */
  currency: string
  /** Base units per 1 original unit. */
  exchange_rate: number
  rate_source: RateSource
  /** Currency that `amount` and `exchange_rate` are expressed in. */
  base_currency: string
}

/** Rounds half up (away from zero for negatives is not needed: amounts are non-negative). */
function roundHalfUp(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0
  const factor = Math.pow(10, decimals)
  const scaled = Math.abs(value) * factor
  // Number.EPSILON scaled guards against binary representation errors (e.g. 1.005 -> 1.00).
  const rounded = Math.floor(scaled + 0.5 + Number.EPSILON * scaled)
  return (Math.sign(value) * rounded) / factor
}

/** Amounts are stored with 2 decimals, rounded half up. */
export function roundAmount(value: number): number {
  return roundHalfUp(value, 2)
}

/** Rates are stored with up to 10 decimals. */
export function roundRate(value: number): number {
  return roundHalfUp(value, 10)
}

export function convert(amount: number, rate: number): number {
  return roundAmount(amount * rate)
}

export interface BuildMoneyFieldsInput {
  originalAmount: number
  currency: string
  base: string
  rate: number
  source?: RateSource
}

/**
 * Builds the money pattern for a row. Enforces amount = round2(original * rate)
 * and rate = 1 when the currency equals the base currency.
 */
export function buildMoneyFields({
  originalAmount,
  currency,
  base,
  rate,
  source = "auto",
}: BuildMoneyFieldsInput): MoneyFields {
  const sameCurrency = currency === base
  const exchange_rate = sameCurrency ? 1 : roundRate(rate)
  const original_amount = roundAmount(originalAmount)
  return {
    amount: sameCurrency ? original_amount : convert(original_amount, exchange_rate),
    original_amount,
    currency,
    exchange_rate,
    rate_source: sameCurrency ? "auto" : source,
    base_currency: base,
  }
}
