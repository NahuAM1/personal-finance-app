import type { ConversationMessage } from '@/types/agent';
import { serializeHistory } from '@/lib/agent/utils/serialize-history';

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
- IMPORTANTE: Si la conversación previa fue sobre datos de un PERIODO ESPECIFICO (data_query) y el usuario hace una pregunta de seguimiento cambiando solo la categoría, el tipo o pidiendo más detalles del MISMO periodo → "data_query"
  Ejemplos: "y en Compras?", "y los ingresos?", "y en Delivery?", "cuánto fue en Servicios?", "y el mes anterior?"
  Esto aplica aunque la pregunta actual NO mencione fechas ni periodos - hereda el contexto temporal de la pregunta anterior.
- EXCEPCIÓN: Si la conversación previa fue sobre datos que NO son transacciones históricas (cuotas de tarjeta, inversiones activas, metas de ahorro) y el usuario hace un seguimiento → "general_question" (el AI tiene esos datos en su contexto financiero; ir a data_query devolvería resultados vacíos o incorrectos)
  Ejemplos de seguimiento que deben ser "general_question": "y en qué?", "de qué son?", "y el mes que viene?", "y para el próximo mes?", "y para abril?", "y para mayo?", "desglosame", "cuáles son?", "y los meses siguientes?"
  IMPORTANTE: aunque "el mes que viene" o "para mayo" parezcan referencias temporales específicas, si la conversación fue sobre cuotas/inversiones/metas deben ir a "general_question" porque esos datos NO están en la tabla de transacciones
- Si el usuario cambia de tema completamente, clasificá según el nuevo tema ignorando el historial

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
- "data_query": El usuario pregunta por datos financieros de un PERIODO ESPECIFICO que NO es el mes actual
  (ej: "cuanto gaste en enero", "mis ingresos del trimestre pasado", "compara marzo con abril",
  "historial de gastos en tecnologia", "cuanto gaste el ano pasado", "mis gastos de los ultimos 6 meses")
- "scan_receipt": El usuario quiere escanear, subir o cargar un ticket, factura, recibo o comprobante de compra
  (ej: "quiero escanear un ticket", "cargar una factura", "foto de un recibo", "subir un comprobante", "escanear una boleta")
- "general_question": Cualquier otra consulta financiera: análisis de gastos, recomendaciones, consejos, resúmenes de finanzas, preguntas sobre su situación económica

IMPORTANTE para distinguir entre acciones:
- Si el usuario PREGUNTA por sus gastos, ingresos, análisis o recomendaciones del MES ACTUAL → "general_question" (NO add_expense/add_income)
- Si el usuario PREGUNTA por sus cuotas/tarjeta existentes ("cuánto tengo que pagar de tarjeta", "total tarjeta este mes", "cuotas a pagar", "cuánto debo en cuotas", "mis cuotas de este mes") → "general_question" (NO "credit_purchase")
- Solo usar "credit_purchase" cuando el usuario REGISTRA una compra NUEVA en cuotas: debe mencionar explícitamente una compra concreta con descripción, monto total y número de cuotas (ej: "compré una heladera en 12 cuotas por $500.000")
- Si el usuario pregunta por datos de un PERIODO ESPECIFICO que NO es el mes actual → "data_query"
- Si el usuario quiere REGISTRAR/CARGAR una transacción concreta → "add_expense" o "add_income"
- Si pregunta por precio de bitcoin, ethereum, acciones, bonos → "market_query" (NO general_question)
- Si pregunta por dólar específicamente → "dollar_rate"
- Si quiere escanear/subir un ticket, factura o recibo → "scan_receipt"
- "en qué gasté", "cuánto gasté", "mis gastos del mes", "recomendame", "análisis" → "general_question"
- "cuánto gasté en enero", "gastos del trimestre pasado", "compara febrero con marzo" → "data_query"
- "mis gastos de los últimos 6 meses", "cuánto gané el año pasado" → "data_query"
- Si el usuario pregunta por la cotización del dólar Y también hace otra consulta financiera, clasificar como "general_question" (el dólar se incluirá en los datos de mercado)
- "compré bitcoin", "invertí en crypto" → "create_investment"
- "a cuánto está el bitcoin", "precio del bitcoin" → "market_query"
- "escanear ticket", "subir factura", "foto del recibo" → "scan_receipt"

Palabras clave por categoría:
- GASTO: gasté, compré, pagué, pagando, me cobró (cuando REGISTRA algo ya hecho)
- INGRESO: cobré, me pagaron, me transfirieron (cuando REGISTRA algo recibido)
- META DE AHORRO: meta, ahorro, ahorrar, juntar plata, objetivo, plan de ahorro
- TARJETA/CUOTAS para REGISTRAR → "credit_purchase": compré en X cuotas, financié con tarjeta, puse en cuotas (registrando compra nueva con monto y número de cuotas)
- TARJETA/CUOTAS para CONSULTAR → "general_question": cuánto tengo que pagar, total tarjeta, cuotas a pagar, cuánto debo de cuotas, mis cuotas de este mes
- INVERSIÓN: invertí, compré (+ activo financiero), registrar inversión
- DÓLAR: cotización del dólar, dólar hoy, a cuánto está el dólar, tipo de cambio del dólar, dólar blue, blue, dólar oficial, dólar MEP, MEP, contado con liqui, CCL
- MERCADO: precio del bitcoin, a cuánto está el bitcoin/ethereum/crypto, cotización de acciones/bonos/cedears, plazo fijo (precio/tasa), tasa, rendimiento, letras, LECAPs, cuánto rinde
- DATA QUERY: en enero, trimestre pasado, último semestre, el año pasado, compará con, entre febrero y marzo, hace X meses, desde marzo, historial de
- SCAN RECEIPT: escanear, ticket, factura, recibo, comprobante, foto de compra, subir boleta, cargar ticket
- GENERAL: en qué gasté, mis gastos, recomendame, análisis, consejo, cómo puedo, qué me conviene, resumen, cómo estoy, salud financiera, cuánto tengo que pagar de tarjeta
${historySection}
Transcripción: "${transcription}"

Respondé ÚNICAMENTE con un JSON válido (sin markdown, sin texto extra):
{"reasoning": "<1 oración explicando por qué elegiste esa acción>", "action": "<action>", "confidence": <0.0-1.0>}`;
}
