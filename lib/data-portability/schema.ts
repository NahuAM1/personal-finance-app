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
import type {
  CanonicalExport,
  CanonicalMetadata,
  CanonicalData,
  EntityCounts,
  ValidationResult,
} from './types';

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONObject
  | JSONValue[];

export interface JSONObject {
  [key: string]: JSONValue;
}

function isObject(v: JSONValue): v is JSONObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isArray(v: JSONValue): v is JSONValue[] {
  return Array.isArray(v);
}

function isString(v: JSONValue): v is string {
  return typeof v === 'string';
}

function isNumber(v: JSONValue): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isBoolean(v: JSONValue): v is boolean {
  return typeof v === 'boolean';
}

function isNullable<T extends JSONValue>(
  v: JSONValue,
  check: (val: JSONValue) => val is T
): v is T | null {
  return v === null || check(v);
}

const TRANSACTION_TYPES: ReadonlyArray<Transaction['type']> = [
  'income',
  'expense',
  'credit',
];

const INVESTMENT_TYPES: ReadonlyArray<Investment['investment_type']> = [
  'plazo_fijo',
  'fci',
  'bonos',
  'acciones',
  'crypto',
  'letras',
  'cedears',
  'cauciones',
  'fondos_comunes_inversion',
  'compra_divisas',
];

const LOAN_TYPES: ReadonlyArray<Loan['loan_type']> = [
  'given',
  'received',
  'payment_plan',
];

const LOAN_PAYMENT_MODES: ReadonlyArray<Loan['payment_mode']> = [
  'single',
  'installments',
];

const LOAN_STATUSES: ReadonlyArray<Loan['status']> = ['active', 'completed'];

function readString(o: JSONObject, key: string): string {
  const v = o[key];
  if (!isString(v)) throw new Error(`field "${key}" must be a string`);
  return v;
}

function readNumber(o: JSONObject, key: string): number {
  const v = o[key];
  if (!isNumber(v)) throw new Error(`field "${key}" must be a number`);
  return v;
}

function readBoolean(o: JSONObject, key: string): boolean {
  const v = o[key];
  if (!isBoolean(v)) throw new Error(`field "${key}" must be a boolean`);
  return v;
}

function readNullableString(o: JSONObject, key: string): string | null {
  const v = o[key];
  if (!isNullable(v, isString)) {
    throw new Error(`field "${key}" must be string or null`);
  }
  return v;
}

function readNullableNumber(o: JSONObject, key: string): number | null {
  const v = o[key];
  if (!isNullable(v, isNumber)) {
    throw new Error(`field "${key}" must be number or null`);
  }
  return v;
}

function readNullableBoolean(o: JSONObject, key: string): boolean | null {
  const v = o[key];
  if (!isNullable(v, isBoolean)) {
    throw new Error(`field "${key}" must be boolean or null`);
  }
  return v;
}

function readEnum<T extends string>(
  o: JSONObject,
  key: string,
  allowed: ReadonlyArray<T>
): T {
  const v = o[key];
  if (!isString(v)) throw new Error(`field "${key}" must be a string`);
  const match = allowed.find((a) => a === v);
  if (match === undefined) {
    throw new Error(
      `field "${key}" must be one of: ${allowed.join(', ')} (got "${v}")`
    );
  }
  return match;
}

function parseTransaction(o: JSONObject): Transaction {
  return {
    id: readString(o, 'id'),
    user_id: readString(o, 'user_id'),
    type: readEnum(o, 'type', TRANSACTION_TYPES),
    amount: readNumber(o, 'amount'),
    category: readString(o, 'category'),
    description: readString(o, 'description'),
    date: readString(o, 'date'),
    is_recurring: readNullableBoolean(o, 'is_recurring'),
    installments: readNullableNumber(o, 'installments'),
    current_installment: readNullableNumber(o, 'current_installment'),
    paid: readNullableBoolean(o, 'paid'),
    parent_transaction_id: readNullableString(o, 'parent_transaction_id'),
    due_date: readNullableString(o, 'due_date'),
    balance_total: readNullableNumber(o, 'balance_total'),
    ticket_id: readNullableString(o, 'ticket_id'),
    created_at: readString(o, 'created_at'),
    updated_at: readString(o, 'updated_at'),
  };
}

function parseExpensePlan(o: JSONObject): ExpensePlan {
  return {
    id: readString(o, 'id'),
    user_id: readString(o, 'user_id'),
    name: readString(o, 'name'),
    target_amount: readNumber(o, 'target_amount'),
    current_amount: readNumber(o, 'current_amount'),
    deadline: readString(o, 'deadline'),
    category: readString(o, 'category'),
    deleted_at: readNullableString(o, 'deleted_at'),
    created_at: readString(o, 'created_at'),
    updated_at: readString(o, 'updated_at'),
  };
}

function parseCreditPurchase(o: JSONObject): CreditPurchase {
  return {
    id: readString(o, 'id'),
    user_id: readString(o, 'user_id'),
    description: readString(o, 'description'),
    category: readString(o, 'category'),
    total_amount: readNumber(o, 'total_amount'),
    installments: readNumber(o, 'installments'),
    monthly_amount: readNumber(o, 'monthly_amount'),
    start_date: readString(o, 'start_date'),
    created_at: readString(o, 'created_at'),
    updated_at: readString(o, 'updated_at'),
  };
}

function parseCreditInstallment(o: JSONObject): CreditInstallment {
  return {
    id: readString(o, 'id'),
    credit_purchase_id: readString(o, 'credit_purchase_id'),
    installment_number: readNumber(o, 'installment_number'),
    due_date: readString(o, 'due_date'),
    amount: readNumber(o, 'amount'),
    paid: readBoolean(o, 'paid'),
    paid_date: readNullableString(o, 'paid_date'),
    transaction_id: readNullableString(o, 'transaction_id'),
    created_at: readString(o, 'created_at'),
    updated_at: readString(o, 'updated_at'),
  };
}

function parseInvestment(o: JSONObject): Investment {
  return {
    id: readString(o, 'id'),
    user_id: readString(o, 'user_id'),
    description: readString(o, 'description'),
    investment_type: readEnum(o, 'investment_type', INVESTMENT_TYPES),
    amount: readNumber(o, 'amount'),
    start_date: readString(o, 'start_date'),
    maturity_date: readNullableString(o, 'maturity_date'),
    annual_rate: readNullableNumber(o, 'annual_rate'),
    estimated_return: readNumber(o, 'estimated_return'),
    is_liquidated: readBoolean(o, 'is_liquidated'),
    liquidation_date: readNullableString(o, 'liquidation_date'),
    actual_return: readNullableNumber(o, 'actual_return'),
    transaction_id: readNullableString(o, 'transaction_id'),
    currency: readNullableString(o, 'currency'),
    exchange_rate: readNullableNumber(o, 'exchange_rate'),
    created_at: readString(o, 'created_at'),
    updated_at: readString(o, 'updated_at'),
  };
}

function parseLoan(o: JSONObject): Loan {
  return {
    id: readString(o, 'id'),
    user_id: readString(o, 'user_id'),
    loan_type: readEnum(o, 'loan_type', LOAN_TYPES),
    counterparty_name: readString(o, 'counterparty_name'),
    description: readString(o, 'description'),
    principal_amount: readNumber(o, 'principal_amount'),
    interest_rate: readNumber(o, 'interest_rate'),
    total_amount: readNumber(o, 'total_amount'),
    payment_mode: readEnum(o, 'payment_mode', LOAN_PAYMENT_MODES),
    installments_count: readNumber(o, 'installments_count'),
    status: readEnum(o, 'status', LOAN_STATUSES),
    start_date: readString(o, 'start_date'),
    due_date: readNullableString(o, 'due_date'),
    transaction_id: readNullableString(o, 'transaction_id'),
    created_at: readString(o, 'created_at'),
    updated_at: readString(o, 'updated_at'),
  };
}

function parseLoanPayment(o: JSONObject): LoanPayment {
  return {
    id: readString(o, 'id'),
    loan_id: readString(o, 'loan_id'),
    payment_number: readNumber(o, 'payment_number'),
    due_date: readString(o, 'due_date'),
    amount: readNumber(o, 'amount'),
    paid: readBoolean(o, 'paid'),
    paid_date: readNullableString(o, 'paid_date'),
    transaction_id: readNullableString(o, 'transaction_id'),
    created_at: readString(o, 'created_at'),
    updated_at: readString(o, 'updated_at'),
  };
}

function parseTicket(o: JSONObject): Ticket {
  return {
    id: readString(o, 'id'),
    user_id: readString(o, 'user_id'),
    store_name: readString(o, 'store_name'),
    total_amount: readNumber(o, 'total_amount'),
    ticket_date: readString(o, 'ticket_date'),
    image_path: readString(o, 'image_path'),
    notes: readNullableString(o, 'notes'),
    created_at: readString(o, 'created_at'),
    updated_at: readString(o, 'updated_at'),
  };
}

function parseTicketItem(o: JSONObject): TicketItem {
  return {
    id: readString(o, 'id'),
    ticket_id: readString(o, 'ticket_id'),
    product_name: readString(o, 'product_name'),
    quantity: readNumber(o, 'quantity'),
    unit_price: readNumber(o, 'unit_price'),
    total_price: readNumber(o, 'total_price'),
    category: readNullableString(o, 'category'),
    created_at: readString(o, 'created_at'),
  };
}

interface RowParser<T> {
  (o: JSONObject): T;
}

function parseArray<T>(
  v: JSONValue,
  parser: RowParser<T>,
  entityName: string,
  errors: string[]
): T[] {
  if (!isArray(v)) {
    errors.push(`"${entityName}" must be an array`);
    return [];
  }
  const result: T[] = [];
  for (let i = 0; i < v.length; i++) {
    const row = v[i];
    if (!isObject(row)) {
      errors.push(`"${entityName}[${i}]" must be an object`);
      continue;
    }
    try {
      result.push(parser(row));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`"${entityName}[${i}]" ${msg}`);
    }
  }
  return result;
}

function parseMetadata(v: JSONValue, errors: string[]): CanonicalMetadata | null {
  if (!isObject(v)) {
    errors.push('"metadata" must be an object');
    return null;
  }
  try {
    const versionField = v.schemaVersion;
    if (!isNumber(versionField) || versionField !== 1) {
      errors.push('"metadata.schemaVersion" must equal 1');
      return null;
    }
    const entitiesField = v.entities;
    const entities: CanonicalMetadata['entities'] = [];
    if (isArray(entitiesField)) {
      for (const e of entitiesField) {
        if (isString(e)) {
          if (
            e === 'transactions' ||
            e === 'expense_plans' ||
            e === 'credit_purchases' ||
            e === 'investments' ||
            e === 'loans' ||
            e === 'tickets'
          ) {
            entities.push(e);
          }
        }
      }
    }
    const dateRangeField = v.dateRange;
    let dateRange: CanonicalMetadata['dateRange'] = null;
    if (isObject(dateRangeField)) {
      const from = dateRangeField.from;
      const to = dateRangeField.to;
      if (isString(from) && isString(to)) {
        dateRange = { from, to };
      }
    }
    return {
      schemaVersion: 1,
      exportedAt: isString(v.exportedAt) ? v.exportedAt : '',
      exportedBy: isString(v.exportedBy) ? v.exportedBy : '',
      dateRange,
      appVersion: isString(v.appVersion) ? v.appVersion : '',
      entities,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`"metadata" ${msg}`);
    return null;
  }
}

export function validateAndParse(v: JSONValue): ValidationResult & {
  parsed: CanonicalExport | null;
} {
  const errors: string[] = [];
  const emptyCounts: EntityCounts = {
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

  if (!isObject(v)) {
    return {
      ok: false,
      errors: ['root must be an object'],
      counts: emptyCounts,
      parsed: null,
    };
  }

  const metadata = parseMetadata(v.metadata, errors);
  if (!metadata) {
    return { ok: false, errors, counts: emptyCounts, parsed: null };
  }

  const dataField = v.data;
  if (!isObject(dataField)) {
    return {
      ok: false,
      errors: ['"data" must be an object'],
      counts: emptyCounts,
      parsed: null,
    };
  }

  const data: CanonicalData = {
    transactions: parseArray(
      dataField.transactions ?? [],
      parseTransaction,
      'data.transactions',
      errors
    ),
    expense_plans: parseArray(
      dataField.expense_plans ?? [],
      parseExpensePlan,
      'data.expense_plans',
      errors
    ),
    credit_purchases: parseArray(
      dataField.credit_purchases ?? [],
      parseCreditPurchase,
      'data.credit_purchases',
      errors
    ),
    credit_installments: parseArray(
      dataField.credit_installments ?? [],
      parseCreditInstallment,
      'data.credit_installments',
      errors
    ),
    investments: parseArray(
      dataField.investments ?? [],
      parseInvestment,
      'data.investments',
      errors
    ),
    loans: parseArray(dataField.loans ?? [], parseLoan, 'data.loans', errors),
    loan_payments: parseArray(
      dataField.loan_payments ?? [],
      parseLoanPayment,
      'data.loan_payments',
      errors
    ),
    tickets: parseArray(
      dataField.tickets ?? [],
      parseTicket,
      'data.tickets',
      errors
    ),
    ticket_items: parseArray(
      dataField.ticket_items ?? [],
      parseTicketItem,
      'data.ticket_items',
      errors
    ),
  };

  const counts: EntityCounts = {
    transactions: data.transactions.length,
    expense_plans: data.expense_plans.length,
    credit_purchases: data.credit_purchases.length,
    credit_installments: data.credit_installments.length,
    investments: data.investments.length,
    loans: data.loans.length,
    loan_payments: data.loan_payments.length,
    tickets: data.tickets.length,
    ticket_items: data.ticket_items.length,
  };

  return {
    ok: errors.length === 0,
    errors,
    counts,
    parsed: { metadata, data },
  };
}
