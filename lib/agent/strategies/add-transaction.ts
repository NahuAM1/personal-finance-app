import { AgentAction } from '@/types/agent';
import type { AgentStrategy, AddTransactionPayload, AgentPayload, AgentClarificationPayload } from '@/types/agent';
import { transcriptionPrompt } from '@/public/promts/transcriptions';

const clarificationSuffix = `

IMPORTANTE: Si la transcripción NO contiene suficiente información para completar los campos requeridos con confianza, respondé con:
{"needsClarification": true, "question": "tu pregunta acá"}

Ejemplos de cuándo repreguntar:
- Sin monto mencionado y no se puede inferir → "¿Cuánto gastaste?"
- No queda claro si es gasto o ingreso → "¿Es un gasto o un ingreso?"
- Mensaje demasiado vago sin contexto de transacción → "¿Cuánto fue y en qué categoría?"

Solo usá needsClarification si REALMENTE falta información crítica. Si podés inferir razonablemente, hacelo.`;

export const addTransactionStrategy: AgentStrategy = {
  buildPrompt(transcription: string): string {
    return transcriptionPrompt.replace('<TRANSCRIPTION/>', transcription) + clarificationSuffix;
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
      type?: 'income' | 'expense';
      amount?: number;
      category?: string;
      description?: string;
      date?: string;
    } = JSON.parse(cleanJson);

    if (parsed.needsClarification && parsed.question) {
      const clarification: AgentClarificationPayload = {
        action: AgentAction.CLARIFICATION,
        question: parsed.question,
        originalAction: parsed.type === 'income' ? 'add_income' : 'add_expense',
        partialData: {
          ...(parsed.amount !== undefined && { amount: parsed.amount }),
          ...(parsed.category !== undefined && { category: parsed.category }),
          ...(parsed.type !== undefined && { transactionType: parsed.type }),
        },
      };
      return clarification;
    }

    const result: AddTransactionPayload = {
      action: parsed.type === 'income' ? 'add_income' : 'add_expense',
      type: parsed.type ?? 'expense',
      amount: parsed.amount ?? 0,
      category: parsed.category ?? 'Otros',
      description: parsed.description ?? '',
      date: parsed.date ?? new Date().toISOString().split('T')[0],
    };
    return result;
  },
};
