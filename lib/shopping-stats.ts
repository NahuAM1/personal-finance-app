import type { Ticket, TicketItem } from "@/types/database";

export type TicketWithItems = Ticket & {
  ticket_items?: TicketItem[] | null;
};

export interface ProductStat {
  name: string;
  display_name: string;
  category: string;
  purchases_90d: number;
  last_purchase: string;
  days_since_last: number;
  avg_gap_days: number | null;
  typical_price_ars: number;
  typical_quantity: number;
  stores: string[];
  ticket_ids: string[];
}

export type DataQuality = "scarce" | "ok" | "good";

export interface ShoppingDataSummary {
  total_tickets_90d: number;
  total_items_90d: number;
  oldest_ticket: string | null;
  newest_ticket: string | null;
  data_quality: DataQuality;
  note: string;
}

const NOISE_PATTERNS: readonly string[] = [
  "mas club",
  "bolsa cliente",
  "bolsa disco",
  "descuento",
  "bolsa verde",
];

const PERISHABLE_CATEGORIES: ReadonlySet<string> = new Set([
  "Carnes",
  "Panadería",
  "Frutas y Verduras",
  "Lácteos",
]);

const NOISE_PRICE_THRESHOLD = 100;

export function normalizeProductName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isNoiseItem(item: TicketItem): boolean {
  if (item.quantity <= 0) return true;
  if (item.total_price < NOISE_PRICE_THRESHOLD) return true;

  const normalized: string = normalizeProductName(item.product_name);
  if (normalized.length === 0) return true;

  return NOISE_PATTERNS.some((pattern) => normalized.includes(pattern));
}

interface AggregateOptions {
  today?: Date;
  windowDays?: number;
}

interface ProductBucket {
  display_name: string;
  category: string;
  dates: string[];
  prices: number[];
  quantities: number[];
  stores: Set<string>;
  ticket_ids: Set<string>;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid: number = Math.floor(sorted.length / 2);
  return sorted[mid];
}

function daysBetween(fromIso: string, toIso: string): number {
  const a: number = new Date(fromIso).getTime();
  const b: number = new Date(toIso).getTime();
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

export function aggregateProductStats(
  tickets: TicketWithItems[],
  options: AggregateOptions = {},
): ProductStat[] {
  const today: Date = options.today ?? new Date();
  const windowDays: number = options.windowDays ?? 90;
  const cutoff: Date = new Date(
    today.getTime() - windowDays * 24 * 60 * 60 * 1000,
  );

  const byKey = new Map<string, ProductBucket>();

  for (const ticket of tickets) {
    if (new Date(ticket.ticket_date) < cutoff) continue;

    const items: TicketItem[] = ticket.ticket_items ?? [];
    for (const item of items) {
      if (isNoiseItem(item)) continue;

      const key: string = normalizeProductName(item.product_name);
      if (key.length === 0) continue;

      let bucket: ProductBucket | undefined = byKey.get(key);
      if (bucket === undefined) {
        bucket = {
          display_name: item.product_name.trim(),
          category: item.category ?? "Otros",
          dates: [],
          prices: [],
          quantities: [],
          stores: new Set<string>(),
          ticket_ids: new Set<string>(),
        };
        byKey.set(key, bucket);
      }

      bucket.dates.push(ticket.ticket_date);
      bucket.prices.push(item.total_price);
      bucket.quantities.push(item.quantity);
      bucket.stores.add(ticket.store_name);
      bucket.ticket_ids.add(ticket.id);
    }
  }

  const stats: ProductStat[] = [];
  byKey.forEach((bucket: ProductBucket, key: string) => {
    if (bucket.dates.length === 0) return;

    const sortedDates: string[] = [...bucket.dates].sort();
    const lastDate: string | undefined = sortedDates[sortedDates.length - 1];
    if (lastDate === undefined) return;
    const daysSince: number = daysBetween(lastDate, today.toISOString());

    let avgGap: number | null = null;
    if (sortedDates.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < sortedDates.length; i++) {
        const previous: string | undefined = sortedDates[i - 1];
        const current: string | undefined = sortedDates[i];
        if (previous === undefined || current === undefined) return;
        gaps.push(daysBetween(previous, current));
      }
      if (gaps.length > 0) {
        avgGap = Math.round(
          gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length,
        );
      }
    }

    const sortedPrices: number[] = [...bucket.prices].sort((a, b) => a - b);
    const sortedQuantities: number[] = [...bucket.quantities].sort(
      (a, b) => a - b,
    );

    stats.push({
      name: key,
      display_name: bucket.display_name,
      category: bucket.category,
      purchases_90d: bucket.dates.length,
      last_purchase: lastDate,
      days_since_last: daysSince,
      avg_gap_days: avgGap,
      typical_price_ars: Math.round(median(sortedPrices)),
      typical_quantity: median(sortedQuantities),
      stores: Array.from(bucket.stores),
      ticket_ids: Array.from(bucket.ticket_ids),
    });
  });

  return stats.sort((a, b) => b.days_since_last - a.days_since_last);
}

export interface MonthlyCandidateOptions {
  minAvgGapDays?: number;
  minDaysSinceLast?: number;
  perishableCategories?: ReadonlySet<string>;
}

export function filterMonthlyCandidates(
  stats: ProductStat[],
  options: MonthlyCandidateOptions = {},
): ProductStat[] {
  const minAvgGap: number = options.minAvgGapDays ?? 14;
  const minDaysSince: number = options.minDaysSinceLast ?? 14;
  const perishables: ReadonlySet<string> =
    options.perishableCategories ?? PERISHABLE_CATEGORIES;

  return stats.filter((stat) => {
    if (perishables.has(stat.category)) return false;
    if (stat.days_since_last < minDaysSince) return false;
    if (stat.avg_gap_days !== null && stat.avg_gap_days < minAvgGap) return false;
    return true;
  });
}

export function buildShoppingSummary(
  tickets: TicketWithItems[],
  options: AggregateOptions = {},
): ShoppingDataSummary {
  const today: Date = options.today ?? new Date();
  const windowDays: number = options.windowDays ?? 90;
  const cutoff: Date = new Date(
    today.getTime() - windowDays * 24 * 60 * 60 * 1000,
  );

  const inWindow: TicketWithItems[] = tickets.filter(
    (t) => new Date(t.ticket_date) >= cutoff,
  );
  const totalItems: number = inWindow.reduce(
    (sum, t) =>
      sum + (t.ticket_items ?? []).filter((i) => !isNoiseItem(i)).length,
    0,
  );

  let dataQuality: DataQuality;
  let note: string;

  if (inWindow.length < 3) {
    dataQuality = "scarce";
    note = `Solo tengo ${inWindow.length} ticket${
      inWindow.length === 1 ? "" : "s"
    } de los últimos ${windowDays} días. Las recomendaciones serán tentativas. Escaneá más tickets para mejorar la precisión.`;
  } else if (inWindow.length < 8) {
    dataQuality = "ok";
    note = `Tengo ${inWindow.length} tickets de los últimos ${windowDays} días. Las recomendaciones son razonables.`;
  } else {
    dataQuality = "good";
    note = `Tengo ${inWindow.length} tickets de los últimos ${windowDays} días. Las recomendaciones son confiables.`;
  }

  const dates: string[] = inWindow.map((t) => t.ticket_date).sort();

  return {
    total_tickets_90d: inWindow.length,
    total_items_90d: totalItems,
    oldest_ticket: dates[0] ?? null,
    newest_ticket: dates[dates.length - 1] ?? null,
    data_quality: dataQuality,
    note,
  };
}
