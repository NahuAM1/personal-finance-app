import { AgentAction } from '@/types/agent';
import type { AgentStrategy, CreateSavingsGoalPayload, AgentPayload, AgentClarificationPayload } from '@/types/agent';
import { expenseCategories, formatCategories } from '@/public/constants';

export const createSavingsGoalStrategy: AgentStrategy = {
  buildPrompt(transcription: string): string {
    return `Sos un asistente financiero argentino. Extraé los datos de una meta de ahorro de la transcripción de voz.

Categorías válidas: ${formatCategories(expenseCategories)}

Reglas:
- "name" debe ser un nombre descriptivo para la meta (ej: "Auto nuevo", "Vacaciones")
- "targetAmount" debe ser un número positivo (el monto objetivo)
- "deadline" debe ser una fecha en formato YYYY-MM-DD. Si no se menciona, poné una fecha razonable (6 meses a 1 año desde hoy: ${new Date().toISOString().split('T')[0]})
- "category" debe ser EXACTAMENTE una de las categorías listadas

IMPORTANTE: Si la transcripción NO contiene suficiente información para completar los campos requeridos con confianza, respondé con:
{"needsClarification": true, "question": "tu pregunta acá"}

Ejemplos de cuándo repreguntar:
- Sin nombre ni objetivo claro → "¿Para qué querés ahorrar y cuánto necesitás?"
- Sin monto objetivo → "¿Cuánto necesitás juntar?"
- Mensaje muy vago → "¿Qué meta de ahorro querés crear? Decime el nombre y el monto objetivo"

Solo usá needsClarification si REALMENTE falta información crítica. Si podés inferir razonablemente, hacelo.

Transcripción: "${transcription}"

Respondé ÚNICAMENTE con un JSON válido (sin markdown, sin texto extra):
{"name": "", "targetAmount": 0, "deadline": "YYYY-MM-DD", "category": ""}`;
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
      name?: string;
      targetAmount?: number;
      deadline?: string;
      category?: string;
    } = JSON.parse(cleanJson);

    if (parsed.needsClarification && parsed.question) {
      const clarification: AgentClarificationPayload = {
        action: AgentAction.CLARIFICATION,
        question: parsed.question,
        originalAction: 'create_savings_goal',
      };
      return clarification;
    }

    const result: CreateSavingsGoalPayload = {
      action: 'create_savings_goal',
      name: parsed.name ?? '',
      targetAmount: parsed.targetAmount ?? 0,
      deadline: parsed.deadline ?? '',
      category: parsed.category ?? 'Otros',
    };
    return result;
  },
};
