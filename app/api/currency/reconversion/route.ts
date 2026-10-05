import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { isArsRateType, isSupportedCurrency, type ArsRateTypeValue } from '@/lib/currency/currencies';
import { reconvertRow, type ReconvertibleRow } from '@/lib/currency/reconvert';
import { roundAmount, type RateSource } from '@/lib/currency/money';
import { argentinaToday, getRate } from '@/lib/exchange-rates/service';
import { recalculateAllBalances } from '@/lib/balances';
import type { Database } from '@/types/database';

// Reconversion job: client-driven. `POST {targetBase}` starts it, `POST {step: true}` runs one
// batch (BATCH rows), `GET` returns the status. Rows are tracked by their own `base_currency`
// (idempotent: converted rows are skipped), so a retry after a failure never double-converts.

const BATCH = 200;
const RATE_CONCURRENCY = 8;
// Providers have no data before this date: older rows use the first available day.
const EARLIEST_RATE_DATE = '2011-01-04';

interface TableConfig {
  table: string;
  /** Column holding the base-currency amount of the row. */
  amountColumn: 'amount' | 'total_amount';
  /** Other base-currency columns scaled by newRate / oldRate. */
  secondary: string[];
  /** Select list (including the parent join used for the reference date). */
  select: string;
  /** Applies the "belongs to this user" filter. */
  scope: (query: any, userId: string) => any;
  /** Reference date for the historical rate: the row date, the parent date, or today. */
  dateOf: (row: Record<string, any>) => string;
}

const byUser = (query: any, userId: string) => query.eq('user_id', userId);

const TABLES: TableConfig[] = [
  {
    table: 'transactions',
    amountColumn: 'amount',
    secondary: [],
    select: '*',
    scope: byUser,
    dateOf: (row) => row.date,
  },
  {
    table: 'credit_purchases',
    amountColumn: 'total_amount',
    secondary: ['monthly_amount'],
    select: '*',
    scope: byUser,
    dateOf: (row) => row.start_date,
  },
  {
    table: 'credit_installments',
    amountColumn: 'amount',
    secondary: [],
    select: '*, credit_purchases!inner(start_date, user_id)',
    scope: (query, userId) => query.eq('credit_purchases.user_id', userId),
    dateOf: (row) => row.credit_purchases.start_date,
  },
  {
    table: 'loans',
    amountColumn: 'total_amount',
    secondary: ['principal_amount'],
    select: '*',
    scope: byUser,
    dateOf: (row) => row.start_date,
  },
  {
    table: 'loan_payments',
    amountColumn: 'amount',
    secondary: [],
    select: '*, loans!inner(start_date, user_id)',
    scope: (query, userId) => query.eq('loans.user_id', userId),
    dateOf: (row) => row.loans.start_date,
  },
  {
    table: 'services',
    amountColumn: 'amount',
    secondary: [],
    select: '*',
    scope: byUser,
    dateOf: () => argentinaToday(),
  },
  {
    table: 'investments',
    amountColumn: 'amount',
    secondary: ['estimated_return', 'actual_return'],
    select: '*',
    scope: byUser,
    dateOf: (row) => row.start_date,
  },
];

interface Settings {
  base_currency: string;
  ars_rate_type: string;
  pending_base_currency: string | null;
  reconversion_status: 'idle' | 'running' | 'failed';
}

function clampDate(date: string): string {
  const today = argentinaToday();
  if (date > today) return today;
  return date < EARLIEST_RATE_DATE ? EARLIEST_RATE_DATE : date;
}

async function loadSettings(admin: SupabaseClient, userId: string): Promise<Settings> {
  const { data, error } = await admin
    .from('user_settings')
    .select('base_currency, ars_rate_type, pending_base_currency, reconversion_status')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as Settings;

  const { error: insertError } = await admin.from('user_settings').insert({ user_id: userId });
  if (insertError) throw insertError;
  return {
    base_currency: 'ARS',
    ars_rate_type: 'oficial',
    pending_base_currency: null,
    reconversion_status: 'idle',
  };
}

async function countRemaining(admin: SupabaseClient, userId: string, target: string): Promise<number> {
  let remaining = 0;
  for (const config of TABLES) {
    const query = config.scope(
      admin.from(config.table).select(config.select.includes('!inner') ? config.select : 'id', {
        count: 'exact',
        head: true,
      }),
      userId
    );
    const { count, error } = await query.neq('base_currency', target);
    if (error) throw error;
    remaining += count ?? 0;
  }
  return remaining;
}

/** The (from, to) pair whose rate a row needs; null when the row is already in the target currency. */
function neededPair(row: ReconvertibleRow, target: string): [string, string] | null {
  if (row.currency === target) return null;
  return row.rate_source === 'manual' ? [row.base_currency, target] : [row.currency, target];
}

async function preloadRates(
  pairs: Map<string, { from: string; to: string; date: string }>,
  rateType: ArsRateTypeValue
): Promise<{ rates: Map<string, number>; approximate: Set<string> }> {
  const rates = new Map<string, number>();
  // Keys whose rate came from a stale cache entry or a fallback path (rate_source only allows auto|manual).
  const approximate = new Set<string>();
  const entries = Array.from(pairs.entries());
  for (let i = 0; i < entries.length; i += RATE_CONCURRENCY) {
    await Promise.all(
      entries.slice(i, i + RATE_CONCURRENCY).map(async ([key, { from, to, date }]) => {
        if (from === to) {
          rates.set(key, 1);
          return;
        }
        const result = await getRate(from, to, clampDate(date), rateType);
        rates.set(key, result.rate);
        if (result.stale || result.fallback) approximate.add(key);
      })
    );
  }
  return { rates, approximate };
}

/** Converts one batch from the first table that still has pending rows. Returns rows processed. */
async function runBatch(
  admin: SupabaseClient,
  userId: string,
  target: string,
  rateType: ArsRateTypeValue
): Promise<{ processed: number; approximated: number }> {
  for (const config of TABLES) {
    const { data, error } = await config
      .scope(admin.from(config.table).select(config.select), userId)
      .neq('base_currency', target)
      .order('id')
      .limit(BATCH);
    if (error) throw error;
    const rows = (data ?? []) as Record<string, any>[];
    if (rows.length === 0) continue;

    const asRow = (row: Record<string, any>): ReconvertibleRow => ({
      currency: row.currency,
      original_amount: Number(row.original_amount),
      amount: Number(row[config.amountColumn]),
      exchange_rate: Number(row.exchange_rate),
      rate_source: row.rate_source as RateSource,
      base_currency: row.base_currency,
    });

    // Preload every rate the batch needs, so conversion itself is synchronous and pure.
    const pairs = new Map<string, { from: string; to: string; date: string }>();
    for (const row of rows) {
      const pair = neededPair(asRow(row), target);
      if (!pair) continue;
      const date = config.dateOf(row);
      pairs.set(`${pair[0]}|${pair[1]}|${date}`, { from: pair[0], to: pair[1], date });
    }
    const { rates, approximate } = await preloadRates(pairs, rateType);
    let approximated = 0;

    for (const row of rows) {
      const date = config.dateOf(row);
      const pair = neededPair(asRow(row), target);
      if (pair && approximate.has(`${pair[0]}|${pair[1]}|${date}`)) {
        approximated++;
        console.warn(`Reconversion used a stale/fallback rate: ${config.table} ${row.id} (${pair[0]}->${pair[1]} on ${date})`);
      }
      const result = reconvertRow(
        asRow(row),
        target,
        (from, to, d) => {
          const rate = rates.get(`${from}|${to}|${d}`);
          if (rate === undefined) throw new Error(`Missing rate ${from}->${to} on ${d}`);
          return rate;
        },
        date
      );

      const update: Record<string, unknown> = {
        [config.amountColumn]: result.amount,
        exchange_rate: result.exchange_rate,
        rate_source: result.rate_source,
        base_currency: result.base_currency,
      };
      for (const column of config.secondary) {
        const value = row[column];
        if (value !== null && value !== undefined) update[column] = roundAmount(Number(value) * result.factor);
      }

      // The base_currency guard keeps this idempotent under concurrent or repeated runs.
      const { error: updateError } = await admin
        .from(config.table)
        .update(update)
        .eq('id', row.id)
        .neq('base_currency', target);
      if (updateError) throw updateError;
    }
    return { processed: rows.length, approximated };
  }
  return { processed: 0, approximated: 0 };
}

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const admin = createSupabaseAdminClient();
    const settings = await loadSettings(admin, user.id);
    const remaining = settings.pending_base_currency
      ? await countRemaining(admin, user.id, settings.pending_base_currency)
      : 0;
    return NextResponse.json({
      status: settings.reconversion_status,
      baseCurrency: settings.base_currency,
      pendingBase: settings.pending_base_currency,
      remaining,
    });
  } catch (error) {
    console.error('Error reading reconversion status:', error);
    return NextResponse.json({ error: 'No se pudo leer el estado' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let body: { targetBase?: unknown; step?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  try {
    const settings = await loadSettings(admin, user.id);

    // ---- Start (or resume) a job
    if (typeof body.targetBase === 'string') {
      const target = body.targetBase;
      if (!isSupportedCurrency(target)) {
        return NextResponse.json({ error: 'Moneda no soportada' }, { status: 400 });
      }
      if (settings.reconversion_status === 'running' && settings.pending_base_currency !== target) {
        return NextResponse.json(
          { error: 'Ya hay una reconversión en curso hacia otra moneda' },
          { status: 409 }
        );
      }
      if (settings.reconversion_status !== 'running') {
        const { error } = await admin
          .from('user_settings')
          .update({
            pending_base_currency: target,
            reconversion_status: 'running',
            reconversion_started_at: new Date().toISOString(),
            reconversion_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
        if (error) throw error;
      }
      const remaining = await countRemaining(admin, user.id, target);
      return NextResponse.json({ status: 'running', pendingBase: target, remaining });
    }

    // ---- Run one batch
    if (body.step === true) {
      const target = settings.pending_base_currency;
      if (!target || settings.reconversion_status === 'idle') {
        return NextResponse.json({ error: 'No hay una reconversión en curso' }, { status: 400 });
      }
      const rateType: ArsRateTypeValue = isArsRateType(settings.ars_rate_type)
        ? settings.ars_rate_type
        : 'oficial';

      if (settings.reconversion_status === 'failed') {
        // Retry: the failed job resumes where it stopped.
        await admin
          .from('user_settings')
          .update({ reconversion_status: 'running', reconversion_error: null })
          .eq('user_id', user.id);
      }

      try {
        const { processed, approximated } = await runBatch(admin, user.id, target, rateType);
        if (processed > 0) {
          const remaining = await countRemaining(admin, user.id, target);
          return NextResponse.json({ done: false, processed, remaining, approximated });
        }

        // Nothing left: recalculate balances in date order, then switch the base currency.
        await recalculateAllBalances(user.id, admin as unknown as SupabaseClient<Database>);
        const { error } = await admin
          .from('user_settings')
          .update({
            base_currency: target,
            pending_base_currency: null,
            reconversion_status: 'idle',
            reconversion_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
        if (error) throw error;
        return NextResponse.json({ done: true, processed: 0, remaining: 0, approximated: 0, baseCurrency: target });
      } catch (jobError) {
        const message = jobError instanceof Error ? jobError.message : 'Error desconocido';
        console.error('Reconversion step failed:', jobError);
        await admin
          .from('user_settings')
          .update({ reconversion_status: 'failed', reconversion_error: message.slice(0, 500) })
          .eq('user_id', user.id);
        return NextResponse.json({ error: message, status: 'failed' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
  } catch (error) {
    console.error('Error in reconversion route:', error);
    return NextResponse.json({ error: 'No se pudo procesar la reconversión' }, { status: 500 });
  }
}
