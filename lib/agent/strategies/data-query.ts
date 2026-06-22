import type { AgentStrategy, DataQueryPayload, ConversationMessage } from '@/types/agent';
import { serializeHistory } from '@/lib/agent/utils/serialize-history';
import { buildDatePromptSection } from '@/lib/agent/utils/date-utils';
import { safeParseJson } from '@/lib/agent/utils/json-utils';

export const dataQueryParamStrategy: AgentStrategy = {
  needsUserData: false,
  needsMarketData: false,

  buildPrompt(transcription: string, _context?: string, conversationHistory?: ConversationMessage[]): string {
    const historySection = conversationHistory && conversationHistory.length > 0
      ? `
<conversation_context>
${serializeHistory(conversationHistory)}

<follow_up_rules>
Si la consulta actual es una continuacion de la conversacion previa (ej: "y en Compras?", "y en febrero?", "y los ingresos?"):
- HEREDA los parametros que no se mencionan explicitamente de la consulta anterior
- Si antes pregunto por "noviembre del ano pasado en Entretenimiento" y ahora dice "y en Compras?" → mantener noviembre, cambiar solo categoria
- Si antes pregunto por "gastos en enero" y ahora dice "y en febrero?" → mantener tipo expense, cambiar solo fechas
- Si antes pregunto por "gastos en Delivery" y ahora dice "y los ingresos?" → mantener mismas fechas, cambiar tipo a income
</follow_up_rules>
</conversation_context>`
      : '';

    const dateSection = buildDatePromptSection();

    return `<role>
Sos un parser de consultas financieras. Extrae los parametros de busqueda de la siguiente consulta del usuario.
</role>

${dateSection}
${historySection}

<rules>
TIPO DE TRANSACCION:
- Si pregunta por gastos → "expense"
- Si pregunta por ingresos → "income"
- Si pregunta por tarjeta/cuotas → "credit"
- Si no especifica → "all"

CATEGORIA:
- Gastos: Compras, Servicios, Salidas, Delivery, Auto, Transporte, Deporte, Entretenimiento, Salud, Ropa, Tecnologia, Educacion, Hogar, Otros
- Ingresos: Salario, Freelance, Inversiones, Alquiler, Venta, Bono, Regalo, Otros
- Si no especifica → "all" (devuelve todas)

DATA SCOPE:
- Transacciones/gastos/ingresos → "transactions"
- Inversiones → "investments"
- Compras en cuotas/tarjeta → "credit_purchases"
- Metas/ahorro → "savings_goals"
- General o multiples → "all"

QUERY INTENT:
- "cuanto gaste" / "total de" → "sum"
- "listame" / "cuales fueron" / "detalle" → "list"
- "compara" / "diferencia entre" / "vs" → "compare"
- "tendencia" / "evolucion" / "como fue" → "trend"
- "que gaste en" (especifico) → "detail"
</rules>

<output>
<user_input>${transcription}</user_input>

Respondé ÚNICAMENTE con un JSON válido (sin markdown, sin texto extra):
{
  "dateFrom": "YYYY-MM-DD",
  "dateTo": "YYYY-MM-DD",
  "transactionType": "income" | "expense" | "credit" | "all",
  "category": "NombreCategoria" | "all",
  "comparisonDateFrom": "YYYY-MM-DD" | null,
  "comparisonDateTo": "YYYY-MM-DD" | null,
  "dataScope": "transactions" | "investments" | "credit_purchases" | "savings_goals" | "all",
  "queryIntent": "sum" | "list" | "compare" | "trend" | "detail"
}
</output>`;
  },

  parseResponse(raw: string): DataQueryPayload {
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
  financialContext?: string,
): string {
  const historySection = conversationHistory && conversationHistory.length > 0
    ? `\n<conversation_history>\n${serializeHistory(conversationHistory)}\n</conversation_history>`
    : '';

  const finContextSection = financialContext
    ? `\n<financial_context>\n${financialContext}\n</financial_context>`
    : '';

  return `<personality>
Sos SmartPocket, un asesor financiero personal argentino. Directo, con datos concretos.
</personality>
${historySection}

<user_query>
${transcription}
</user_query>

<query_results>
${queryResults}
</query_results>
${finContextSection}

<rules>
- Responde la consulta de forma DIRECTA y CONCRETA
- Usa los datos reales proporcionados, NO inventes numeros
- PRECEDENCIA DE DATOS: <query_results> contiene los datos ESPECÍFICOS del período que pidió el usuario. USA ESTOS para responder la consulta principal. <financial_context> es contexto SUPLEMENTARIO (scoring, metas, perfil de riesgo, inversiones). No lo uses para responder fechas, montos, o comparaciones — solo para análisis complementarios.
- Si <query_results> incluye "Evolucion mes a mes:", USA esos valores para hablar de tendencias entre meses. No uses la sección <comparison> de <financial_context> para eso, porque solo compara con el mes anterior.
- Si hay <financial_context>, USA ambos: los datos del periodo (<query_results>) para numeros concretos, y el contexto financiero (<financial_context>) para scoring, tendencias, metas, inversiones y analisis general
- Si el usuario pregunto "segun la altura del mes" o "como vengo segun el dia del mes": usa el dato Day_of_month del contexto para proyectar el ritmo actual (ej: "vas X% del mes, a este ritmo gastarias $Y")
- Si pidio historico/tendencia de X meses: usa los datos del periodo solicitado en query_results para mostrar la evolucion
- Si la consulta requiere analisis de salud financiera (scoring, recomendaciones), usa <financial_context> que contiene el scoring, perfil de riesgo, patrones y alertas
- Si el usuario pidio una comparacion, mostra ambos periodos lado a lado
- Si pidio un total, da el numero y un breve contexto
- Si pidio una lista, mostra las transacciones relevantes
- Si pidio tendencia, describe la evolucion con datos concretos mes a mes
- Si la consulta es una continuacion de la conversacion previa, responde en ese contexto
- NO repitas la misma sugerencia o pregunta que ya hayas hecho antes en la conversacion. Si ya ofreciste "¿Queres que veamos como mejorar en [categoria]?" y el usuario no respondio afirmativamente, no lo repitas.
- Si el usuario cambio de tema respecto a tu ultima respuesta, responde al NUEVO tema. No continúes con el tema anterior.
- Revisá el historial de la conversacion para evitar repetir informacion que ya diste.
- Español neutro
- Montos como $2.500 (punto para miles)
- Maximo 5-6 oraciones DIRECTAS
- Texto plano, sin markdown
- Si no hay datos, deci que no se encontraron transacciones en ese periodo
</rules>

<output>
Respondé ÚNICAMENTE con un JSON válido (sin markdown, sin texto extra):
{"answer": "tu respuesta aca"}
</output>`;
}
