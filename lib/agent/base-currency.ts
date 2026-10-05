import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { formatMoney } from '@/lib/currency/format';

export type MoneyFormatter = (amount: number) => string;

/** The user's base currency (ARS when no settings row exists). */
export async function getBaseCurrency(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from('user_settings')
    .select('base_currency')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as { base_currency?: string } | null)?.base_currency ?? 'ARS';
}

/** Formatter for amounts expressed in the given currency (used in agent prompts and answers). */
export function makeMoney(currency: string): MoneyFormatter {
  return (amount: number) => formatMoney(amount, currency);
}
