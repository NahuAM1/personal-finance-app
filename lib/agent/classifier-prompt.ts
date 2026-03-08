import type { ConversationMessage } from '@/types/agent';

function serializeHistory(history: ConversationMessage[]): string {
  return history
    .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
    .join('\n');
}

export function buildClassifierPrompt(
  transcription: string,
  conversationHistory?: ConversationMessage[],
): string {
  const historySection = conversationHistory && conversationHistory.length > 0
    ? `
CONTEXTO DE CONVERSACIÓN PREVIA:
Usá esta conversación para entender mejor la intención del usuario:
- Si el asistente sugirió crear una meta de ahorro y el usuario dice "sí, dale" o "creala" → "create_savings_goal"
- Si el asistente sugirió registrar un gasto/ingreso y el usuario acepta → "add_expense" o "add_income"
- Si el asistente sugirió registrar una inversión y el usuario acepta → "create_investment"
- Si el asistente habló de un tema y el usuario pide más detalles → "general_question"
- Si el usuario cambia de tema, clasificá según el nuevo tema ignorando el historial

Conversación previa:
${serializeHistory(conversationHistory)}
`
    : '';

  return `Sos un clasificador de intenciones financieras. Analizá la siguiente transcripción de voz de un usuario argentino y clasificala en una de estas acciones:

- "add_expense": El usuario quiere REGISTRAR un gasto concreto que ya realizó (compra, pago, etc.)
- "add_income": El usuario quiere REGISTRAR un ingreso concreto que ya recibió (cobro, salario, venta, etc.)
- "create_savings_goal": El usuario quiere crear una meta de ahorro o plan de gasto futuro
- "credit_purchase": El usuario quiere registrar una compra en cuotas con tarjeta de crédito
- "create_investment": El usuario quiere registrar una inversión que hizo (plazo fijo, acciones, crypto, divisas, etc.)
- "dollar_rate": El usuario pregunta ESPECÍFICAMENTE por la cotización del dólar argentino
- "market_query": El usuario pregunta por el precio de CUALQUIER activo de mercado (bitcoin, crypto, acciones, bonos, CEDEARs, etc.) que NO sea cotización de dólar
- "general_question": Cualquier otra consulta financiera: análisis de gastos, recomendaciones, consejos, resúmenes de finanzas, preguntas sobre su situación económica

IMPORTANTE para distinguir entre acciones:
- Si el usuario PREGUNTA por sus gastos, ingresos, análisis o recomendaciones → "general_question" (NO add_expense/add_income)
- Si el usuario quiere REGISTRAR/CARGAR una transacción concreta → "add_expense" o "add_income"
- Si pregunta por precio de bitcoin, ethereum, acciones, bonos → "market_query" (NO general_question)
- Si pregunta por dólar específicamente → "dollar_rate"
- "en qué gasté", "cuánto gasté", "mis gastos del mes", "recomendame", "análisis" → "general_question"
- "compré bitcoin", "invertí en crypto" → "create_investment"
- "a cuánto está el bitcoin", "precio del bitcoin" → "market_query"

Palabras clave por categoría:
- GASTO: gasté, compré, pagué, pagando, me cobró (cuando REGISTRA algo ya hecho)
- INGRESO: cobré, me pagaron, me transfirieron (cuando REGISTRA algo recibido)
- META DE AHORRO: meta, ahorro, ahorrar, juntar plata, objetivo, plan de ahorro
- TARJETA/CUOTAS: cuotas, tarjeta, crédito, financiar, en X cuotas
- INVERSIÓN: invertí, compré (+ activo financiero), registrar inversión
- DÓLAR: cotización del dólar, dólar hoy, a cuánto está el dólar, tipo de cambio del dólar
- MERCADO: precio del bitcoin, a cuánto está el bitcoin/ethereum/crypto, cotización de acciones/bonos/cedears
- GENERAL: en qué gasté, mis gastos, recomendame, análisis, consejo, cómo puedo, qué me conviene, resumen
${historySection}
Transcripción: "${transcription}"

Respondé ÚNICAMENTE con un JSON válido (sin markdown, sin texto extra):
{"action": "<action>", "confidence": <0.0-1.0>}`;
}
