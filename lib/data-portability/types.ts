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

export type EntityKey =
  | 'transactions'
  | 'expense_plans'
  | 'credit_purchases'
  | 'investments'
  | 'loans'
  | 'tickets';

export const ALL_ENTITIES: readonly EntityKey[] = [
  'transactions',
  'expense_plans',
  'credit_purchases',
  'investments',
  'loans',
  'tickets',
] as const;

export const ENTITY_LABELS: Record<EntityKey, string> = {
  transactions: 'Movimientos',
  expense_plans: 'Planes de gasto',
  credit_purchases: 'Compras con tarjeta',
  investments: 'Inversiones',
  loans: 'Préstamos y planes de pago',
  tickets: 'Tickets',
};

export interface DateRange {
  from: string;
  to: string;
}

export interface ExportOptions {
  entities: ReadonlySet<EntityKey>;
  dateRange: DateRange | null;
}

export type ExportFormat = 'json' | 'xlsx';

export interface CanonicalMetadata {
  schemaVersion: 1;
  exportedAt: string;
  exportedBy: string;
  dateRange: DateRange | null;
  appVersion: string;
  entities: EntityKey[];
}

export interface CanonicalData {
  transactions: Transaction[];
  expense_plans: ExpensePlan[];
  credit_purchases: CreditPurchase[];
  credit_installments: CreditInstallment[];
  investments: Investment[];
  loans: Loan[];
  loan_payments: LoanPayment[];
  tickets: Ticket[];
  ticket_items: TicketItem[];
}

export interface CanonicalExport {
  metadata: CanonicalMetadata;
  data: CanonicalData;
}

export interface EntityCounts {
  transactions: number;
  expense_plans: number;
  credit_purchases: number;
  credit_installments: number;
  investments: number;
  loans: number;
  loan_payments: number;
  tickets: number;
  ticket_items: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  counts: EntityCounts;
}

export interface ImportResult {
  inserted: EntityCounts;
  errors: string[];
}
