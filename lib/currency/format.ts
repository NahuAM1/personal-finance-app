const LOCALE = "es-AR"

const standardCache = new Map<string, Intl.NumberFormat>()
const compactCache = new Map<string, Intl.NumberFormat>()

export interface FormatMoneyOptions {
  compact?: boolean
  signDisplay?: "auto" | "always" | "exceptZero" | "never"
}

function getFormatter(currency: string, options: FormatMoneyOptions): Intl.NumberFormat {
  const signDisplay = options.signDisplay ?? "auto"
  const key = `${currency}|${signDisplay}`
  const cache = options.compact ? compactCache : standardCache
  let formatter = cache.get(key)
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat(LOCALE, {
        style: "currency",
        currency,
        signDisplay,
        ...(options.compact
          ? { notation: "compact" as const, maximumFractionDigits: 1 }
          : {}),
      })
    } catch {
      // Unknown currency code (e.g. crypto tickers): fall back to a plain number + code.
      formatter = new Intl.NumberFormat(LOCALE, {
        signDisplay,
        minimumFractionDigits: options.compact ? 0 : 2,
        maximumFractionDigits: options.compact ? 1 : 2,
        ...(options.compact ? { notation: "compact" as const } : {}),
      })
      const plain = formatter
      const wrapper = {
        format: (value: number) => `${plain.format(value)} ${currency}`,
      } as Intl.NumberFormat
      cache.set(key, wrapper)
      return wrapper
    }
    cache.set(key, formatter)
  }
  return formatter
}

/** Formats an amount in the given currency using the es-AR locale. */
export function formatMoney(
  amount: number,
  currency: string = "ARS",
  options: FormatMoneyOptions = {},
): string {
  const value = Number.isFinite(amount) ? amount : 0
  return getFormatter(currency, options).format(value)
}
