import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import type { Card, CreditPurchase } from '@/types/database';
import type { JSONObject } from './schema';
import type { CanonicalData, EntityKey } from './types';

const db = vi.hoisted(() => ({
  getTransactions: vi.fn(),
  getExpensePlans: vi.fn(),
  getCreditPurchases: vi.fn(),
  getAllCreditInstallments: vi.fn(),
  getInvestments: vi.fn(),
  getLoans: vi.fn(),
  getAllLoanPayments: vi.fn(),
  getTickets: vi.fn(),
  getTicketItems: vi.fn(),
  getCards: vi.fn(),
}));

vi.mock('@/lib/database-api', () => db);
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/lib/balances', () => ({ recalculateAllBalances: vi.fn() }));
vi.mock('@/lib/user-settings-api', () => ({
  getUserSettings: vi.fn().mockResolvedValue({ base_currency: 'ARS', ars_rate_type: 'blue' }),
  getUserSettingsStrict: vi.fn(),
}));

import { validateAndParse } from './schema';
import { clearMissingCardIds, parseFile, remapData } from './import';
import { buildCanonicalExport, serializeXLSX } from './export';

const STAMP = '2026-10-01T10:00:00.000Z';

const metadata: JSONObject = {
  schemaVersion: 2,
  exportedAt: STAMP,
  exportedBy: 'user@example.com',
  dateRange: null,
  appVersion: '0.1.0',
  entities: ['cards', 'credit_purchases'],
  baseCurrency: 'ARS',
};

function cardRow(overrides: JSONObject): JSONObject {
  return {
    id: 'card-old-1',
    user_id: 'user-old',
    name: 'Visa Galicia',
    network: 'visa',
    last_four: '1234',
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}

const legacyPurchaseRow: JSONObject = {
  id: 'purchase-old-1',
  user_id: 'user-old',
  description: 'Heladera',
  category: 'Hogar',
  total_amount: 120000,
  installments: 6,
  monthly_amount: 20000,
  start_date: '2026-09-15',
  currency: 'ARS',
  original_amount: 120000,
  exchange_rate: 1,
  rate_source: 'auto',
  base_currency: 'ARS',
  created_at: STAMP,
  updated_at: STAMP,
};

const legacyPurchase: CreditPurchase = {
  id: 'purchase-old-1',
  user_id: 'user-old',
  card_id: null,
  description: 'Heladera',
  category: 'Hogar',
  total_amount: 120000,
  installments: 6,
  monthly_amount: 20000,
  start_date: '2026-09-15',
  currency: 'ARS',
  original_amount: 120000,
  exchange_rate: 1,
  rate_source: 'auto',
  base_currency: 'ARS',
  created_at: STAMP,
  updated_at: STAMP,
};

const card: Card = {
  id: 'card-old-1',
  user_id: 'user-old',
  name: 'Visa Galicia',
  network: 'visa',
  last_four: '1234',
  created_at: STAMP,
  updated_at: STAMP,
};

function parseData(data: JSONObject) {
  return validateAndParse({ metadata, data });
}

function emptyData(): CanonicalData {
  return {
    transactions: [],
    expense_plans: [],
    cards: [],
    credit_purchases: [],
    credit_installments: [],
    investments: [],
    loans: [],
    loan_payments: [],
    tickets: [],
    ticket_items: [],
  };
}

describe('cards sheet parsing', () => {
  it('parses a valid card with four digits and one without last_four', () => {
    const result = parseData({
      cards: [cardRow({}), cardRow({ id: 'card-old-2', name: 'Naranja', network: 'naranja', last_four: null })],
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.counts.cards).toBe(2);
    expect(result.parsed?.metadata.entities).toEqual(['cards', 'credit_purchases']);
    expect(result.parsed?.data.cards).toEqual([
      card,
      { ...card, id: 'card-old-2', name: 'Naranja', network: 'naranja', last_four: null },
    ]);
  });

  it('rejects a card whose network is not a known network', () => {
    const result = parseData({ cards: [cardRow({ network: 'diners' })] });

    expect(result.ok).toBe(false);
    expect(result.parsed?.data.cards).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('"data.cards[0]"');
    expect(result.errors[0]).toContain('field "network"');
  });

  it.each([['123'], ['12345'], ['12a4'], [1234]])('rejects a card whose last_four is %s', (lastFour) => {
    const result = parseData({ cards: [cardRow({ last_four: lastFour })] });

    expect(result.ok).toBe(false);
    expect(result.parsed?.data.cards).toEqual([]);
    expect(result.errors[0]).toContain('"data.cards[0]"');
    expect(result.errors[0]).toContain('field "last_four"');
  });

  it('rejects a card with a blank name', () => {
    const result = parseData({ cards: [cardRow({ name: '   ' })] });

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('field "name"');
  });
});

describe('credit purchase card_id parsing', () => {
  it('keeps the card_id column when the backup has it', () => {
    const result = parseData({ credit_purchases: [{ ...legacyPurchaseRow, card_id: 'card-old-1' }] });

    expect(result.ok).toBe(true);
    expect(result.parsed?.data.credit_purchases).toEqual([{ ...legacyPurchase, card_id: 'card-old-1' }]);
  });

  it('parses a purchase from a backup without card_id exactly as before, with card_id null', () => {
    const result = parseData({ credit_purchases: [legacyPurchaseRow] });

    expect(result.ok).toBe(true);
    expect(result.counts.credit_purchases).toBe(1);
    expect(result.counts.cards).toBe(0);
    expect(result.parsed?.data.cards).toEqual([]);
    expect(result.parsed?.data.credit_purchases).toEqual([legacyPurchase]);
  });

  it.each([[''], [null], [42]])('imports a purchase whose card_id is %s with card_id null', (cardId) => {
    const result = parseData({ credit_purchases: [{ ...legacyPurchaseRow, card_id: cardId }] });

    expect(result.ok).toBe(true);
    expect(result.parsed?.data.credit_purchases).toEqual([legacyPurchase]);
  });

  it('parses a spreadsheet backup made before cards existed', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([legacyPurchaseRow]), 'credit_purchases');
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([{ schemaVersion: '2', entities: 'credit_purchases', baseCurrency: 'ARS' }]),
      '_metadata'
    );
    const buffer: ArrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    const result = await parseFile(new File([buffer], 'backup-viejo.xlsx'));

    expect(result.ok).toBe(true);
    expect(result.counts.cards).toBe(0);
    expect(result.parsed?.data.cards).toEqual([]);
    expect(result.parsed?.data.credit_purchases).toEqual([legacyPurchase]);
  });
});

describe('card_id remap on import', () => {
  it('gives cards new ids and points purchases at the new id of their card', () => {
    const data: CanonicalData = {
      ...emptyData(),
      cards: [card],
      credit_purchases: [
        { ...legacyPurchase, id: 'p-known', card_id: 'card-old-1' },
        { ...legacyPurchase, id: 'p-unknown', card_id: 'card-not-exported' },
        { ...legacyPurchase, id: 'p-none', card_id: null },
      ],
    };

    const remapped = remapData(data, 'user-new');

    expect(remapped.cards).toHaveLength(1);
    const newCard = remapped.cards[0];
    expect(newCard.id).not.toBe('card-old-1');
    expect(newCard).toEqual({ ...card, id: newCard.id, user_id: 'user-new' });
    expect(remapped.credit_purchases.map((p) => p.card_id)).toEqual([newCard.id, null, null]);
    expect(remapped.credit_purchases.every((p) => p.user_id === 'user-new')).toBe(true);
    expect(remapped.credit_purchases.map((p) => p.id)).not.toContain('p-known');
  });

  it('clears the card_id of purchases whose card was not inserted', () => {
    const purchases: CreditPurchase[] = [
      { ...legacyPurchase, id: 'p-1', card_id: 'card-inserted' },
      { ...legacyPurchase, id: 'p-2', card_id: 'card-failed' },
      { ...legacyPurchase, id: 'p-3', card_id: null },
    ];

    const result = clearMissingCardIds(purchases, new Set(['card-inserted']));

    expect(result.map((p) => p.card_id)).toEqual(['card-inserted', null, null]);
    expect(result.map((p) => p.id)).toEqual(['p-1', 'p-2', 'p-3']);
  });
});

describe('cards export', () => {
  beforeEach(() => {
    db.getCards.mockReset().mockResolvedValue([card]);
    db.getCreditPurchases.mockReset().mockResolvedValue([{ ...legacyPurchase, card_id: 'card-old-1' }]);
    db.getAllCreditInstallments.mockReset().mockResolvedValue([]);
  });

  it('exports cards as their own sheet and keeps card_id on purchases through a spreadsheet round trip', async () => {
    const payload = await buildCanonicalExport('user-old', 'user@example.com', {
      entities: new Set<EntityKey>(['cards', 'credit_purchases']),
      dateRange: null,
    });

    expect(payload.data.cards).toEqual([card]);
    expect(payload.data.credit_purchases[0].card_id).toBe('card-old-1');

    const blob = serializeXLSX(payload);
    const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
    expect(wb.SheetNames).toContain('cards');

    const result = await parseFile(new File([blob], 'backup.xlsx'));

    expect(result.ok).toBe(true);
    expect(result.parsed?.metadata.entities).toEqual(['cards', 'credit_purchases']);
    expect(result.parsed?.data.cards).toEqual([card]);
    expect(result.parsed?.data.credit_purchases).toEqual([{ ...legacyPurchase, card_id: 'card-old-1' }]);
  });

  it('round trips a card without last_four through a spreadsheet', async () => {
    db.getCards.mockResolvedValue([{ ...card, last_four: null }]);
    const payload = await buildCanonicalExport('user-old', 'user@example.com', {
      entities: new Set<EntityKey>(['cards']),
      dateRange: null,
    });

    const result = await parseFile(new File([serializeXLSX(payload)], 'backup.xlsx'));

    expect(result.ok).toBe(true);
    expect(result.parsed?.data.cards).toEqual([{ ...card, last_four: null }]);
  });

  it('does not read cards when the cards entity is not selected', async () => {
    const payload = await buildCanonicalExport('user-old', 'user@example.com', {
      entities: new Set<EntityKey>(['credit_purchases']),
      dateRange: null,
    });

    expect(db.getCards).not.toHaveBeenCalled();
    expect(payload.data.cards).toEqual([]);
  });
});
