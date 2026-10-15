import type { CreditPurchasePayload } from '@/types/agent';
import type { CreditInstallment, CreditPurchase, OmitNew } from '@/types/database';

export type NewCreditPurchase = OmitNew<CreditPurchase, 'id' | 'created_at' | 'updated_at'>;
export type NewCreditInstallment = OmitNew<CreditInstallment, 'id' | 'credit_purchase_id' | 'created_at' | 'updated_at'>;

export interface AgentCreditPurchaseRecords {
  purchase: NewCreditPurchase;
  installments: NewCreditInstallment[];
}

export function buildAgentCreditPurchase(payload: CreditPurchasePayload, userId: string): AgentCreditPurchaseRecords {
  const monthlyAmount = Math.ceil((payload.totalAmount / payload.installments) * 100) / 100;

  const purchase: NewCreditPurchase = {
    user_id: userId,
    card_id: payload.cardId,
    description: payload.description,
    category: payload.category,
    total_amount: payload.totalAmount,
    installments: payload.installments,
    monthly_amount: monthlyAmount,
    start_date: payload.startDate,
  };

  const installments: NewCreditInstallment[] = [];
  const startDate = new Date(payload.startDate);

  for (let i = 0; i < payload.installments; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    installments.push({
      installment_number: i + 1,
      due_date: dueDate.toISOString().split('T')[0],
      amount: monthlyAmount,
      paid: false,
      paid_date: null,
      transaction_id: null,
    });
  }

  return { purchase, installments };
}
