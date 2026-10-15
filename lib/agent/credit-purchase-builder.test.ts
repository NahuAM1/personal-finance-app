import { describe, expect, it } from 'vitest';
import { buildAgentCreditPurchase } from '@/lib/agent/credit-purchase-builder';
import type { CreditPurchasePayload } from '@/types/agent';

const basePayload: CreditPurchasePayload = {
  action: 'credit_purchase',
  description: 'Heladera',
  category: 'Hogar',
  totalAmount: 1000,
  installments: 3,
  startDate: '2026-06-15',
  cardId: null,
};

describe('buildAgentCreditPurchase', () => {
  it('saves the card chosen in the confirmation as the card of the purchase', () => {
    const { purchase } = buildAgentCreditPurchase({ ...basePayload, cardId: 'card-1' }, 'user-1');

    expect(purchase.card_id).toBe('card-1');
  });

  it('saves the purchase without a card when none was chosen', () => {
    const { purchase } = buildAgentCreditPurchase(basePayload, 'user-1');

    expect(purchase.card_id).toBeNull();
  });

  it('keeps the purchase data, the rounded monthly amount and the monthly due dates', () => {
    const { purchase, installments } = buildAgentCreditPurchase(basePayload, 'user-1');

    expect(purchase).toEqual({
      user_id: 'user-1',
      card_id: null,
      description: 'Heladera',
      category: 'Hogar',
      total_amount: 1000,
      installments: 3,
      monthly_amount: 333.34,
      start_date: '2026-06-15',
    });
    expect(installments).toEqual([
      { installment_number: 1, due_date: '2026-06-15', amount: 333.34, paid: false, paid_date: null, transaction_id: null },
      { installment_number: 2, due_date: '2026-07-15', amount: 333.34, paid: false, paid_date: null, transaction_id: null },
      { installment_number: 3, due_date: '2026-08-15', amount: 333.34, paid: false, paid_date: null, transaction_id: null },
    ]);
  });
});
