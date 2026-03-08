import type { AgentStrategy, CreditPurchasePayload } from '@/types/agent';
import { expenseCategories, formatCategories } from '@/public/constants';

export const creditPurchaseStrategy: AgentStrategy = {
  buildPrompt(transcription: string): string {
    return `Sos un asistente financiero argentino. Extraé los datos de una compra en cuotas con tarjeta de crédito de la transcripción de voz.

Categorías válidas: ${formatCategories(expenseCategories)}

Reglas:
- "description" debe ser una descripción breve de la compra
- "category" debe ser EXACTAMENTE una de las categorías listadas
- "totalAmount" debe ser el monto TOTAL de la compra (número positivo)
- "installments" debe ser el número de cuotas (entero positivo, mínimo 2)
- "startDate" debe ser la fecha de inicio en formato YYYY-MM-DD. Si no se menciona, usá hoy: ${new Date().toISOString().split('T')[0]}

Transcripción: "${transcription}"

Respondé ÚNICAMENTE con un JSON válido (sin markdown, sin texto extra):
{"description": "", "category": "", "totalAmount": 0, "installments": 0, "startDate": "YYYY-MM-DD"}`;
  },

  parseResponse(raw: string): CreditPurchasePayload {
    const jsonMatch =
      raw.match(/```json([\s\S]*?)```/) ||
      raw.match(/```([\s\S]*?)```/) ||
      raw.match(/\{[\s\S]*\}/);

    const cleanJson = jsonMatch
      ? jsonMatch[1]?.trim() || jsonMatch[0].trim()
      : raw;

    const parsed: { description: string; category: string; totalAmount: number; installments: number; startDate: string } = JSON.parse(cleanJson);

    return {
      action: 'credit_purchase',
      description: parsed.description,
      category: parsed.category,
      totalAmount: parsed.totalAmount,
      installments: parsed.installments,
      startDate: parsed.startDate,
    };
  },
};
