import { AgentAction } from '@/types/agent';
import type { AgentStrategy, DeleteTransactionPayload, AgentPayload, AgentClarificationPayload } from '@/types/agent';

export const deleteTransactionStrategy: AgentStrategy = {
  needsUserData: true,

  buildPrompt(transcription: string, context?: string): string {
    return `Sos un asistente financiero argentino. El usuario quiere eliminar una transacción existente.

Transacciones recientes del usuario (con sus IDs):
${context ?? 'No hay transacciones disponibles.'}

Transcripción: "${transcription}"

Instrucciones:
- Identificá la transacción a eliminar basándote en la descripción del usuario (última, la más reciente, una específica por monto/categoría/descripción)
- Si no queda claro cuál eliminar y hay varias candidatas → {"needsClarification": true, "question": "¿Cuál de estas transacciones querés eliminar? Podés decirme el monto o descripción."}
- Si no hay transacciones relevantes → {"needsClarification": true, "question": "No encontré transacciones recientes que coincidan. ¿Podés darme más detalles de la transacción a eliminar?"}
- Usá el ID exacto de la transacción del contexto
- transactionType debe ser "income" o "expense" según el tipo de la transacción

Respondé ÚNICAMENTE con un JSON válido (sin markdown, sin texto extra):
{"transactionId": "uuid", "description": "descripción", "amount": 0, "transactionType": "expense", "category": "categoría", "date": "YYYY-MM-DD"}`;
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
      transactionId?: string;
      description?: string;
      amount?: number;
      transactionType?: "income" | "expense";
      category?: string;
      date?: string;
    } = JSON.parse(cleanJson);

    if (parsed.needsClarification && parsed.question) {
      const clarification: AgentClarificationPayload = {
        action: AgentAction.CLARIFICATION,
        question: parsed.question,
        originalAction: 'delete_transaction',
      };
      return clarification;
    }

    const result: DeleteTransactionPayload = {
      action: AgentAction.DELETE_TRANSACTION,
      transactionId: parsed.transactionId ?? '',
      description: parsed.description ?? '',
      amount: parsed.amount ?? 0,
      transactionType: parsed.transactionType ?? 'expense',
      category: parsed.category ?? 'Otros',
      date: parsed.date ?? new Date().toISOString().split('T')[0],
    };
    return result;
  },
};
