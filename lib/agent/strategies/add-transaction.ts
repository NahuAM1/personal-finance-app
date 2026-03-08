import type { AgentStrategy, AddTransactionPayload } from '@/types/agent';
import { expenseCategories, incomeCategories, formatCategories } from '@/public/constants';

export const addTransactionStrategy: AgentStrategy = {
  buildPrompt(transcription: string): string {
    return `Sos un asistente financiero argentino. Extraé los datos de esta transacción de la transcripción de voz.

Categorías de gasto válidas: ${formatCategories(expenseCategories)}
Categorías de ingreso válidas: ${formatCategories(incomeCategories)}

Reglas:
- "type" debe ser "expense" o "income" según corresponda
- "amount" debe ser un número positivo (sin signo de pesos)
- "category" debe ser EXACTAMENTE una de las categorías listadas arriba
- "description" debe ser breve y descriptiva
- "date" debe ser la fecha en formato YYYY-MM-DD. Si no se menciona fecha, usá la fecha de hoy: ${new Date().toISOString().split('T')[0]}
- Si dice "ayer", restá un día. Si dice "la semana pasada", restá 7 días.

Transcripción: "${transcription}"

Respondé ÚNICAMENTE con un JSON válido (sin markdown, sin texto extra):
{"type": "expense|income", "amount": 0, "category": "", "description": "", "date": "YYYY-MM-DD"}`;
  },

  parseResponse(raw: string): AddTransactionPayload {
    const jsonMatch =
      raw.match(/```json([\s\S]*?)```/) ||
      raw.match(/```([\s\S]*?)```/) ||
      raw.match(/\{[\s\S]*\}/);

    const cleanJson = jsonMatch
      ? jsonMatch[1]?.trim() || jsonMatch[0].trim()
      : raw;

    const parsed: { type: 'income' | 'expense'; amount: number; category: string; description: string; date: string } = JSON.parse(cleanJson);

    return {
      action: parsed.type === 'income' ? 'add_income' : 'add_expense',
      type: parsed.type,
      amount: parsed.amount,
      category: parsed.category,
      description: parsed.description,
      date: parsed.date,
    };
  },
};
