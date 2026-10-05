export const SUPPORTED_CURRENCIES = [
  "ARS",
  "USD",
  "EUR",
  "BRL",
  "GBP",
  "CHF",
  "JPY",
  "CAD",
  "AUD",
  "MXN",
  "CNY",
] as const

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]

export const ARS_RATE_TYPES = ["oficial", "blue", "bolsa", "tarjeta"] as const

export type ArsRateTypeValue = (typeof ARS_RATE_TYPES)[number]

export const DEFAULT_BASE_CURRENCY: CurrencyCode = "ARS"
export const DEFAULT_ARS_RATE_TYPE: ArsRateTypeValue = "oficial"

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  ARS: "Peso argentino",
  USD: "Dólar estadounidense",
  EUR: "Euro",
  BRL: "Real brasileño",
  GBP: "Libra esterlina",
  CHF: "Franco suizo",
  JPY: "Yen japonés",
  CAD: "Dólar canadiense",
  AUD: "Dólar australiano",
  MXN: "Peso mexicano",
  CNY: "Yuan chino",
}

export const ARS_RATE_TYPE_LABELS: Record<ArsRateTypeValue, string> = {
  oficial: "Oficial",
  blue: "Blue",
  bolsa: "Bolsa (MEP)",
  tarjeta: "Tarjeta",
}

export function isSupportedCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
}

export function isArsRateType(value: unknown): value is ArsRateTypeValue {
  return typeof value === "string" && (ARS_RATE_TYPES as readonly string[]).includes(value)
}
