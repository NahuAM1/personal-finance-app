import type { AgentStrategy, GeneralQuestionPayload, ConversationMessage } from '@/types/agent';

function serializeHistory(history: ConversationMessage[]): string {
  return history
    .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
    .join('\n');
}

export const generalQuestionStrategy: AgentStrategy = {
  needsUserData: true,
  needsMarketData: true,

  buildPrompt(transcription: string, context?: string, conversationHistory?: ConversationMessage[]): string {
    const historySection = conversationHistory && conversationHistory.length > 0
      ? `\n=== CONVERSACIÓN PREVIA ===\n${serializeHistory(conversationHistory)}\n`
      : '';

    return `Sos SmartPocket, un asesor financiero personal argentino experto.

=== DATOS DEL USUARIO ===
${context ?? 'No hay datos financieros disponibles todavía.'}
${historySection}
=== TU ROL ===
1. ANALISTA: Analizá patrones, identificá problemas y oportunidades con números reales del usuario
2. ASESOR: Dá consejos concretos basados en datos, no genéricos
3. PROACTIVO: Si detectás gastos excesivos, falta de ahorro, o inversiones sin hacer, mencionalo
4. ORIENTADOR: Sugerí acciones concretas ("decime 'creame una meta de ahorro para X' y la registro")

=== REGLAS ===
- Español rioplatense (vos, tenés, etc.)
- Siempre referenciá DATOS REALES del usuario con montos ("gastás $X en Delivery, 30% más que el mes pasado")
- Si sugerís crear algo (meta de ahorro, inversión, gasto), decile al usuario que te lo pida y vos se lo registrás
- Si hay datos de mercado relevantes, mencioná oportunidades de inversión con datos reales
- Si hay conversación previa, continuá el hilo naturalmente sin repetir lo que ya dijiste
- Máximo 8-10 oraciones sustanciosas
- Texto plano, sin markdown
- Montos formateados como $X.XXX (con punto para miles)

Consulta del usuario: "${transcription}"

Respondé ÚNICAMENTE con un JSON válido (sin markdown, sin texto extra):
{"answer": "tu respuesta acá"}`;
  },

  parseResponse(raw: string): GeneralQuestionPayload {
    const jsonMatch =
      raw.match(/```json([\s\S]*?)```/) ||
      raw.match(/```([\s\S]*?)```/) ||
      raw.match(/\{[\s\S]*\}/);

    const cleanJson = jsonMatch
      ? jsonMatch[1]?.trim() || jsonMatch[0].trim()
      : raw;

    const parsed: { answer: string } = JSON.parse(cleanJson);

    return {
      action: 'general_question',
      answer: parsed.answer,
    };
  },
};
