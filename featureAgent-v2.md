# Plan: Agente AI Inteligente — SmartPocket Financial Advisor

## Contexto

El agente AI actual funciona como un "command parser": el usuario dice algo, se clasifica en 1 de 8 acciones, se ejecuta, fin. Cada turno es independiente, no hay memoria de conversación, y las respuestas de `general_question` son básicas.

El objetivo es transformarlo en un **asesor financiero inteligente** que:

1. **Tenga memoria conversacional (multi-turn):** "tengo problemas financieros" → consejo → "contame más de lo de crypto" → elabora
2. **Dé consejos proactivos** basados en datos reales del usuario + datos de mercado en tiempo real
3. **Sugiera acciones y las ejecute:** "Te conviene crear una meta de ahorro" → user: "dale, creala" → clasifica correctamente gracias al historial
4. **Dé insights inteligentes en las confirmaciones:** no solo "Gasto detectado" sino "Gasto en Delivery detectado. Ya llevás $23.000 en Delivery este mes, 40% más que el mes pasado"

---

## Archivos a Modificar

| Archivo | Cambio |
|---|---|
| `types/agent.ts` | Agregar `ConversationMessage`, actualizar firma de `AgentStrategy.buildPrompt` |
| `lib/agent/classifier-prompt.ts` | Aceptar historial conversacional para multi-turn |
| `lib/agent/strategies/general-question.ts` | Agregar `needsMarketData: true`, reescribir prompt como asesor financiero |
| `lib/agent/agent-service.ts` | Pasar `ConversationMessage[]` a `classify` y `execute` |
| `app/api/agent/route.ts` | Aceptar historial, enriquecer contexto financiero (mes anterior, cuotas, tendencias), agregar insights inteligentes |
| `contexts/agent-context.tsx` | Serializar mensajes recientes y enviarlos con cada request |

---

## Implementación Paso a Paso

### Paso 1 — Tipos (`types/agent.ts`)

Agregar interfaz liviana para historial:

```ts
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}
```

Actualizar firma de `AgentStrategy`:

```ts
export interface AgentStrategy {
  buildPrompt: (
    transcription: string,
    context?: string,
    conversationHistory?: ConversationMessage[]
  ) => string;
  parseResponse: (raw: string) => AgentPayload;
  needsUserData?: boolean;
  needsMarketData?: boolean;
}
```

---

### Paso 2 — Classifier con historial (`lib/agent/classifier-prompt.ts`)

Actualizar `buildClassifierPrompt` para aceptar `conversationHistory?: ConversationMessage[]`.

Agregar sección al prompt:

```
CONTEXTO DE CONVERSACIÓN:
Si hay conversación previa, usala para entender la intención:
- Si el asistente sugirió crear una meta de ahorro y el usuario dice "si, dale" → "create_savings_goal"
- Si el asistente habló de inversiones y el usuario dice "invertí" → "create_investment"
- Si el usuario pide más detalles → "general_question"

[historial serializado aquí]
```

Esto habilita el flujo: agent sugiere meta de ahorro → user dice "si dale" → classifier lo detecta correctamente.

---

### Paso 3 — General Question como Asesor Financiero (`lib/agent/strategies/general-question.ts`)

**Cambio 1:** Agregar `needsMarketData: true` — así recibe datos de mercado además de datos del usuario.

**Cambio 2:** Reescribir prompt con rol de asesor financiero experto:

```
Sos SmartPocket, un asesor financiero personal argentino experto.

=== DATOS DEL USUARIO ===
{context}

=== TU ROL ===
1. ANALISTA: Analizá patrones, identificá problemas y oportunidades con números reales
2. ASESOR: Dá consejos concretos basados en datos, no genéricos
3. PROACTIVO: Si detectás gastos excesivos, falta de ahorro, o inversiones sin hacer, mencionalo
4. ORIENTADOR: Sugerí acciones concretas ("decime 'creame una meta de ahorro para X' y la registro")

=== REGLAS ===
- Español rioplatense
- Siempre referenciá DATOS REALES con montos ("gastás $X en Delivery, 30% más que el mes pasado")
- Si sugerís crear algo, decile al usuario que te lo pida
- Si hay datos de mercado relevantes, mencioná oportunidades de inversión con datos reales
- Máximo 8-10 oraciones sustanciosas
- Texto plano, sin markdown
- Montos formateados como $X.XXX
```

---

### Paso 4 — Enriquecer Contexto Financiero (`app/api/agent/route.ts` → `buildUserFinancialContext`)

Agregar al `Promise.all` existente:

1. **Transacciones del mes anterior** — para comparación de tendencias
2. **Cuotas de tarjeta impagas** — via `credit_installments` (join con `credit_purchases` para descripción)

Nuevas secciones en el contexto:

```
=== COMPARACIÓN CON MES ANTERIOR ===
Gastos mes anterior: $X | Este mes: $Y (+Z%)
Categorías con mayor aumento: Delivery (+45%), Salidas (+20%)
Categorías que bajaron: Transporte (-10%)

=== PRÓXIMAS CUOTAS A PAGAR ===
- MacBook Pro: Cuota 3/12 - $45.000 - Vence 2026-03-15
- Televisor: Cuota 1/6 - $30.000 - Vence 2026-03-20
Total cuotas pendientes: $75.000

=== TENDENCIA ===
Balance mes anterior: $X → Balance actual: $Y
Tendencia: Mejorando/Empeorando
Portfolio inversiones activas: $X
```

Queries adicionales en el `Promise.all`:

```ts
// Mes anterior
supabase.from('transactions')
  .select('type, amount, category')
  .eq('user_id', userId)
  .gte('date', startOfPrevMonth)
  .lte('date', endOfPrevMonth),

// Cuotas impagas (próximas 10)
supabase.from('credit_installments')
  .select('installment_number, due_date, amount, credit_purchase_id')
  .eq('paid', false)
  .order('due_date', { ascending: true })
  .limit(10),

// Credit purchases (para descripción de las cuotas)
supabase.from('credit_purchases')
  .select('id, description, category, installments')
  .eq('user_id', userId),
```

---

### Paso 5 — Historial en API Route (`app/api/agent/route.ts`)

**5a.** Aceptar `conversationHistory` en el body del request.

**5b.** Actualizar `classifyWithNvidia` para incluir historial como contexto del sistema:

```ts
async function classifyWithNvidia(
  transcription: string,
  conversationHistory?: ConversationMessage[],
): Promise<{ action: AgentActionType; confidence: number }>
```

Si hay historial, agregarlo como mensaje `system` previo al prompt del clasificador.

**5c.** Actualizar `executeWithNvidia` para incluir historial:

```ts
async function executeWithNvidia(
  prompt: string,
  conversationHistory?: ConversationMessage[],
): Promise<string>
```

Historial como mensaje `system` con formato:
```
Historial de conversación:
Usuario: ...
Asistente: ...
```

**5d.** Agregar función `buildInsightPrompt` para generar mensajes inteligentes en confirmaciones:

```ts
function buildInsightPrompt(
  action: AgentActionType,
  payload: AgentPayload,
  financialContext: string
): string
```

Prompt corto que genera 1-2 oraciones: confirma la acción + insight basado en datos reales.

> **Ejemplo output:** "Gasto de $5.000 en Delivery detectado. Ya llevás $23.000 en Delivery este mes, 40% más que el mes pasado."

Se usa solo para `DB_ACTIONS` (`add_expense`, `add_income`, `create_savings_goal`, `credit_purchase`, `create_investment`). Envuelto en `try/catch` para no romper el flujo si falla.

---

### Paso 6 — Agent Service (`lib/agent/agent-service.ts`)

Actualizar ambas funciones para aceptar y forwardear historial:

```ts
export async function classifyIntent(
  transcription: string,
  conversationHistory?: ConversationMessage[],
): Promise<AgentClassifyResponse>

export async function executeStrategy(
  action: AgentActionType,
  transcription: string,
  conversationHistory?: ConversationMessage[],
): Promise<AgentExecuteResponse>
```

Agregar `conversationHistory` al body del `fetch`.

---

### Paso 7 — Context con historial (`contexts/agent-context.tsx`)

En `sendTranscription`, antes de llamar a `classify`/`execute`:

```ts
const recentHistory: ConversationMessage[] = messages
  .slice(-10)
  .map(m => ({ role: m.role, content: m.content }));
```

Pasar `recentHistory` a `classifyIntent(text, recentHistory)` y `executeStrategy(action, text, recentHistory)`.

> Límite de 10 mensajes para no explotar tokens.

---

## Orden de Implementación

1. `types/agent.ts` — base para todo
2. `lib/agent/classifier-prompt.ts` — standalone
3. `lib/agent/strategies/general-question.ts` — standalone
4. `app/api/agent/route.ts` — depende de 1, 2, 3
5. `lib/agent/agent-service.ts` — depende de 1
6. `contexts/agent-context.tsx` — depende de 5

---

## Verificación

1. **Build:** `npm run build` sin errores TypeScript
2. **Lint:** `npm run lint` sin warnings
3. **Test multi-turn:** "Tengo problemas financieros" → respuesta con datos reales y sugerencias → "Contame más de lo de crypto" → elabora con datos de mercado
4. **Test acción sugerida:** Agent sugiere meta de ahorro → "sí, creame una meta de ahorro para un auto de 5 millones" → clasifica como `create_savings_goal` → muestra modal confirmación
5. **Test insight en confirmación:** "Gasté 5000 en delivery" → mensaje incluye comparación con el mes ("ya llevás $X en Delivery este mes")
6. **Test datos enriquecidos:** Verificar que el contexto incluye mes anterior, cuotas pendientes y tendencia
7. **Test sin historial:** Primera interacción funciona igual que antes (historial vacío)