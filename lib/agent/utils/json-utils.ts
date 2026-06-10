/**
 * Utilities compartidas para parsear JSON de respuestas de modelos.
 * Extraído de las implementaciones duplicadas en route.ts y cada estrategia.
 */

/**
 * Limpia la respuesta cruda del modelo: saca thinking tags, extrae JSON de code fences,
 * encuentra el objeto/array más externo.
 */
export function extractJson(raw: string): string {
  if (!raw || raw.trim().length === 0) {
    return '{}';
  }

  // Strip thinking tags (e.g. <think>...</think>) that some models emit
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Try code fences first
  const fenceMatch =
    cleaned.match(/```json\s*([\s\S]*?)```/) ||
    cleaned.match(/```\s*([\s\S]*?)```/);
  if (fenceMatch && fenceMatch[1]?.trim()) {
    cleaned = fenceMatch[1].trim();
  } else {
    // Extract the outermost JSON object or array
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (objectMatch) {
      cleaned = objectMatch[0];
    } else if (arrayMatch) {
      cleaned = arrayMatch[0];
    }
  }

  // Remove trailing commas before closing braces/brackets (common AI mistake)
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  return cleaned;
}

/**
 * Parsea JSON de forma segura con fallback.
 * Primero intenta parse directo, si falla intenta reemplazar comillas simples.
 */
export function safeParseJson<T>(raw: string, fallback: T): T {
  const cleaned = extractJson(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Second attempt: try to fix common issues like unquoted property names
    try {
      const fixedQuotes = cleaned.replace(/'/g, '"');
      return JSON.parse(fixedQuotes) as T;
    } catch {
      return fallback;
    }
  }
}
