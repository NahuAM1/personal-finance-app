/**
 * Server-only exchange rate service (never import from client components).
 *
 * Resolution order for ARS-per-unit rates: cache -> provider -> nearest prior cached value
 * (flagged stale) -> RateUnavailableError (the UI then forces a manual rate).
 */
import { isArsRateType, isSupportedCurrency, type ArsRateTypeValue } from "@/lib/currency/currencies"
import { roundRate } from "@/lib/currency/money"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import * as argentinadatos from "./argentinadatos"
import * as dolarapi from "./dolarapi"
import * as frankfurter from "./frankfurter"

export interface RateResult {
  /** Units of `to` per 1 unit of `from`. */
  rate: number
  /** ARS per 1 `from` unit. Null when the rate came directly from frankfurter. */
  arsPerFrom: number | null
  /** ARS per 1 `to` unit. Null when the rate came directly from frankfurter. */
  arsPerTo: number | null
  source: string
  /** True when a prior cached value was used because providers failed. */
  stale: boolean
  /** True when tarjeta fell back to oficial or a cross used the ARS pivot. */
  fallback: boolean
}

export class RateUnavailableError extends Error {
  constructor(message = "No exchange rate available") {
    super(message)
    this.name = "RateUnavailableError"
  }
}

interface ArsPerUnit {
  value: number
  source: string
  stale: boolean
  fallback: boolean
}

/** Tarjeta quotes only exist from this date; earlier dates fall back to oficial. */
const TARJETA_START = "2019-12-01"

/** Current date in Argentina (UTC-3), as YYYY-MM-DD. */
export function argentinaToday(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Cache (service-role client; the browser can only SELECT)
// ---------------------------------------------------------------------------

function getAdmin() {
  try {
    return createSupabaseAdminClient()
  } catch {
    return null
  }
}

// Today's rate moves intraday, so a cached hit for date >= today is only trusted for a short TTL.
const TODAY_CACHE_TTL_MS = 60 * 60 * 1000

async function readCacheExact(currency: string, type: ArsRateTypeValue, date: string): Promise<number | null> {
  const admin = getAdmin()
  if (!admin) return null
  const { data } = await admin
    .from("exchange_rates")
    .select("ars_per_unit, fetched_at")
    .eq("currency", currency)
    .eq("rate_type", type)
    .eq("rate_date", date)
    .maybeSingle()
  if (data && date >= argentinaToday()) {
    const fetchedAt = Date.parse(String(data.fetched_at))
    if (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt > TODAY_CACHE_TTL_MS) return null
  }
  const value = data ? Number(data.ars_per_unit) : NaN
  return Number.isFinite(value) && value > 0 ? value : null
}

async function readCachePrior(currency: string, type: ArsRateTypeValue, date: string): Promise<number | null> {
  const admin = getAdmin()
  if (!admin) return null
  const { data } = await admin
    .from("exchange_rates")
    .select("ars_per_unit")
    .eq("currency", currency)
    .eq("rate_type", type)
    .lte("rate_date", date)
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle()
  const value = data ? Number(data.ars_per_unit) : NaN
  return Number.isFinite(value) && value > 0 ? value : null
}

async function writeCache(
  currency: string,
  type: ArsRateTypeValue,
  date: string,
  value: number,
  source: string,
): Promise<void> {
  const admin = getAdmin()
  if (!admin) return
  try {
    await admin.from("exchange_rates").upsert(
      {
        currency,
        rate_type: type,
        rate_date: date,
        ars_per_unit: roundRate(value),
        source,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "currency,rate_type,rate_date" },
    )
  } catch (error) {
    console.error("exchange_rates cache write failed:", error)
  }
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

async function usdArsPer(type: ArsRateTypeValue, date: string): Promise<{ value: number; source: string }> {
  if (date >= argentinaToday()) {
    try {
      const current = await dolarapi.fetchCurrentUsd(type)
      if (current !== null) return { value: current, source: "dolarapi" }
    } catch {
      // fall through to the historical series
    }
  }
  const rows = await argentinadatos.fetchUsdHistory(type)
  const prior = argentinadatos.nearestPrior(rows, date)
  if (!prior) throw new RateUnavailableError("No history for that date")
  return { value: prior.value, source: "argentinadatos" }
}

async function officialForeignArsPer(currency: "EUR" | "BRL", date: string): Promise<number | null> {
  try {
    if (date >= argentinaToday()) return await dolarapi.fetchCurrentOfficial(currency)
    // Weekends/holidays: look back a few days (the endpoint returns 404 for missing dates).
    for (let back = 0; back < 4; back++) {
      try {
        const value = await argentinadatos.fetchOfficialOnDate(currency, addDays(date, -back))
        if (value !== null) return value
      } catch {
        // try the previous day
      }
    }
  } catch {
    // provider down: caller falls back to the USD pivot
  }
  return null
}

async function providerArsPer(
  currency: string,
  type: ArsRateTypeValue,
  date: string,
): Promise<{ value: number; source: string }> {
  if (currency === "USD") return usdArsPer(type, date)

  if ((currency === "EUR" || currency === "BRL") && type === "oficial") {
    const direct = await officialForeignArsPer(currency, date)
    if (direct !== null) return { value: direct, source: "argentinadatos" }
  }

  // arsPer_type(USD) * usdPer(X): X not available from argentinadatos, or non-oficial type.
  const usd = await usdArsPer(type, date)
  const usdPerX = await frankfurter.fetchCross(currency, "USD", date >= argentinaToday() ? "latest" : date)
  if (usdPerX === null) throw new RateUnavailableError()
  return { value: usd.value * usdPerX, source: "derived" }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** ARS per 1 unit of `currency` for the date and rate type, with cache and fallbacks. */
export async function getArsPerUnit(
  currency: string,
  type: ArsRateTypeValue,
  requestedDate: string,
): Promise<ArsPerUnit> {
  if (currency === "ARS") return { value: 1, source: "identity", stale: false, fallback: false }

  const today = argentinaToday()
  const date = requestedDate > today ? today : requestedDate

  let effectiveType = type
  let fallback = false
  if (type === "tarjeta" && date < TARJETA_START) {
    effectiveType = "oficial"
    fallback = true
  }

  const cached = await readCacheExact(currency, effectiveType, date)
  if (cached !== null) return { value: cached, source: "cache", stale: false, fallback }

  try {
    const provided = await providerArsPer(currency, effectiveType, date)
    await writeCache(currency, effectiveType, date, provided.value, provided.source)
    return { value: provided.value, source: provided.source, stale: false, fallback }
  } catch {
    const prior = await readCachePrior(currency, effectiveType, date)
    if (prior !== null) return { value: prior, source: "cache", stale: true, fallback }
    throw new RateUnavailableError()
  }
}

/** Resolves units of `to` per 1 unit of `from` on `date` (spec R3-R6). */
export async function getRate(
  from: string,
  to: string,
  date: string,
  type: ArsRateTypeValue = "oficial",
): Promise<RateResult> {
  if (!isSupportedCurrency(from) || !isSupportedCurrency(to) || !isArsRateType(type)) {
    throw new RateUnavailableError("Unsupported currency or rate type")
  }
  if (from === to) {
    return { rate: 1, arsPerFrom: null, arsPerTo: null, source: "identity", stale: false, fallback: false }
  }

  if (to === "ARS") {
    const a = await getArsPerUnit(from, type, date)
    return {
      rate: roundRate(a.value),
      arsPerFrom: a.value,
      arsPerTo: 1,
      source: a.source,
      stale: a.stale,
      fallback: a.fallback,
    }
  }

  if (from === "ARS") {
    const a = await getArsPerUnit(to, type, date)
    return {
      rate: roundRate(1 / a.value),
      arsPerFrom: 1,
      arsPerTo: a.value,
      source: a.source,
      stale: a.stale,
      fallback: a.fallback,
    }
  }

  // Neither side is ARS: frankfurter directly, ARS pivot only as a flagged fallback.
  const today = argentinaToday()
  try {
    const direct = await frankfurter.fetchCross(from, to, date >= today ? "latest" : date)
    if (direct !== null) {
      return {
        rate: roundRate(direct),
        arsPerFrom: null,
        arsPerTo: null,
        source: "frankfurter",
        stale: false,
        fallback: false,
      }
    }
  } catch {
    // fall back to the pivot below
  }

  const [f, t] = await Promise.all([getArsPerUnit(from, type, date), getArsPerUnit(to, type, date)])
  return {
    rate: roundRate(f.value / t.value),
    arsPerFrom: f.value,
    arsPerTo: t.value,
    source: "ars-pivot",
    stale: f.stale || t.stale,
    fallback: true,
  }
}

/**
 * Bulk-fills the cache for a set of dates so later lookups are cache hits. Missing dates are
 * resolved with limited concurrency. Failures are swallowed: individual lookups report them.
 */
export async function ensureHistory(
  currency: string,
  type: ArsRateTypeValue,
  dates: string[],
): Promise<void> {
  if (currency === "ARS") return
  const unique = Array.from(new Set(dates))
  if (unique.length === 0) return

  const admin = getAdmin()
  const cachedDates = new Set<string>()
  if (admin) {
    const { data } = await admin
      .from("exchange_rates")
      .select("rate_date")
      .eq("currency", currency)
      .eq("rate_type", type)
      .in("rate_date", unique)
    for (const row of data ?? []) cachedDates.add(row.rate_date as string)
  }

  const missing = unique.filter((d) => !cachedDates.has(d))
  const CONCURRENCY = 5
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    await Promise.all(
      missing.slice(i, i + CONCURRENCY).map((d) => getArsPerUnit(currency, type, d).catch(() => null)),
    )
  }
}
