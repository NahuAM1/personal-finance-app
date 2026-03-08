import type { AgentStrategy, GeneralQuestionPayload } from '@/types/agent';

export const generalQuestionStrategy: AgentStrategy = {
  needsUserData: true,

  buildPrompt(transcription: string, context?: string): string {
    return `Sos SmartPocket, un asistente financiero personal argentino amigable y profesional.
Tenés acceso a los datos financieros reales del usuario:

${context ?? 'No hay datos financieros disponibles todavía.'}

Reglas:
- Usá español rioplatense (vos, tenés, etc.)
- Respondé usando los DATOS REALES del usuario cuando la pregunta sea sobre sus finanzas
- Si pregunta en qué gastó, analizá sus transacciones y dales un resumen concreto con montos
- Si pide recomendaciones, basalas en sus datos reales (ej: "gastaste mucho en Delivery este mes")
- Si pregunta algo que no está en los datos, decíselo honestamente
- Sé breve pero informativo (máximo 5-6 oraciones)
- Si la pregunta no es financiera, respondé amablemente que solo podés ayudar con temas financieros
- No uses markdown, respondé en texto plano
- Formateá montos como $X.XXX (con punto para miles)

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
