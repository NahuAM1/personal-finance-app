import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

// Server-safe module: it never imports the browser Supabase client. Callers pass their own client.

// PostgREST caps a response at 1000 rows (max-rows), so reads must be paginated.
const PAGE_SIZE = 1000

export interface BalanceRow {
  id: string
  type: string
  amount: number
  date: string
  created_at: string
}

/** Reads every transaction of a user in deterministic order (date, created_at, id), page by page. */
export async function fetchAllTransactionsOrdered<TCols extends string = string>(
  client: SupabaseClient<Database>,
  userId: string,
  columns: TCols | "*" = "*"
): Promise<any[]> {
  const all: any[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from("transactions")
      .select(columns)
      .eq("user_id", userId)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    const page = data ?? []
    all.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return all
}

// Recompute balance_total for every transaction of a user in date order.
// Used after a bulk import or a base-currency reconversion to keep the cumulative balance coherent.
export async function recalculateAllBalances(
  userId: string,
  client: SupabaseClient<Database>
): Promise<void> {
  const rows = (await fetchAllTransactionsOrdered(client, userId, "id, type, amount, date, created_at")) as BalanceRow[]
  if (rows.length === 0) return

  let running = 0
  const BATCH = 50
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    const results = await Promise.all(
      slice.map((r) => {
        running = r.type === "income" ? running + r.amount : running - r.amount
        const newBalance = running
        return client
          .from("transactions")
          .update({ balance_total: newBalance })
          .eq("id", r.id)
          .eq("user_id", userId)
      })
    )
    for (const result of results) {
      if (result.error) throw result.error
    }
  }
}
