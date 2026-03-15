import type { ConversationMessage } from '@/types/agent';

const MAX_HISTORY_TOKENS_APPROX = 1500; // ~6000 chars

export function serializeHistory(history: ConversationMessage[]): string {
  const serialized = history
    .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
    .join('\n');

  // Trim if exceeds token budget (approx 4 chars/token)
  if (serialized.length > MAX_HISTORY_TOKENS_APPROX * 4) {
    const budget = MAX_HISTORY_TOKENS_APPROX * 4;
    const reversed = [...history].reverse();
    const kept: ConversationMessage[] = [];
    let accumulated = 0;
    for (const msg of reversed) {
      const line = `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}\n`;
      if (accumulated + line.length > budget) break;
      kept.unshift(msg);
      accumulated += line.length;
    }
    return kept
      .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
      .join('\n');
  }

  return serialized;
}
