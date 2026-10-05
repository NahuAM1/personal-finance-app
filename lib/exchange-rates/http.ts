/** Shared helpers for the outbound rate providers. Only the 3 fixed hosts are ever contacted. */

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function isValidDateString(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export async function fetchJson<T = unknown>(url: string): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
    headers: { Accept: "application/json" },
  })
  if (!response.ok) {
    throw new Error(`Provider responded ${response.status}`)
  }
  return (await response.json()) as T
}

export function toNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}
