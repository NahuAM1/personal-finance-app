import { supabase } from '@/lib/supabase';
import {
  addTransaction,
  deleteTransaction,
  recalculateAllBalances,
} from '@/lib/database-api';
import type { Database, Trip, TripMember, TripExpense } from '@/types/database';
import {
  buildTripTransactionDescription,
  getSharesToSettle,
  type DebtSettlement,
  type ShareInput,
  type TripExpenseWithShares,
} from '@/lib/trips';

type TripInsert = Database['public']['Tables']['trips']['Insert'];
type TripUpdate = Database['public']['Tables']['trips']['Update'];

export type TripWithTotals = Trip & { total_spent: number };

export const TRIP_TRANSACTION_CATEGORY = 'Viaje';

export interface TripExpenseInput {
  paid_by_member_id: string;
  description: string;
  amount: number;
  category: string | null;
  expense_date: string;
  split_method: TripExpense['split_method'];
}

// ============================================
// Trips
// ============================================

/** Trips the user created or is an accepted member of (filtered by RLS). */
export async function getTrips(): Promise<TripWithTotals[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('*, trip_expenses(amount)')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = (data || []) as unknown as (Trip & { trip_expenses: { amount: number }[] | null })[];
  return rows.map(({ trip_expenses, ...trip }) => ({
    ...trip,
    total_spent:
      Math.round((trip_expenses || []).reduce((sum, e) => sum + Number(e.amount), 0) * 100) / 100,
  }));
}

export async function createTrip(
  trip: Omit<TripInsert, 'id' | 'created_at' | 'updated_at' | 'is_active'>,
  creator: { displayName: string; email: string | null }
): Promise<Trip> {
  const { data: tripData, error: tripError } = await supabase
    .from('trips')
    .insert([trip])
    .select()
    .single();

  if (tripError) throw tripError;

  const { error: memberError } = await supabase.from('trip_members').insert([
    {
      trip_id: tripData.id,
      user_id: trip.created_by,
      display_name: creator.displayName,
      email: creator.email ? creator.email.toLowerCase() : null,
      is_admin: true,
      invite_status: 'accepted' as const,
    },
  ]);

  if (memberError) {
    // Compensate so we never leave a trip without its creator member.
    await supabase.from('trips').delete().eq('id', tripData.id);
    throw memberError;
  }

  return tripData as Trip;
}

export async function updateTrip(tripId: string, updates: TripUpdate): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .update(updates)
    .eq('id', tripId)
    .select()
    .single();

  if (error) throw error;
  return data as Trip;
}

export async function deleteTrip(tripId: string): Promise<void> {
  const { error } = await supabase.from('trips').delete().eq('id', tripId);
  if (error) throw error;
}

// ============================================
// Members
// ============================================

export async function getTripMembers(tripId: string): Promise<TripMember[]> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('*')
    .eq('trip_id', tripId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return (data || []) as TripMember[];
}

/** Adds a person without an account. Other members record expenses for them. */
export async function addGuestMember(tripId: string, displayName: string): Promise<TripMember> {
  const { data, error } = await supabase
    .from('trip_members')
    .insert([
      {
        trip_id: tripId,
        user_id: null,
        email: null,
        display_name: displayName.trim(),
        invite_status: 'accepted' as const,
        is_admin: false,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as TripMember;
}

// ============================================
// Expenses
// ============================================

export async function getTripExpenses(tripId: string): Promise<TripExpenseWithShares[]> {
  const { data, error } = await supabase
    .from('trip_expenses')
    .select('*, trip_expense_shares(*)')
    .eq('trip_id', tripId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as TripExpenseWithShares[];
}

async function insertShares(expenseId: string, shares: ShareInput[]): Promise<void> {
  const { error } = await supabase
    .from('trip_expense_shares')
    .insert(shares.map((s) => ({ ...s, expense_id: expenseId })));
  if (error) throw error;
}

async function createPersonalTransaction(
  userId: string,
  tripName: string,
  input: TripExpenseInput
): Promise<string> {
  const tx = await addTransaction({
    user_id: userId,
    type: 'expense',
    amount: input.amount,
    category: TRIP_TRANSACTION_CATEGORY,
    description: buildTripTransactionDescription(tripName, input.description),
    date: input.expense_date,
    is_recurring: false,
    installments: null,
    current_installment: null,
    paid: true,
    parent_transaction_id: null,
    due_date: null,
    balance_total: null,
    ticket_id: null,
    service_id: null,
  });
  return tx.id;
}

async function setExpenseTransactionId(expenseId: string, transactionId: string | null): Promise<void> {
  const { error } = await supabase
    .from('trip_expenses')
    .update({ transaction_id: transactionId })
    .eq('id', expenseId);
  if (error) throw error;
}

function isPaidByUser(members: TripMember[], memberId: string, userId: string): boolean {
  return members.find((m) => m.id === memberId)?.user_id === userId;
}

export function hasSettledShares(expense: TripExpenseWithShares): boolean {
  return (expense.trip_expense_shares || []).some((s) => s.is_settled);
}

/**
 * Creates an expense with its shares. When the payer is the current user, a
 * personal "Viaje" transaction is created too and linked to the expense.
 */
export async function createTripExpense(params: {
  trip: Pick<Trip, 'id' | 'name'>;
  input: TripExpenseInput;
  shares: ShareInput[];
  members: TripMember[];
  currentUserId: string;
}): Promise<void> {
  const { trip, input, shares, members, currentUserId } = params;

  const { data: expense, error } = await supabase
    .from('trip_expenses')
    .insert([{ ...input, trip_id: trip.id }])
    .select()
    .single();

  if (error) throw error;

  try {
    await insertShares(expense.id, shares);
  } catch (sharesError) {
    await supabase.from('trip_expenses').delete().eq('id', expense.id);
    throw sharesError;
  }

  if (isPaidByUser(members, input.paid_by_member_id, currentUserId)) {
    const transactionId = await createPersonalTransaction(currentUserId, trip.name, input);
    await setExpenseTransactionId(expense.id, transactionId);
  }
}

/**
 * Updates an expense, replaces its shares and keeps the current user's
 * personal transaction in sync (create / update / delete as needed).
 * Expenses with settled shares cannot be edited (their debts were already paid).
 */
export async function updateTripExpense(params: {
  trip: Pick<Trip, 'id' | 'name'>;
  expense: TripExpenseWithShares;
  input: TripExpenseInput;
  shares: ShareInput[];
  members: TripMember[];
  currentUserId: string;
}): Promise<void> {
  const { trip, expense, input, shares, members, currentUserId } = params;

  if (hasSettledShares(expense)) {
    throw new Error('Este gasto tiene deudas saldadas y ya no se puede editar');
  }

  const { error: updateError } = await supabase
    .from('trip_expenses')
    .update(input)
    .eq('id', expense.id);
  if (updateError) throw updateError;

  const { error: deleteSharesError } = await supabase
    .from('trip_expense_shares')
    .delete()
    .eq('expense_id', expense.id);
  if (deleteSharesError) throw deleteSharesError;

  await insertShares(expense.id, shares);

  const wasMine = isPaidByUser(members, expense.paid_by_member_id, currentUserId);
  const isMine = isPaidByUser(members, input.paid_by_member_id, currentUserId);
  let touchedTransactions = false;

  if (expense.transaction_id && wasMine && isMine) {
    const { error } = await supabase
      .from('transactions')
      .update({
        amount: input.amount,
        date: input.expense_date,
        description: buildTripTransactionDescription(trip.name, input.description),
      })
      .eq('id', expense.transaction_id)
      .eq('user_id', currentUserId);
    if (error) throw error;
    touchedTransactions = true;
  } else if (expense.transaction_id && wasMine && !isMine) {
    await setExpenseTransactionId(expense.id, null);
    await deleteTransaction(expense.transaction_id, currentUserId);
    touchedTransactions = true;
  } else if (isMine && !(expense.transaction_id && wasMine)) {
    const transactionId = await createPersonalTransaction(currentUserId, trip.name, input);
    await setExpenseTransactionId(expense.id, transactionId);
  }

  if (touchedTransactions) {
    await recalculateAllBalances(currentUserId);
  }
}

/** Deletes an expense and, if it was paid by the current user, its transaction. */
export async function deleteTripExpense(params: {
  expense: TripExpenseWithShares;
  members: TripMember[];
  currentUserId: string;
}): Promise<void> {
  const { expense, members, currentUserId } = params;

  if (hasSettledShares(expense)) {
    throw new Error('Este gasto tiene deudas saldadas y ya no se puede eliminar');
  }

  const { error } = await supabase.from('trip_expenses').delete().eq('id', expense.id);
  if (error) throw error;

  if (expense.transaction_id && isPaidByUser(members, expense.paid_by_member_id, currentUserId)) {
    await deleteTransaction(expense.transaction_id, currentUserId);
    await recalculateAllBalances(currentUserId);
  }
}

// ============================================
// Settlements
// ============================================

/**
 * Marks every unsettled share between the two members as settled and, only for
 * the current user, records the payment as a personal transaction
 * ("Saldo de deuda" when paying, "Cobro de deuda" when collecting).
 */
export async function settleDebt(params: {
  trip: Pick<Trip, 'name'>;
  settlement: DebtSettlement;
  expenses: TripExpenseWithShares[];
  members: TripMember[];
  currentUserId: string;
}): Promise<void> {
  const { trip, settlement, expenses, members, currentUserId } = params;
  const shareIds = getSharesToSettle(expenses, settlement.fromMemberId, settlement.toMemberId);
  if (shareIds.length === 0) return;

  const { error } = await supabase
    .from('trip_expense_shares')
    .update({ is_settled: true, settled_at: new Date().toISOString() })
    .in('id', shareIds);
  if (error) throw error;

  const currentMember = members.find((m) => m.user_id === currentUserId);
  if (!currentMember) return;

  const nameOf = (id: string) => members.find((m) => m.id === id)?.display_name || 'Desconocido';
  const today = new Date().toISOString().split('T')[0];
  const base = {
    user_id: currentUserId,
    amount: settlement.amount,
    date: today,
    is_recurring: false,
    installments: null,
    current_installment: null,
    paid: true,
    parent_transaction_id: null,
    due_date: null,
    balance_total: null,
    ticket_id: null,
    service_id: null,
  };

  if (currentMember.id === settlement.fromMemberId) {
    await addTransaction({
      ...base,
      type: 'expense',
      category: 'Saldo de deuda',
      description: `Saldo deuda a ${nameOf(settlement.toMemberId)} - ${trip.name}`,
    });
  } else if (currentMember.id === settlement.toMemberId) {
    await addTransaction({
      ...base,
      type: 'income',
      category: 'Cobro de deuda',
      description: `Cobro deuda de ${nameOf(settlement.fromMemberId)} - ${trip.name}`,
    });
  }
}
