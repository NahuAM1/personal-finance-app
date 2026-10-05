import type { ArsRateTypeValue } from "@/lib/currency/currencies"
import { fetchJson, toNumber } from "./http"

const HOST = "https://api.argentinadatos.com"

const CASA: Record<ArsRateTypeValue, string> = {
  oficial: "oficial",
  blue: "blue",
  bolsa: "bolsa",
  tarjeta: "tarjeta",
}

interface HistoryEntry {
  fecha?: string
  venta?: number | null
}

export interface DatedRate {
  date: string
  value: number
}

const HISTORY_TTL_MS = 60 * 60 * 1000
const historyMemo = new Map<string, { at: number; rows: DatedRate[] }>()

/** Full USD history (ARS per USD, venta side) sorted ascending by date. Memoized per process for 1 hour. */
export async function fetchUsdHistory(type: ArsRateTypeValue): Promise<DatedRate[]> {
  const memo = historyMemo.get(type)
  if (memo && Date.now() - memo.at < HISTORY_TTL_MS) return memo.rows

  const data = await fetchJson<HistoryEntry[]>(`${HOST}/v1/cotizaciones/dolares/${CASA[type]}`)
  const rows: DatedRate[] = []
  for (const entry of Array.isArray(data) ? data : []) {
    const value = toNumber(entry.venta)
    if (value !== null && typeof entry.fecha === "string") {
      rows.push({ date: entry.fecha, value })
    }
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  if (rows.length === 0) throw new Error("Empty history")
  historyMemo.set(type, { at: Date.now(), rows })
  return rows
}

/** Value of the nearest entry on or before `date` (carries weekends and holidays forward). */
export function nearestPrior(rows: DatedRate[], date: string): DatedRate | null {
  let lo = 0
  let hi = rows.length - 1
  let found: DatedRate | null = null
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (rows[mid].date <= date) {
      found = rows[mid]
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found
}

/**
 * Official ARS per 1 unit for EUR / BRL on a single date (YYYY-MM-DD). The endpoint is not
 * verified for every date, so the caller treats any failure as "provider unavailable".
 */
export async function fetchOfficialOnDate(
  currency: "EUR" | "BRL",
  date: string,
): Promise<number | null> {
  const [year, month, day] = date.split("-")
  const segment = currency === "EUR" ? "eur" : "brl"
  const data = await fetchJson<HistoryEntry>(
    `${HOST}/v1/cotizaciones/${segment}/${year}/${month}/${day}`,
  )
  return toNumber(data.venta)
}
