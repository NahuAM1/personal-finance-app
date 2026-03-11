import { AgentAction } from '@/types/agent';
import type { AgentStrategy, CreditPurchasePayload, AgentPayload, AgentClarificationPayload } from '@/types/agent';
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

IMPORTANTE: Si la transcripción NO contiene suficiente información para completar los campos requeridos con confianza, respondé con:
{"needsClarification": true, "question": "tu pregunta acá"}

Ejemplos de cuándo repreguntar:
- Sin número de cuotas → "¿En cuántas cuotas?"
- Sin monto → "¿Cuánto fue el total de la compra?"
- Sin cuotas ni monto → "¿Cuánto fue el total y en cuántas cuotas?"

Solo usá needsClarification si REALMENTE falta información crítica. Si podés inferir razonablemente, hacelo.

Transcripción: "${transcription}"

Respondé ÚNICAMENTE con un JSON válido (sin markdown, sin texto extra):
{"description": "", "category": "", "totalAmount": 0, "installments": 0, "startDate": "YYYY-MM-DD"}`;
  },

  parseResponse(raw: string): AgentPayload {
    const jsonMatch =
      raw.match(/```json([\s\S]*?)```/) ||
      raw.match(/```([\s\S]*?)```/) ||
      raw.match(/\{[\s\S]*\}/);

    const cleanJson = jsonMatch
      ? jsonMatch[1]?.trim() || jsonMatch[0].trim()
      : raw;

    const parsed: {
      needsClarification?: boolean;
      question?: string;
      description?: string;
      category?: string;
      totalAmount?: number;
      installments?: number;
      startDate?: string;
    } = JSON.parse(cleanJson);

    if (parsed.needsClarification && parsed.question) {
      const clarification: AgentClarificationPayload = {
        action: AgentAction.CLARIFICATION,
        question: parsed.question,
        originalAction: 'credit_purchase',
      };
      return clarification;
    }

    const result: CreditPurchasePayload = {
      action: 'credit_purchase',
      description: parsed.description ?? '',
      category: parsed.category ?? 'Otros',
      totalAmount: parsed.totalAmount ?? 0,
      installments: parsed.installments ?? 2,
      startDate: parsed.startDate ?? new Date().toISOString().split('T')[0],
    };
    return result;
  },
};
