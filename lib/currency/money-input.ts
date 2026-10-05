import { buildMoneyFields, type MoneyFields, type RateSource } from "./money"

/**
 * Form state for an amount entered in any currency. `currency: null` means "the user's base
 * currency", so forms never have to wait for the settings to load before rendering.
 */
export interface MoneyInputState {
  amount: string
  currency: string | null
  rate: string
  rateSource: RateSource
}

export function emptyMoneyInput(): MoneyInputState {
  return { amount: "", currency: null, rate: "", rateSource: "auto" }
}

/** Formats a numeric rate for an input (no exponent notation, trailing zeros trimmed). */
export function formatRateInput(rate: number): string {
  if (!Number.isFinite(rate)) return ""
  return rate.toFixed(10).replace(/0+$/, "").replace(/\.$/, "")
}

/** Parses a user-typed decimal. A dot or a comma is accepted as the decimal separator. */
export function parseDecimal(value: string): number {
  const normalized = value.trim().replace(",", ".")
  if (normalized === "") return NaN
  return Number(normalized)
}

/**
 * Converts form state into persistable money fields, or null when the amount or the rate
 * is missing or invalid (the caller must not save in that case).
 */
export function moneyInputToFields(state: MoneyInputState, base: string): MoneyFields | null {
  const currency = state.currency ?? base
  const amount = parseDecimal(state.amount)
  if (!Number.isFinite(amount) || amount < 0) return null

  if (currency === base) {
    return buildMoneyFields({ originalAmount: amount, currency, base, rate: 1, source: "auto" })
  }

  const rate = parseDecimal(state.rate)
  if (!Number.isFinite(rate) || rate <= 0) return null
  return buildMoneyFields({
    originalAmount: amount,
    currency,
    base,
    rate,
    source: state.rateSource,
  })
}
