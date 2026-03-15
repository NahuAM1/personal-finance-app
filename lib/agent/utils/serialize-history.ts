import type { ConversationMessage } from '@/types/agent';

const MAX_HISTORY_TOKENS_APPROX = 1500; // ~6000 chars

export function serializeHistory(history: ConversationMessage[]): string {
  const serialized = history
    .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
    .join('\n');

  // Trim if exceeds token budget (approx 4 chars/token)
  if (serialized.length > MAX_HISTORY_TOKENS_APPROX * 4) {
    const trimmed = history.slice(-6); // keep last 6 messages
    return trimmed
      .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
      .join('\n');
  }

  return serialized;
}
