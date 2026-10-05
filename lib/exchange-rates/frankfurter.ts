import { fetchJson, isValidDateString, toNumber } from "./http"

const HOST = "https://api.frankfurter.dev"

interface FrankfurterResponse {
  date?: string
  rates?: Record<string, number>
}

/**
 * Units of `to` per 1 unit of `from` for the given date. Frankfurter resolves weekends and
 * holidays to the nearest prior business day. Both codes must be allowlisted by the caller.
 */
export async function fetchCross(from: string, to: string, date: string | "latest"): Promise<number | null> {
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) throw new Error("Invalid currency code")
  if (date !== "latest" && !isValidDateString(date)) throw new Error("Invalid date")
  const path = date === "latest" ? "latest" : date
  const data = await fetchJson<FrankfurterResponse>(`${HOST}/v1/${path}?base=${from}&symbols=${to}`)
  return toNumber(data.rates?.[to])
}
