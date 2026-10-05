import { roundAmount, roundRate, type RateSource } from "./money"

export interface ReconvertibleRow {
  /** Original currency. */
  currency: string
  original_amount: number
  /** Amount in the old base currency. */
  amount: number
  exchange_rate: number
  rate_source: RateSource
  base_currency: string
}

export type GetRate = (from: string, to: string, date: string) => number

export interface ReconvertResult {
  amount: number
  exchange_rate: number
  base_currency: string
  rate_source: RateSource
  /** Multiplier applied to secondary money fields (new rate / old rate). */
  factor: number
}

/**
 * Pure reconversion of a row to a new base currency. `original_amount` and
 * `currency` are never altered.
 *  - currency == target: rate 1.
 *  - auto rows: historical rate original currency -> target at the row date.
 *  - manual rows: oldRate * rate(oldBase -> target) at the row date; source stays manual.
 */
export function reconvertRow(
  row: ReconvertibleRow,
  target: string,
  getRate: GetRate,
  date: string,
): ReconvertResult {
  let newRate: number
  if (row.currency === target) {
    newRate = 1
  } else if (row.rate_source === "manual") {
    newRate = roundRate(row.exchange_rate * getRate(row.base_currency, target, date))
  } else {
    newRate = roundRate(getRate(row.currency, target, date))
  }
  const oldRate = row.exchange_rate
  return {
    amount: roundAmount(row.original_amount * newRate),
    exchange_rate: newRate,
    base_currency: target,
    rate_source: row.currency === target ? "auto" : row.rate_source,
    factor: oldRate > 0 ? newRate / oldRate : 1,
  }
}
