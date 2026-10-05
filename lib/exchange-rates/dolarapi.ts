import type { ArsRateTypeValue } from "@/lib/currency/currencies"
import { fetchJson, toNumber } from "./http"

const HOST = "https://dolarapi.com"

/** dolarapi path segment per ARS rate type (allowlist: never built from user input). */
const CASA: Record<ArsRateTypeValue, string> = {
  oficial: "oficial",
  blue: "blue",
  bolsa: "bolsa",
  tarjeta: "tarjeta",
}

interface DolarApiQuote {
  venta?: number | null
}

/** Current ARS per 1 USD for the given rate type (venta side). */
export async function fetchCurrentUsd(type: ArsRateTypeValue): Promise<number | null> {
  const data = await fetchJson<DolarApiQuote>(`${HOST}/v1/dolares/${CASA[type]}`)
  return toNumber(data.venta)
}

/** Current official ARS per 1 unit for EUR / BRL. */
export async function fetchCurrentOfficial(currency: "EUR" | "BRL"): Promise<number | null> {
  const segment = currency === "EUR" ? "eur" : "brl"
  const data = await fetchJson<DolarApiQuote>(`${HOST}/v1/cotizaciones/${segment}`)
  return toNumber(data.venta)
}
