// Pure business logic for trips (no I/O). Keep it framework-free so it can be
// unit tested later.
import type { TripMember, TripExpense, TripExpenseShare } from '@/types/database';

export type SplitMethod = 'equal' | 'custom' | 'percentage';

export type TripExpenseWithShares = TripExpense & { trip_expense_shares: TripExpenseShare[] };

export interface ShareInput {
  member_id: string;
  share_amount: number;
}

export type ComputeSharesResult =
  | { ok: true; shares: ShareInput[] }
  | { ok: false; error: string };

export const TRIP_EXPENSE_CATEGORIES = [
  'Alojamiento',
  'Transporte',
  'Comida',
  'Actividades',
  'Compras',
  'Otros',
] as const;

export const UNCATEGORIZED_LABEL = 'Sin categoría';

// Allows e.g. 33.33% x 3 = 99.99%; the cent remainder goes to the last share.
const PERCENT_TOLERANCE = 0.1;

export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function roundMoney(value: number): number {
  return fromCents(toCents(value));
}

function parseNumber(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Splits `amount` among members.
 * - equal: every member in `memberIds` gets the same share; the cent remainder
 *   goes to the last share.
 * - custom: `input[memberId]` is an amount; must add up to `amount`.
 * - percentage: `input[memberId]` is a percentage; must add up to 100.
 * For custom/percentage, members with a 0 value do not participate. The
 * rounding remainder always goes to the last participating share, so shares
 * add up exactly to `amount`.
 */
export function computeShares(
  amount: number,
  method: SplitMethod,
  memberIds: string[],
  input: Record<string, string | number> = {}
): ComputeSharesResult {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'El monto debe ser mayor a cero' };
  }
  const totalCents = toCents(amount);

  if (method === 'equal') {
    if (memberIds.length === 0) {
      return { ok: false, error: 'Elegí al menos una persona para dividir el gasto' };
    }
    const base = Math.floor(totalCents / memberIds.length);
    const remainder = totalCents - base * memberIds.length;
    return {
      ok: true,
      shares: memberIds.map((id, index) => ({
        member_id: id,
        share_amount: fromCents(index === memberIds.length - 1 ? base + remainder : base),
      })),
    };
  }

  const values = memberIds.map((id) => ({ id, value: parseNumber(input[id]) }));
  if (values.some((v) => v.value < 0)) {
    return { ok: false, error: 'Los valores no pueden ser negativos' };
  }
  const participants = values.filter((v) => v.value > 0);
  if (participants.length === 0) {
    return { ok: false, error: 'Asigná un valor a al menos una persona' };
  }

  if (method === 'custom') {
    const sum = participants.reduce((acc, p) => acc + p.value, 0);
    if (Math.abs(toCents(sum) - totalCents) >= 1) {
      return {
        ok: false,
        error: `La suma de las partes (${sum.toFixed(2)}) no coincide con el monto total (${amount.toFixed(2)})`,
      };
    }
    const cents = participants.map((p) => toCents(p.value));
    const diff = totalCents - cents.reduce((a, b) => a + b, 0);
    cents[cents.length - 1] += diff;
    return {
      ok: true,
      shares: participants.map((p, i) => ({ member_id: p.id, share_amount: fromCents(cents[i]) })),
    };
  }

  // percentage
  const totalPct = participants.reduce((acc, p) => acc + p.value, 0);
  if (Math.abs(totalPct - 100) > PERCENT_TOLERANCE) {
    return { ok: false, error: `Los porcentajes suman ${totalPct.toFixed(1)}%, deben sumar 100%` };
  }
  const cents = participants.map((p) => Math.round((totalCents * p.value) / 100));
  const diff = totalCents - cents.reduce((a, b) => a + b, 0);
  cents[cents.length - 1] += diff;
  return {
    ok: true,
    shares: participants.map((p, i) => ({ member_id: p.id, share_amount: fromCents(cents[i]) })),
  };
}

// ============================================
// Summary
// ============================================

export interface CategoryTotal {
  category: string;
  total: number;
  percentage: number;
}

export interface MemberSummary {
  memberId: string;
  name: string;
  paid: number;
  consumed: number;
}

export interface TripSummary {
  totalSpent: number;
  budget: number | null;
  budgetUsedPct: number | null;
  byCategory: CategoryTotal[];
  byMember: MemberSummary[];
}

export function summarizeTrip(
  budget: number | null,
  members: Pick<TripMember, 'id' | 'display_name'>[],
  expenses: TripExpenseWithShares[]
): TripSummary {
  let totalCents = 0;
  const categoryCents = new Map<string, number>();
  const paidCents = new Map<string, number>();
  const consumedCents = new Map<string, number>();

  for (const expense of expenses) {
    const amountCents = toCents(Number(expense.amount));
    totalCents += amountCents;
    const category = expense.category?.trim() || UNCATEGORIZED_LABEL;
    categoryCents.set(category, (categoryCents.get(category) || 0) + amountCents);
    paidCents.set(
      expense.paid_by_member_id,
      (paidCents.get(expense.paid_by_member_id) || 0) + amountCents
    );
    for (const share of expense.trip_expense_shares || []) {
      consumedCents.set(
        share.member_id,
        (consumedCents.get(share.member_id) || 0) + toCents(Number(share.share_amount))
      );
    }
  }

  const byCategory: CategoryTotal[] = Array.from(categoryCents.entries())
    .map(([category, cents]) => ({
      category,
      total: fromCents(cents),
      percentage: totalCents > 0 ? (cents / totalCents) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const byMember: MemberSummary[] = members.map((m) => ({
    memberId: m.id,
    name: m.display_name,
    paid: fromCents(paidCents.get(m.id) || 0),
    consumed: fromCents(consumedCents.get(m.id) || 0),
  }));

  const normalizedBudget = budget != null && Number(budget) > 0 ? Number(budget) : null;

  return {
    totalSpent: fromCents(totalCents),
    budget: normalizedBudget,
    budgetUsedPct: normalizedBudget ? (fromCents(totalCents) / normalizedBudget) * 100 : null,
    byCategory,
    byMember,
  };
}

// ============================================
// Balances & settlements
// ============================================

export interface DebtSettlement {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

/**
 * Net balance per member considering ONLY unsettled shares owed to someone
 * else. A settled share is neutral for both the payer and the debtor, and the
 * payer's own share never counts. Positive = is owed money, negative = owes.
 */
export function calculateBalances(
  members: Pick<TripMember, 'id'>[],
  expenses: TripExpenseWithShares[]
): Map<string, number> {
  const cents = new Map<string, number>();
  for (const m of members) cents.set(m.id, 0);

  for (const expense of expenses) {
    const payer = expense.paid_by_member_id;
    for (const share of expense.trip_expense_shares || []) {
      if (share.is_settled || share.member_id === payer) continue;
      const amount = toCents(Number(share.share_amount));
      cents.set(payer, (cents.get(payer) || 0) + amount);
      cents.set(share.member_id, (cents.get(share.member_id) || 0) - amount);
    }
  }

  const balances = new Map<string, number>();
  cents.forEach((value, key) => balances.set(key, fromCents(value)));
  return balances;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Debts to settle, netted per pair of members from unsettled shares.
 *
 * Each settlement maps exactly to a set of shares between those two members
 * (see `getSharesToSettle`), so marking them settled clears the debt without
 * leaving drift. A global greedy debtor->creditor simplification is NOT used
 * on purpose: a simplified transfer (A pays C on behalf of B) does not map to
 * any set of shares, so settling it would leave balances inconsistent.
 * Results are sorted largest first; amounts below one cent are ignored.
 */
export function calculateSettlements(
  members: Pick<TripMember, 'id'>[],
  expenses: TripExpenseWithShares[]
): DebtSettlement[] {
  const memberIds = new Set(members.map((m) => m.id));
  // Net cents owed per unordered pair, signed from the perspective of the
  // lexicographically smaller id: positive = smaller id owes the larger one.
  const pairCents = new Map<string, number>();

  for (const expense of expenses) {
    const payer = expense.paid_by_member_id;
    for (const share of expense.trip_expense_shares || []) {
      const debtor = share.member_id;
      if (share.is_settled || debtor === payer) continue;
      if (!memberIds.has(debtor) || !memberIds.has(payer)) continue;
      const amount = toCents(Number(share.share_amount));
      const key = pairKey(debtor, payer);
      const sign = debtor < payer ? 1 : -1;
      pairCents.set(key, (pairCents.get(key) || 0) + sign * amount);
    }
  }

  const settlements: DebtSettlement[] = [];
  pairCents.forEach((cents, key) => {
    if (Math.abs(cents) < 1) return;
    const [a, b] = key.split('|');
    settlements.push(
      cents > 0
        ? { fromMemberId: a, toMemberId: b, amount: fromCents(cents) }
        : { fromMemberId: b, toMemberId: a, amount: fromCents(-cents) }
    );
  });

  return settlements.sort((x, y) => y.amount - x.amount);
}

/** Ids of every unsettled share between two members, in both directions. */
export function getSharesToSettle(
  expenses: TripExpenseWithShares[],
  memberA: string,
  memberB: string
): string[] {
  const ids: string[] = [];
  for (const expense of expenses) {
    const payer = expense.paid_by_member_id;
    if (payer !== memberA && payer !== memberB) continue;
    const other = payer === memberA ? memberB : memberA;
    for (const share of expense.trip_expense_shares || []) {
      if (!share.is_settled && share.member_id === other) ids.push(share.id);
    }
  }
  return ids;
}

// ============================================
// Formatting helpers
// ============================================

export function formatTripMoney(amount: number, currency = 'ARS'): string {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function buildTripTransactionDescription(tripName: string, expenseDescription: string): string {
  return `${tripName}: ${expenseDescription}`;
}
