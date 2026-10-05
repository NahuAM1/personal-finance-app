import { fetchRate } from "@/lib/exchange-rates/client"
import type { ArsRateTypeValue } from "./currencies"
import { buildMoneyFields, type MoneyFields, type RateSource } from "./money"

export interface ResolveMoneyInput {
  /** Original currency of the amount. */
  currency: string
  /** Amount in the original currency. */
  originalAmount: number
  /** Currency the resulting `amount` is expressed in. */
  base: string
  /** Date used for the rate lookup (YYYY-MM-DD). */
  date: string
  rateType: ArsRateTypeValue
  /**
   * Rate to use when the lookup fails (e.g. the provisional rate stored on a recurring
   * service). Without it a failed lookup throws so nothing is saved without a rate.
   */
  fallback?: { rate: number; source: RateSource }
}

/**
 * Resolves the money fields for an amount at a given date: same currency -> rate 1,
 * otherwise the historical rate for that date through the authenticated server route.
 */
export async function resolveMoney(input: ResolveMoneyInput): Promise<MoneyFields> {
  const { currency, originalAmount, base, date, rateType, fallback } = input
  if (currency === base) {
    return buildMoneyFields({ originalAmount, currency, base, rate: 1 })
  }
  try {
    const result = await fetchRate(currency, base, date, rateType)
    return buildMoneyFields({ originalAmount, currency, base, rate: result.rate, source: "auto" })
  } catch (error) {
    if (!fallback) throw error
    return buildMoneyFields({
      originalAmount,
      currency,
      base,
      rate: fallback.rate,
      source: fallback.source,
    })
  }
}

/** Units of `to` per 1 unit of `from` at a date (1 when both currencies are equal). */
export async function resolveRate(
  from: string,
  to: string,
  date: string,
  rateType: ArsRateTypeValue,
): Promise<number> {
  if (from === to) return 1
  return (await fetchRate(from, to, date, rateType)).rate
}
