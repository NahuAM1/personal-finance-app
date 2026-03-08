import type { AgentStrategy, AddTransactionPayload } from '@/types/agent';
import { transcriptionPrompt } from '@/public/promts/transcriptions';

export const addTransactionStrategy: AgentStrategy = {
  buildPrompt(transcription: string): string {
    return transcriptionPrompt.replace('<TRANSCRIPTION/>', transcription);
  },

  parseResponse(raw: string): AddTransactionPayload {
    const jsonMatch =
      raw.match(/```json([\s\S]*?)```/) ||
      raw.match(/```([\s\S]*?)```/) ||
      raw.match(/\{[\s\S]*\}/);

    const cleanJson = jsonMatch
      ? jsonMatch[1]?.trim() || jsonMatch[0].trim()
      : raw;

    const parsed: { type: 'income' | 'expense'; amount: number; category: string; description: string; date?: string } = JSON.parse(cleanJson);

    return {
      action: parsed.type === 'income' ? 'add_income' : 'add_expense',
      type: parsed.type,
      amount: parsed.amount,
      category: parsed.category,
      description: parsed.description,
      date: parsed.date ?? new Date().toISOString().split('T')[0],
    };
  },
};
