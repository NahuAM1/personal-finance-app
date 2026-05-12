import * as XLSX from 'xlsx';
import {
  getTransactions,
  getExpensePlans,
  getCreditPurchases,
  getAllCreditInstallments,
  getInvestments,
  getLoans,
  getAllLoanPayments,
  getTickets,
  getTicketItems,
} from '@/lib/database-api';
import type {
  CanonicalExport,
  CanonicalData,
  CanonicalMetadata,
  EntityKey,
  ExportOptions,
} from './types';

const SCHEMA_VERSION = 1 as const;
const APP_VERSION = '0.1.0';

function inDateRange(
  isoDate: string,
  range: { from: string; to: string } | null
): boolean {
  if (!range) return true;
  return isoDate >= range.from && isoDate <= range.to;
}

async function gatherData(
  userId: string,
  opts: ExportOptions
): Promise<CanonicalData> {
  const data: CanonicalData = {
    transactions: [],
    expense_plans: [],
    credit_purchases: [],
    credit_installments: [],
    investments: [],
    loans: [],
    loan_payments: [],
    tickets: [],
    ticket_items: [],
  };

  if (opts.entities.has('transactions')) {
    const rows = await getTransactions(userId);
    data.transactions = rows.filter((r) => inDateRange(r.date, opts.dateRange));
  }

  if (opts.entities.has('expense_plans')) {
    const rows = await getExpensePlans(userId);
    data.expense_plans = rows.filter((r) =>
      inDateRange(r.deadline, opts.dateRange)
    );
  }

  if (opts.entities.has('credit_purchases')) {
    const purchases = await getCreditPurchases(userId);
    data.credit_purchases = purchases.filter((p) =>
      inDateRange(p.start_date, opts.dateRange)
    );
    if (data.credit_purchases.length > 0) {
      const allInstallments = await getAllCreditInstallments(userId);
      const purchaseIds = new Set(data.credit_purchases.map((p) => p.id));
      data.credit_installments = allInstallments.filter((i) =>
        purchaseIds.has(i.credit_purchase_id)
      );
    }
  }

  if (opts.entities.has('investments')) {
    const rows = await getInvestments(userId);
    data.investments = rows.filter((r) =>
      inDateRange(r.start_date, opts.dateRange)
    );
  }

  if (opts.entities.has('loans')) {
    const loans = await getLoans(userId);
    data.loans = loans.filter((l) => inDateRange(l.start_date, opts.dateRange));
    if (data.loans.length > 0) {
      const allPayments = await getAllLoanPayments(userId);
      const loanIds = new Set(data.loans.map((l) => l.id));
      data.loan_payments = allPayments.filter((p) => loanIds.has(p.loan_id));
    }
  }

  if (opts.entities.has('tickets')) {
    const tickets = await getTickets(userId);
    data.tickets = tickets.filter((t) =>
      inDateRange(t.ticket_date, opts.dateRange)
    );
    if (data.tickets.length > 0) {
      const items = await getTicketItems(data.tickets.map((t) => t.id));
      data.ticket_items = items;
    }
  }

  return data;
}

function buildMetadata(
  userEmail: string,
  opts: ExportOptions
): CanonicalMetadata {
  const entitiesArr: EntityKey[] = [];
  opts.entities.forEach((e) => entitiesArr.push(e));
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: userEmail,
    dateRange: opts.dateRange,
    appVersion: APP_VERSION,
    entities: entitiesArr,
  };
}

export async function buildCanonicalExport(
  userId: string,
  userEmail: string,
  opts: ExportOptions
): Promise<CanonicalExport> {
  const data = await gatherData(userId, opts);
  const metadata = buildMetadata(userEmail, opts);
  return { metadata, data };
}

export function serializeJSON(payload: CanonicalExport): Blob {
  const text = JSON.stringify(payload, null, 2);
  return new Blob([text], { type: 'application/json' });
}

const SHEET_ORDER: ReadonlyArray<keyof CanonicalData> = [
  'transactions',
  'expense_plans',
  'credit_purchases',
  'credit_installments',
  'investments',
  'loans',
  'loan_payments',
  'tickets',
  'ticket_items',
];

export function serializeXLSX(payload: CanonicalExport): Blob {
  const wb = XLSX.utils.book_new();

  for (const key of SHEET_ORDER) {
    const rows = payload.data[key];
    if (rows.length === 0) continue;
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, sheet, key);
  }

  const metaRow: Record<string, string> = {
    schemaVersion: String(payload.metadata.schemaVersion),
    exportedAt: payload.metadata.exportedAt,
    exportedBy: payload.metadata.exportedBy,
    appVersion: payload.metadata.appVersion,
    entities: payload.metadata.entities.join(', '),
    dateRangeFrom: payload.metadata.dateRange?.from ?? '',
    dateRangeTo: payload.metadata.dateRange?.to ?? '',
  };
  const metaSheet = XLSX.utils.json_to_sheet([metaRow]);
  XLSX.utils.book_append_sheet(wb, metaSheet, '_metadata');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildExportFilename(format: 'json' | 'xlsx'): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const ext = format === 'json' ? 'json' : 'xlsx';
  return `personal-wallet-export-${stamp}.${ext}`;
}
