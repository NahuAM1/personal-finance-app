import type { AgentStrategy, CreateSavingsGoalPayload } from '@/types/agent';
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

Transcripción: "${transcription}"

Respondé ÚNICAMENTE con un JSON válido (sin markdown, sin texto extra):
{"name": "", "targetAmount": 0, "deadline": "YYYY-MM-DD", "category": ""}`;
  },

  parseResponse(raw: string): CreateSavingsGoalPayload {
    const jsonMatch =
      raw.match(/```json([\s\S]*?)```/) ||
      raw.match(/```([\s\S]*?)```/) ||
      raw.match(/\{[\s\S]*\}/);

    const cleanJson = jsonMatch
      ? jsonMatch[1]?.trim() || jsonMatch[0].trim()
      : raw;

    const parsed: { name: string; targetAmount: number; deadline: string; category: string } = JSON.parse(cleanJson);

    return {
      action: 'create_savings_goal',
      name: parsed.name,
      targetAmount: parsed.targetAmount,
      deadline: parsed.deadline,
      category: parsed.category,
    };
  },
};
