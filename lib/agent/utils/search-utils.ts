import type { ConversationMessage } from '@/types/agent';

// --- Heuristic detection: does this query need a web search? ---
// Used BEFORE calling the LLM to decide whether to inject web search results
// into the prompt context.

// Normalize accents and diacritics for matching — so "que" matches "qué", "partido" matches "pártido", etc.
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// These patterns run against the NORMALIZED transcription (accents stripped).
// Keep them lowercase — the input is lowercased before matching.
const WEB_SEARCH_PATTERNS: RegExp[] = [
  // Definitions & explanations (broad)
  /que es\b|que son\b|que significa|definicion|concepto|explicame|explica|decime que es|decime que son/i,

  // How-to / procedural
  /como (abrir|crear|comprar|invertir|empezar|hacer|funciona|opera|ingresar|registrarse|vender|transferir|retirar)/i,
  /donde (comprar|invertir|abrir|opera|vender|conseguir)/i,
  /paso a paso|pasos para|como hago para|que necesito para/i,
  /se puede/i,

  // Planned future feature (currently not supported but user might ask)
  /puedes buscar|buscame|busca en internet|buscar en internet|investiga/i,

  // Brokers & platforms — direct mentions
  /\biol\b|bull\s?market|ppi\b|cocos\b|balanz|adcap|rava\b|invertir\s?online|comitente|by\s?ma|grupo\s?bv|max\s?valores/i,

  // Financial instruments
  /\bcedear\b|bono\b|bonos\b|letras?\b|fci\b|plazo\s?fijo|acciones?\b|cripto|criptomoneda|etf\b|fondo\s?comun/i,

  // Comparisons & recommendations
  /recomendas|recomienda|cual es mejor|conviene mas|mejor opcion|peor opcion|diferencia entre/i,
  /rinde mas|rinde menos|conviene/i,

  // Current prices / market data
  /cotizacion|precio actual|valor hoy|rendimiento|tasa\b|interes\b|porcentaje\b/i,

  // General knowledge gaps
  /existe|hay alguna|conoces|sabes (de|si|que|donde|como)/i,
  /me recomendarias|que opinas de|que sabes de/i,

  // News & events
  /ultimas noticias|novedades|que paso|que pasara|que ocurrio/i,

  // Sports, events, time — anything requiring real-time info
  /partido|partidazo|resultado|horario|a que hora|cuando juega|cuando es el/i,

  // Weather, general real-time
  /clima|pronostico|temperatura|dia de hoy/i,

  // ANY "dame un plan" or specific actionable advice
  /dame un plan|generame|armame|crea un plan|sugerime|recomendame/i,

  // Trends, economy, general news
  /economia|inflacion|dolar\b|dolares|blue\b|mep\b|cc\b|tarjeta/i,
];

/**
 * Returns true if the transcription likely requires external web knowledge
 * that isn't covered by the user's financial data or pre-fetched market context.
 */
export function needsWebSearch(transcription: string): boolean {
  const normalized = normalize(transcription.toLowerCase());
  return WEB_SEARCH_PATTERNS.some(p => p.test(normalized));
}

/**
 * Check if the last assistant message in conversation history suggested a web search.
 * Used to determine if the user's current message is a response to "¿querés que busque en internet?"
 */
export function hasPendingSearch(history?: ConversationMessage[]): boolean {
  if (!history || history.length === 0) return false;
  // Walk backwards to find the last assistant message
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant') {
      return /busque\b.*interne/i.test(history[i].content);
    }
  }
  return false;
}

/**
 * Check if the user's transcription accepts a pending search suggestion.
 * Matches affirmative responses like "sí", "dale", "buscá", "ok", etc.
 */
export function userAcceptedSearch(transcription: string): boolean {
  const normalized = normalize(transcription.toLowerCase().trim());
  // Pure affirmative — user only said "sí", "dale", etc.
  if (/^(s[ií]|dale|d[aá]le|ok[a]?|sip|s[eé]|obvio|claro|d[aá]le nomas|s[ií] busqu[aé])$/i.test(normalized)) return true;
  // Direct command — user says "buscá", "busca", "buscame"
  if (/^busc(?:[aá]|ame)\b/i.test(normalized)) return true;
  // Affirmative + context — "sí buscá", "si busca", "dale busca"
  if (/^(s[ií]\s+busc|dale\s+busc|ok\s+busc)/i.test(normalized)) return true;
  return false;
}
