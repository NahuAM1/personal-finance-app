import type { AgentStrategy, DataQueryPayload, ConversationMessage } from '@/types/agent';

function serializeHistory(history: ConversationMessage[]): string {
  return history
    .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
    .join('\n');
}

export const dataQueryParamStrategy: AgentStrategy = {
  needsUserData: false,
  needsMarketData: false,

  buildPrompt(transcription: string, _context?: string, conversationHistory?: ConversationMessage[]): string {
    const historySection = conversationHistory && conversationHistory.length > 0
      ? `
CONVERSACION PREVIA (usa esto para resolver referencias implicitas como "y en Compras?", "y el mes anterior?", etc.):
${serializeHistory(conversationHistory)}

IMPORTANTE: Si la consulta actual es una continuacion de la conversacion previa (ej: "y en Compras?", "y en febrero?", "y los ingresos?"),
HEREDA los parametros que no se mencionan explicitamente de la consulta anterior.
Por ejemplo:
- Si antes pregunto por "noviembre del ano pasado en Entretenimiento" y ahora dice "y en Compras?" → mantener noviembre 2025, cambiar solo la categoria a Compras
- Si antes pregunto por "gastos en enero" y ahora dice "y en febrero?" → mantener tipo expense, cambiar solo las fechas a febrero
- Si antes pregunto por "gastos en Delivery" y ahora dice "y los ingresos?" → mantener las mismas fechas, cambiar tipo a income
`
      : '';

    return `Sos un parser de consultas financieras. Extrae los parametros de busqueda de la siguiente consulta del usuario.

Fecha actual: 2026-03-12 (jueves)
${historySection}
REGLAS DE PARSEO DE FECHAS:
- "enero" / "en enero" → dateFrom: "2026-01-01", dateTo: "2026-01-31"
- "enero 2025" → dateFrom: "2025-01-01", dateTo: "2025-01-31"
- "este mes" → dateFrom: "2026-03-01", dateTo: "2026-03-12"
- "mes pasado" / "febrero" → dateFrom: "2026-02-01", dateTo: "2026-02-28"
- "ultimo trimestre" → ultimos 3 meses completos: dateFrom: "2025-12-01", dateTo: "2026-02-28"
- "este trimestre" → dateFrom: "2026-01-01", dateTo: "2026-03-12"
- "la semana pasada" → lunes a domingo de la semana anterior
- "hace 3 meses" → desde hace 3 meses hasta hoy
- "ultimos 6 meses" → desde hace 6 meses hasta hoy
- "el ano pasado" / "2025" → dateFrom: "2025-01-01", dateTo: "2025-12-31"
- "este ano" → dateFrom: "2026-01-01", dateTo: "2026-03-12"
- "desde marzo hasta mayo" → dateFrom del inicio del primer mes, dateTo del fin del ultimo
- "entre febrero y abril" → dateFrom: "2026-02-01", dateTo: "2026-04-30"
- "compara enero con febrero" → dateFrom/dateTo para febrero, comparisonDateFrom/To para enero
- "noviembre del ano pasado" → dateFrom: "2025-11-01", dateTo: "2025-11-30"

REGLAS DE TIPO DE TRANSACCION:
- Si pregunta por gastos → "expense"
- Si pregunta por ingresos → "income"
- Si pregunta por tarjeta/cuotas → "credit"
- Si no especifica → "all"

REGLAS DE CATEGORIA:
- Mapear al nombre exacto: Compras, Servicios, Salidas, Delivery, Auto, Transporte, Deporte, Entretenimiento, Salud, Ropa, Tecnologia, Educacion, Hogar, Otros
- Para ingresos: Salario, Freelance, Inversiones, Alquiler, Venta, Bono, Regalo, Otros
- Si no especifica → "all"

REGLAS DE DATA SCOPE:
- Si pregunta por transacciones/gastos/ingresos → "transactions"
- Si pregunta por inversiones → "investments"
- Si pregunta por compras en cuotas/tarjeta → "credit_purchases"
- Si pregunta por metas/ahorro → "savings_goals"
- Si pregunta general o multiples cosas → "all"

REGLAS DE QUERY INTENT:
- "cuanto gaste" / "total de" → "sum"
- "listame" / "cuales fueron" / "detalle" → "list"
- "compara" / "diferencia entre" / "vs" → "compare"
- "tendencia" / "evolucion" / "como fue" → "trend"
- "que gaste en" (especifico) → "detail"

Consulta del usuario: "${transcription}"

Responde UNICAMENTE con un JSON valido (sin markdown, sin texto extra):
{
  "dateFrom": "YYYY-MM-DD",
  "dateTo": "YYYY-MM-DD",
  "transactionType": "income" | "expense" | "credit" | "all",
  "category": "NombreCategoria" | "all",
  "comparisonDateFrom": "YYYY-MM-DD" | null,
  "comparisonDateTo": "YYYY-MM-DD" | null,
  "dataScope": "transactions" | "investments" | "credit_purchases" | "savings_goals" | "all",
  "queryIntent": "sum" | "list" | "compare" | "trend" | "detail"
}`;
  },

  parseResponse(raw: string): DataQueryPayload {
    // This strategy's parseResponse is not used in the normal flow
    // The data_query action has a special two-pass handling in route.ts
    return {
      action: 'data_query',
      answer: raw,
    };
  },
};

export function buildDataAnswerPrompt(
  transcription: string,
  queryResults: string,
  conversationHistory?: ConversationMessage[],
): string {
  const historySection = conversationHistory && conversationHistory.length > 0
    ? `\nConversacion previa:\n${serializeHistory(conversationHistory)}\n`
    : '';

  return `Sos SmartPocket, un asesor financiero personal argentino experto.
${historySection}
El usuario hizo esta consulta: "${transcription}"

Estos son los datos reales de su cuenta:
${queryResults}

REGLAS:
- Responde la consulta de forma DIRECTA y CONCRETA
- Usa los datos reales proporcionados, NO inventes numeros
- Si el usuario pidio una comparacion, mostra ambos periodos lado a lado
- Si pidio un total, da el numero y un breve contexto
- Si pidio una lista, mostra las transacciones relevantes
- Si pidio tendencia, describe la evolucion
- Si la consulta es una continuacion de la conversacion previa, responde en ese contexto
- Espanol rioplatense (vos, tenes)
- Montos como $X.XXX (punto para miles)
- Maximo 5-6 oraciones DIRECTAS
- Texto plano, sin markdown
- Si no hay datos, deci que no se encontraron transacciones en ese periodo

Responde UNICAMENTE con un JSON valido (sin markdown, sin texto extra):
{"answer": "tu respuesta aca"}`;
}
