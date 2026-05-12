import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { recalculateAllBalances } from '@/lib/database-api';
import { validateAndParse } from './schema';
import type { JSONObject, JSONValue } from './schema';
import type {
  CanonicalData,
  CanonicalExport,
  EntityCounts,
  ImportResult,
  ValidationResult,
} from './types';
import type {
  Transaction,
  ExpensePlan,
  CreditPurchase,
  CreditInstallment,
  Investment,
  Loan,
  LoanPayment,
  Ticket,
  TicketItem,
} from '@/types/database';

const BATCH_SIZE = 500;

type SheetRow = Record<string, string | number | boolean | null>;

function sheetRowToJSONObject(row: SheetRow): JSONObject {
  const out: JSONObject = {};
  for (const key of Object.keys(row)) {
    const v = row[key];
    if (v === undefined) {
      out[key] = null;
    } else {
      out[key] = v;
    }
  }
  return out;
}

function workbookToJSONValue(wb: XLSX.WorkBook): JSONValue {
  const data: JSONObject = {};
  for (const name of wb.SheetNames) {
    if (name === '_metadata') continue;
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: null });
    data[name] = rows.map(sheetRowToJSONObject);
  }
  const metaSheet = wb.Sheets['_metadata'];
  const metaRows = metaSheet
    ? XLSX.utils.sheet_to_json<SheetRow>(metaSheet, { defval: null })
    : [];
  const metaRow = metaRows[0];
  const dateRangeFromVal = metaRow ? metaRow['dateRangeFrom'] : null;
  const dateRangeToVal = metaRow ? metaRow['dateRangeTo'] : null;
  const dateRangeFrom =
    typeof dateRangeFromVal === 'string' && dateRangeFromVal.length > 0
      ? dateRangeFromVal
      : null;
  const dateRangeTo =
    typeof dateRangeToVal === 'string' && dateRangeToVal.length > 0
      ? dateRangeToVal
      : null;
  const metadata: JSONObject = {
    schemaVersion: 1,
    exportedAt:
      metaRow && typeof metaRow['exportedAt'] === 'string'
        ? metaRow['exportedAt']
        : '',
    exportedBy:
      metaRow && typeof metaRow['exportedBy'] === 'string'
        ? metaRow['exportedBy']
        : '',
    appVersion:
      metaRow && typeof metaRow['appVersion'] === 'string'
        ? metaRow['appVersion']
        : '',
    entities:
      metaRow && typeof metaRow['entities'] === 'string'
        ? metaRow['entities']
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : [],
    dateRange:
      dateRangeFrom && dateRangeTo
        ? { from: dateRangeFrom, to: dateRangeTo }
        : null,
  };
  return { metadata, data };
}

async function parseJSONFile(file: File): Promise<JSONValue> {
  const text = await file.text();
  const value: JSONValue = JSON.parse(text);
  return value;
}

async function parseXLSXFile(file: File): Promise<JSONValue> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  return workbookToJSONValue(wb);
}

export async function parseFile(file: File): Promise<ValidationResult & {
  parsed: CanonicalExport | null;
}> {
  const lower = file.name.toLowerCase();
  let raw: JSONValue;
  try {
    if (lower.endsWith('.json')) {
      raw = await parseJSONFile(file);
    } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      raw = await parseXLSXFile(file);
    } else {
      return {
        ok: false,
        errors: ['Formato no soportado. Usá un archivo .json o .xlsx.'],
        counts: emptyCounts(),
        parsed: null,
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      errors: [`No pude leer el archivo: ${msg}`],
      counts: emptyCounts(),
      parsed: null,
    };
  }
  return validateAndParse(raw);
}

function emptyCounts(): EntityCounts {
  return {
    transactions: 0,
    expense_plans: 0,
    credit_purchases: 0,
    credit_installments: 0,
    investments: 0,
    loans: 0,
    loan_payments: 0,
    tickets: 0,
    ticket_items: 0,
  };
}

function remapData(
  data: CanonicalData,
  userId: string
): CanonicalData {
  const txMap = new Map<string, string>();
  const purchaseMap = new Map<string, string>();
  const installmentMap = new Map<string, string>();
  const investmentMap = new Map<string, string>();
  const loanMap = new Map<string, string>();
  const paymentMap = new Map<string, string>();
  const ticketMap = new Map<string, string>();
  const expensePlanMap = new Map<string, string>();

  for (const t of data.transactions) txMap.set(t.id, crypto.randomUUID());
  for (const p of data.credit_purchases)
    purchaseMap.set(p.id, crypto.randomUUID());
  for (const i of data.credit_installments)
    installmentMap.set(i.id, crypto.randomUUID());
  for (const inv of data.investments)
    investmentMap.set(inv.id, crypto.randomUUID());
  for (const l of data.loans) loanMap.set(l.id, crypto.randomUUID());
  for (const lp of data.loan_payments)
    paymentMap.set(lp.id, crypto.randomUUID());
  for (const t of data.tickets) ticketMap.set(t.id, crypto.randomUUID());
  for (const ep of data.expense_plans)
    expensePlanMap.set(ep.id, crypto.randomUUID());

  function remapNullable(
    map: Map<string, string>,
    oldId: string | null
  ): string | null {
    if (oldId === null) return null;
    return map.get(oldId) ?? null;
  }

  const transactions: Transaction[] = data.transactions.map((t) => ({
    ...t,
    id: txMap.get(t.id) ?? crypto.randomUUID(),
    user_id: userId,
    // Self-referencing FK on the same table is fragile inside a single batch;
    // we drop the link on import. Recurring/credit hierarchies are rebuilt by
    // the new credit_installments system as the user interacts with them.
    parent_transaction_id: null,
    ticket_id: remapNullable(ticketMap, t.ticket_id),
    balance_total: null,
  }));

  const expense_plans: ExpensePlan[] = data.expense_plans.map((p) => ({
    ...p,
    id: expensePlanMap.get(p.id) ?? crypto.randomUUID(),
    user_id: userId,
  }));

  const credit_purchases: CreditPurchase[] = data.credit_purchases.map((p) => ({
    ...p,
    id: purchaseMap.get(p.id) ?? crypto.randomUUID(),
    user_id: userId,
  }));

  const credit_installments: CreditInstallment[] = data.credit_installments
    .filter((i) => purchaseMap.has(i.credit_purchase_id))
    .map((i) => ({
      ...i,
      id: installmentMap.get(i.id) ?? crypto.randomUUID(),
      credit_purchase_id: purchaseMap.get(i.credit_purchase_id) ?? i.credit_purchase_id,
      transaction_id: remapNullable(txMap, i.transaction_id),
    }));

  const investments: Investment[] = data.investments.map((i) => ({
    ...i,
    id: investmentMap.get(i.id) ?? crypto.randomUUID(),
    user_id: userId,
    transaction_id: remapNullable(txMap, i.transaction_id),
  }));

  const loans: Loan[] = data.loans.map((l) => ({
    ...l,
    id: loanMap.get(l.id) ?? crypto.randomUUID(),
    user_id: userId,
    transaction_id: remapNullable(txMap, l.transaction_id),
  }));

  const loan_payments: LoanPayment[] = data.loan_payments
    .filter((lp) => loanMap.has(lp.loan_id))
    .map((lp) => ({
      ...lp,
      id: paymentMap.get(lp.id) ?? crypto.randomUUID(),
      loan_id: loanMap.get(lp.loan_id) ?? lp.loan_id,
      transaction_id: remapNullable(txMap, lp.transaction_id),
    }));

  const tickets: Ticket[] = data.tickets.map((t) => ({
    ...t,
    id: ticketMap.get(t.id) ?? crypto.randomUUID(),
    user_id: userId,
  }));

  const ticket_items: TicketItem[] = data.ticket_items
    .filter((ti) => ticketMap.has(ti.ticket_id))
    .map((ti) => ({
      ...ti,
      id: crypto.randomUUID(),
      ticket_id: ticketMap.get(ti.ticket_id) ?? ti.ticket_id,
    }));

  return {
    transactions,
    expense_plans,
    credit_purchases,
    credit_installments,
    investments,
    loans,
    loan_payments,
    tickets,
    ticket_items,
  };
}

async function insertTransactions(rows: Transaction[], errors: string[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const slice = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.from('transactions').insert(slice).select('id');
    if (error) { errors.push(`transactions: ${error.message}`); continue; }
    inserted += data ? data.length : 0;
  }
  return inserted;
}

async function insertExpensePlans(rows: ExpensePlan[], errors: string[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const slice = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.from('expense_plans').insert(slice).select('id');
    if (error) { errors.push(`expense_plans: ${error.message}`); continue; }
    inserted += data ? data.length : 0;
  }
  return inserted;
}

async function insertCreditPurchases(rows: CreditPurchase[], errors: string[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const slice = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.from('credit_purchases').insert(slice).select('id');
    if (error) { errors.push(`credit_purchases: ${error.message}`); continue; }
    inserted += data ? data.length : 0;
  }
  return inserted;
}

async function insertCreditInstallments(rows: CreditInstallment[], errors: string[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const slice = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.from('credit_installments').insert(slice).select('id');
    if (error) { errors.push(`credit_installments: ${error.message}`); continue; }
    inserted += data ? data.length : 0;
  }
  return inserted;
}

async function insertInvestments(rows: Investment[], errors: string[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const slice = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.from('investments').insert(slice).select('id');
    if (error) { errors.push(`investments: ${error.message}`); continue; }
    inserted += data ? data.length : 0;
  }
  return inserted;
}

async function insertLoans(rows: Loan[], errors: string[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const slice = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.from('loans').insert(slice).select('id');
    if (error) { errors.push(`loans: ${error.message}`); continue; }
    inserted += data ? data.length : 0;
  }
  return inserted;
}

async function insertLoanPayments(rows: LoanPayment[], errors: string[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const slice = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.from('loan_payments').insert(slice).select('id');
    if (error) { errors.push(`loan_payments: ${error.message}`); continue; }
    inserted += data ? data.length : 0;
  }
  return inserted;
}

async function insertTickets(rows: Ticket[], errors: string[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const slice = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.from('tickets').insert(slice).select('id');
    if (error) { errors.push(`tickets: ${error.message}`); continue; }
    inserted += data ? data.length : 0;
  }
  return inserted;
}

async function insertTicketItems(rows: TicketItem[], errors: string[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const slice = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.from('ticket_items').insert(slice).select('id');
    if (error) { errors.push(`ticket_items: ${error.message}`); continue; }
    inserted += data ? data.length : 0;
  }
  return inserted;
}

export async function importMerge(
  userId: string,
  exportData: CanonicalExport
): Promise<ImportResult> {
  const errors: string[] = [];
  const inserted = emptyCounts();
  const remapped = remapData(exportData.data, userId);

  // Insertion order matters for FK constraints:
  //  1) tickets        -> transactions.ticket_id references this
  //  2) ticket_items   -> ticket_items.ticket_id references tickets
  //  3) transactions   -> referenced by credit_installments / investments / loans / loan_payments
  //  4) credit_purchases -> credit_installments.credit_purchase_id references this
  //  5) credit_installments (FK to credit_purchases + nullable FK to transactions)
  //  6) investments    (nullable FK to transactions)
  //  7) loans          (nullable FK to transactions)
  //  8) loan_payments  (FK to loans + nullable FK to transactions)
  //  9) expense_plans  (no FK to the above)
  inserted.tickets = await insertTickets(remapped.tickets, errors);
  inserted.ticket_items = await insertTicketItems(remapped.ticket_items, errors);
  inserted.transactions = await insertTransactions(remapped.transactions, errors);
  inserted.credit_purchases = await insertCreditPurchases(remapped.credit_purchases, errors);
  inserted.credit_installments = await insertCreditInstallments(remapped.credit_installments, errors);
  inserted.investments = await insertInvestments(remapped.investments, errors);
  inserted.loans = await insertLoans(remapped.loans, errors);
  inserted.loan_payments = await insertLoanPayments(remapped.loan_payments, errors);
  inserted.expense_plans = await insertExpensePlans(remapped.expense_plans, errors);

  if (inserted.transactions > 0) {
    try {
      await recalculateAllBalances(userId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Recalculo de balances falló: ${msg}`);
    }
  }

  return { inserted, errors };
}

export function totalInserted(counts: EntityCounts): number {
  return (
    counts.transactions +
    counts.expense_plans +
    counts.credit_purchases +
    counts.credit_installments +
    counts.investments +
    counts.loans +
    counts.loan_payments +
    counts.tickets +
    counts.ticket_items
  );
}
