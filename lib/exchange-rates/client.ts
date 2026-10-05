/** Browser helper: looks rates up through the authenticated server route (never the providers). */
import type { ArsRateTypeValue } from "@/lib/currency/currencies"

export interface FetchedRate {
  rate: number
  arsPerFrom: number | null
  arsPerTo: number | null
  source: string
  stale: boolean
  fallback: boolean
}

export class RateLookupError extends Error {
  /** True when the user must type the rate manually (no provider and no cache). */
  readonly manualRequired: boolean
  constructor(message: string, manualRequired: boolean) {
    super(message)
    this.name = "RateLookupError"
    this.manualRequired = manualRequired
  }
}

const memo = new Map<string, Promise<FetchedRate>>()

function clampToToday(date: string): string {
  const today = new Date().toLocaleDateString("en-CA") // YYYY-MM-DD in the local timezone
  return date > today ? today : date
}

/** Units of `to` per 1 unit of `from` on `date`. Results are memoized per session. */
export function fetchRate(
  from: string,
  to: string,
  date: string,
  type: ArsRateTypeValue = "oficial",
): Promise<FetchedRate> {
  if (from === to) {
    return Promise.resolve({
      rate: 1,
      arsPerFrom: null,
      arsPerTo: null,
      source: "identity",
      stale: false,
      fallback: false,
    })
  }

  const day = clampToToday(date)
  const key = `${from}|${to}|${day}|${type}`
  const existing = memo.get(key)
  if (existing) return existing

  const params = new URLSearchParams({ from, to, date: day, type })
  const request = fetch(`/api/exchange-rates?${params.toString()}`)
    .then(async (response) => {
      if (response.ok) return (await response.json()) as FetchedRate
      const body = await response.json().catch(() => ({}))
      throw new RateLookupError(
        (body as { error?: string }).error ?? "No se pudo obtener la cotización",
        response.status === 503,
      )
    })
    .catch((error) => {
      memo.delete(key) // never memoize failures
      if (error instanceof RateLookupError) throw error
      throw new RateLookupError("No se pudo obtener la cotización", true)
    })

  memo.set(key, request)
  return request
}
