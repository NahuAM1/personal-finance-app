import type { AgentStrategy, MarketQueryPayload } from '@/types/agent';

export const marketQueryStrategy: AgentStrategy = {
  needsMarketData: true,

  buildPrompt(transcription: string, context?: string): string {
    return `Sos SmartPocket, un asistente financiero argentino. El usuario preguntó por datos de mercado.
Tenés los siguientes datos de mercado actualizados:

${context ?? 'No hay datos de mercado disponibles.'}

Respondé la pregunta del usuario usando ÚNICAMENTE los datos proporcionados arriba.
- Usa español neutro
- Sé breve y directo
- Formateá los precios con separador de miles (punto) y decimales (coma) al estilo argentino
- Si los datos no incluyen lo que pregunta, decile qué información tenés disponible

Pregunta del usuario: "${transcription}"

Respondé ÚNICAMENTE con un JSON válido (sin markdown, sin texto extra):
{"answer": "tu respuesta acá"}`;
  },

  parseResponse(raw: string): MarketQueryPayload {
    const jsonMatch =
      raw.match(/```json([\s\S]*?)```/) ||
      raw.match(/```([\s\S]*?)```/) ||
      raw.match(/\{[\s\S]*\}/);

    const cleanJson = jsonMatch
      ? jsonMatch[1]?.trim() || jsonMatch[0].trim()
      : raw;

    const parsed: { answer: string } = JSON.parse(cleanJson);

    return {
      action: 'market_query',
      answer: parsed.answer,
    };
  },
};
