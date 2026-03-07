# Plan: AI Agent - SmartPocket Assistant

## Context

La app actualmente tiene un flujo de voz limitado: graba audio → transcribe → clasifica como gasto/ingreso → rellena formulario. El usuario quiere un **Agente AI completo** accesible desde un boton flotante (bottom-right) que maneje multiples acciones financieras mediante voz, con confirmacion visual antes de ejecutar. Feature premium.

## Decisiones de Diseno

- **Avatar**: CSS animations (keyframes pulse/scale) - sin Remotion
- **UI**: Bottom Sheet (panel que sube desde abajo)
- **Logo**: `assets/images/smartPocketLogo.svg` (160KB) para el boton. Eliminar `public/images/smartPocketLogo.svg` (618KB)
- **Strategy Pattern**: Enum → classifier prompt → strategy-specific prompt → confirmation modal → execute
- **TTS (Text-to-Speech)**: La IA puede responder por voz. Dos engines:
  - **Google GenAI** (default) - Voz natural via Gemini API (`@google/genai` ya instalado, `GEMINI_API_KEY` configurada)
  - **Web Speech API** (SpeechSynthesis) - Voz nativa del browser, gratis, sin consumo de tokens
  - Toggle solo visible para **admins** para switchear el engine (por si el consumo de tokens se dispara)
  - Todos los usuarios premium usan el engine configurado por el admin
  - El usuario puede activar/desactivar la respuesta por voz con un boton en el drawer
- **Sin dependencias nuevas**: Todo con CSS, Radix Dialog, Web Speech API, @google/genai existente

## Estructura de Archivos Nuevos

```
types/agent.ts                              # Tipos, enums, discriminated unions
lib/agent/
  classifier-prompt.ts                      # Prompt clasificador de intenciones
  strategies/
    index.ts                                # Registry: AgentAction → Strategy
    add-transaction.ts                      # Gasto/Ingreso
    create-savings-goal.ts                  # Meta de ahorro
    credit-purchase.ts                      # Compra con tarjeta
    create-investment.ts                    # Inversion
    dollar-rate.ts                          # Cotizacion dolar (sin AI, usa /api/market)
    general-question.ts                     # Pregunta libre
  agent-service.ts                          # Orquestador: classify → execute
  tts/
    tts-service.ts                          # Interfaz TTS + factory para elegir engine
    genai-tts.ts                            # Implementacion Google GenAI TTS
    browser-tts.ts                          # Implementacion Web Speech API SpeechSynthesis
app/api/agent/route.ts                      # API route server-side (auth + 2 prompts)
app/api/agent/tts/route.ts                  # API route para GenAI TTS (genera audio)
app/api/agent/settings/route.ts             # GET/PUT settings del agente (tts_engine)
contexts/agent-context.tsx                  # Estado: messages, status, payload pendiente
components/agent/
  agent-floating-button.tsx                 # Boton circular flotante con logo
  agent-drawer.tsx                          # Bottom sheet principal
  agent-avatar.tsx                          # Esfera animada CSS
  agent-microphone.tsx                      # Grabacion de voz (Web Speech API)
  agent-message-list.tsx                    # Lista de mensajes conversacion
  agent-tts-toggle.tsx                      # Toggle voz on/off + admin engine selector
  confirmation-modals/
    confirm-transaction.tsx                 # Modal gasto/ingreso
    confirm-savings-goal.tsx                # Modal meta de ahorro
    confirm-credit-purchase.tsx             # Modal compra tarjeta
    confirm-investment.tsx                  # Modal inversion
    dollar-rate-display.tsx                 # Card inline cotizaciones
    general-answer-display.tsx              # Respuesta texto formateada
```

## Archivos a Modificar

- `app/layout.tsx` → Agregar `<AgentProvider>`
- `app/page.tsx` → Agregar `<AgentFloatingButton />` + pasar callback de refresh
- `tailwind.config.ts` → Agregar keyframes `levitate` y `agent-pulse`
- `public/images/smartPocketLogo.svg` → **Eliminar** (618KB duplicado)
- `types/database.ts` → Agregar tabla `agent_settings` (opcional, o usar app_metadata del user)

### Nota sobre persistencia del TTS engine setting
El admin toggle para el engine TTS se guarda en `app_metadata` del admin user via Supabase Auth (campo `tts_engine: 'genai' | 'browser'`). Esto evita crear una tabla nueva. Se lee desde el contexto del agente al inicializar.

## Implementacion Paso a Paso

### Fase 1: Tipos y Core Logic

**1. `types/agent.ts`** - Definiciones de tipos

```typescript
export enum AgentAction {
  ADD_EXPENSE = 'add_expense',
  ADD_INCOME = 'add_income',
  CREATE_SAVINGS_GOAL = 'create_savings_goal',
  CREDIT_PURCHASE = 'credit_purchase',
  CREATE_INVESTMENT = 'create_investment',
  DOLLAR_RATE = 'dollar_rate',
  GENERAL_QUESTION = 'general_question',
}

export type AgentStatus = 'idle' | 'listening' | 'classifying' | 'executing' | 'confirming' | 'done' | 'error';

// Discriminated union para payloads de cada estrategia
// AddTransactionPayload, CreateSavingsGoalPayload, CreditPurchasePayload,
// CreateInvestmentPayload, DollarRatePayload, GeneralQuestionPayload
// Union: AgentPayload

// AgentMessage { id, role, content, payload, timestamp }
// AgentClassification { action, confidence }
// AgentStrategy interface { buildPrompt, parseResponse }
```

**2. `lib/agent/classifier-prompt.ts`** - Prompt clasificador

Prompt corto que recibe la transcripcion y devuelve `{ "action": "<AgentAction>", "confidence": number }`. Debe reconocer:
- Palabras clave de gasto/ingreso → `add_expense`/`add_income`
- "meta de ahorro", "ahorrar para" → `create_savings_goal`
- "tarjeta", "cuotas", "credito" → `credit_purchase`
- "inversion", "comprar dolares", "plazo fijo" → `create_investment`
- "dolar", "cotizacion", "a cuanto esta" → `dollar_rate`
- Todo lo demas → `general_question`

**3. `lib/agent/strategies/`** - Una estrategia por accion

Cada archivo exporta un objeto `AgentStrategy`:
- `buildPrompt(transcription)`: retorna el prompt especifico
- `parseResponse(raw)`: parsea JSON con type guards, retorna el payload tipado

Estrategias:
- **add-transaction.ts**: Reusar categorias de `public/constants.ts` (expenseCategories, incomeCategories). Extraer type, amount, category, description.
- **create-savings-goal.ts**: Extraer name, targetAmount, deadline (fecha), category.
- **credit-purchase.ts**: Extraer description, category, totalAmount, installments (cuotas).
- **create-investment.ts**: Extraer investmentType (del enum en database.ts), amount, description, startDate.
- **dollar-rate.ts**: NO usa AI. Hace fetch a `/api/market?type=dolar` directamente. Retorna array de cotizaciones.
- **general-question.ts**: Prompt de asesor financiero, retorna respuesta de texto.

**4. `lib/agent/strategies/index.ts`** - Registry

```typescript
const strategyRegistry: Record<AgentAction, AgentStrategy> = { ... }
```

**5. `lib/agent/agent-service.ts`** - Orquestador

Funciones:
- `classifyIntent(transcription)`: Llama al classifier prompt via fetch a `/api/agent`
- `executeStrategy(action, transcription)`: Obtiene estrategia del registry, ejecuta

### Fase 2: API Route

**6. `app/api/agent/route.ts`**

Seguir patron de `app/api/openAI/route.ts`:
- Auth check con `createSupabaseServerClient()`
- Verificar rol premium/admin
- Aceptar `{ transcription, step: 'classify' | 'execute', action?: AgentAction }`
- Step 'classify': usar classifier prompt, retornar `{ action, confidence }`
- Step 'execute': usar strategy prompt segun action, retornar `{ payload }`
- Para `dollar_rate`: fetch directo a `/api/market?type=dolar` sin AI

### Fase 3: Estado (Context)

**7. `contexts/agent-context.tsx`**

Estado:
- `isOpen: boolean` - drawer visible
- `status: AgentStatus` - maquina de estados
- `messages: AgentMessage[]` - historial conversacion
- `pendingPayload: AgentPayload | null` - esperando confirmacion
- `voiceEnabled: boolean` - respuesta por voz activada
- `ttsEngine: 'genai' | 'browser'` - engine actual (leido de settings al init)
- `isSpeaking: boolean` - IA esta hablando (controla animacion avatar)

Metodos:
- `toggleDrawer()` - abrir/cerrar
- `sendTranscription(text)` - flujo completo: classify → execute → hablar respuesta → mostrar modal
- `confirmAction(userId)` - confirmar: ejecuta la operacion en DB via database-api.ts
- `cancelAction()` - cancelar: limpia pendingPayload
- `resetConversation()` - limpiar todo
- `toggleVoice()` - activar/desactivar respuesta por voz
- `setTTSEngine(engine)` - solo admins, cambia engine y persiste via /api/agent/settings

`confirmAction` usa switch sobre `pendingPayload.action`:
- `ADD_EXPENSE/ADD_INCOME` → `addTransaction()` de `lib/database-api.ts`
- `CREATE_SAVINGS_GOAL` → `addExpensePlan()` de `lib/database-api.ts`
- `CREDIT_PURCHASE` → `createCreditPurchase()` de `lib/database-api.ts`
- `CREATE_INVESTMENT` → `createInvestment()` de `lib/database-api.ts`

**8. Wiring en `app/layout.tsx`**

Agregar `<AgentProvider>` dentro de `<AuthProvider>` y `<FormProvider>`.

### Fase 3.5: Text-to-Speech (Respuesta por voz)

**8b. `lib/agent/tts/tts-service.ts`** - Interfaz y factory

```typescript
type TTSEngine = 'genai' | 'browser';

interface TTSService {
  speak(text: string): Promise<void>;
  stop(): void;
  isSpeaking(): boolean;
}

function createTTSService(engine: TTSEngine): TTSService
```

**8c. `lib/agent/tts/genai-tts.ts`** - Google GenAI TTS

- Hace POST a `/api/agent/tts` con el texto a sintetizar
- El API route usa `@google/genai` (ya instalado) con `GEMINI_API_KEY` (ya configurada)
- Usa el modelo Gemini con generateContent y responseModality "AUDIO"
- Recibe audio en base64, lo decodifica y reproduce con `AudioContext`/`HTMLAudioElement`
- El avatar pasa a `isSpeaking=true` mientras reproduce

**8d. `lib/agent/tts/browser-tts.ts`** - Web Speech API fallback

- Usa `window.speechSynthesis` nativo del browser
- Selecciona voz en espanol si esta disponible
- Gratis, sin API calls, sin consumo de tokens
- Eventos `onstart`/`onend` para controlar `isSpeaking` del avatar

**8e. `app/api/agent/tts/route.ts`** - API route para GenAI TTS

- Auth check + premium role
- Recibe `{ text: string }`
- Usa `GoogleGenAI` igual que `app/api/smartpocket/scan-receipt/route.ts`
- Genera audio con Gemini y retorna audio en base64 o stream
- Config: modelo con capacidad de audio output

**8f. `app/api/agent/settings/route.ts`** - Settings del agente

- GET: Lee `tts_engine` de `app_metadata` del user (default: 'genai')
- PUT: Solo admins pueden cambiar. Actualiza `app_metadata.tts_engine` via Supabase admin client

**8g. `components/agent/agent-tts-toggle.tsx`**

- Boton speaker icon (on/off) para que el usuario active/desactive respuesta por voz
- Si el usuario es admin: muestra tambien un selector GenAI / Browser para cambiar el engine
- Usa `AccessControl` para mostrar el selector de engine solo a admins

### Fase 4: Componentes UI

**9. `components/agent/agent-avatar.tsx`**

Esfera circular con gradiente emerald/teal. CSS keyframes:
- `agent-pulse`: scale 1→1.15→1, box-shadow glow
- Prop `isSpeaking: boolean` activa/desactiva animacion
- Logo SmartPocket centrado dentro de la esfera

**10. `components/agent/agent-microphone.tsx`**

Adaptar logica de `components/microphone-component.tsx`:
- Mismo Web Speech API (`es-AR`)
- Interfaz simplificada: solo boton mic + transcripcion en vivo
- Callback `onTranscription(text)` cuando termina

**11. `components/agent/agent-message-list.tsx`**

Lista scrollable de mensajes:
- User: burbuja derecha, fondo emerald claro
- Assistant: burbuja izquierda, fondo blanco/gris
- Auto-scroll al ultimo mensaje

**12. `components/agent/agent-drawer.tsx`**

Bottom sheet usando Radix Dialog con animacion slide-from-bottom:
- Header: avatar animado + boton cerrar
- Body: message list (scrollable)
- Footer: microphone button
- Cuando `status === 'confirming'`: renderiza el modal de confirmacion segun `pendingPayload.action`

**13. Confirmation Modals** (`components/agent/confirmation-modals/`)

Cada uno usa `<Dialog>` de `components/ui/dialog.tsx`:
- **confirm-transaction.tsx**: Tipo (gasto/ingreso), monto, categoria, descripcion. Botones Cancelar/Confirmar.
- **confirm-savings-goal.tsx**: Nombre, monto objetivo, fecha limite, categoria.
- **confirm-credit-purchase.tsx**: Descripcion, monto total, cuotas, monto por cuota, categoria.
- **confirm-investment.tsx**: Tipo inversion, monto, descripcion, fecha inicio.
- **dollar-rate-display.tsx**: Card con cotizaciones (oficial, blue, MEP, CCL). No es modal, es inline.
- **general-answer-display.tsx**: Texto formateado inline.

**14. `components/agent/agent-floating-button.tsx`**

```
position: fixed; bottom: 24px; right: 24px; z-index: 50;
```
- Circular, ~56px, con logo SmartPocket centrado
- Animacion `levitate` (sube y baja suavemente)
- Sombra con glow sutil emerald
- Envuelto en `<AccessControl allowedRoles={[USER_ROLES.PREMIUM, USER_ROLES.ADMIN]}>`
- onClick → `toggleDrawer()` del AgentContext

### Fase 5: Integracion

**15. `app/page.tsx`**

- Importar y renderizar `<AgentFloatingButton />` al final de `FinanceAppContent`
- Pasar callback `onActionCompleted` que llame a `loadData()` para refrescar datos

**16. `tailwind.config.ts`**

Agregar en `extend.keyframes`:
- `levitate`: translateY(0) → translateY(-6px) → translateY(0)
- `agent-pulse`: scale(1) + shadow → scale(1.15) + glow → scale(1) + shadow

Agregar en `extend.animation`:
- `levitate`: `levitate 3s ease-in-out infinite`
- `agent-pulse`: `agent-pulse 1.5s ease-in-out infinite`

**17. Eliminar `public/images/smartPocketLogo.svg`** (618KB)

Actualizar cualquier referencia a usar `assets/images/smartPocketLogo.svg` en su lugar.

## Funciones Existentes a Reutilizar

- `lib/database-api.ts`: `addTransaction()`, `addExpensePlan()`, `createCreditPurchase()`, `createInvestment()`
- `components/access-control.tsx`: `AccessControl` para premium gate y admin-only toggle
- `components/ui/dialog.tsx`: Dialog/DialogContent para modals de confirmacion
- `public/constants.ts`: `expenseCategories`, `incomeCategories`, `formatCategories()`
- `public/enums.ts`: `OpenAIModels`, `TransactionsTypes`
- `hooks/use-toast.ts`: Para notificaciones de exito/error
- `app/api/market/route.ts`: Para cotizacion de dolar (ya existe)
- Patron de Web Speech API de `components/microphone-component.tsx`
- `@google/genai` + `GEMINI_API_KEY`: Ya instalado y configurado (usado en scan-receipt)
- `lib/supabase-admin.ts`: Para actualizar `app_metadata` (TTS engine setting)

## Verificacion

1. **Build**: `npm run build` sin errores de TypeScript
2. **Lint**: `npm run lint` sin warnings
3. **Test manual - Gasto**: Activar mic → "Quiero cargar un gasto de 2000 pesos en la panaderia" → Verificar modal con monto, categoria, descripcion → Confirmar → Verificar en historial
4. **Test manual - Meta de ahorro**: "Quiero crear una meta de ahorro para un auto en diciembre" → Modal con nombre, monto, fecha → Confirmar
5. **Test manual - Tarjeta**: "Compre un celular de 500 mil en 12 cuotas" → Modal con cuotas y montos → Confirmar
6. **Test manual - Dolar**: "A cuanto esta el dolar?" → Card inline con cotizaciones
7. **Test manual - Inversion**: "Quiero cargar una inversion de compra de 500 dolares" → Modal con tipo, monto, fecha → Confirmar
8. **Premium gate**: Verificar que usuarios no-premium no ven el boton flotante
9. **Responsive**: Verificar bottom sheet en mobile y desktop
10. **TTS GenAI**: Activar voz → hacer pregunta → verificar que la IA responde con audio y el avatar pulsa
11. **TTS Browser**: Como admin, switchear a "browser" → verificar que usa SpeechSynthesis nativa
12. **TTS Toggle**: Desactivar voz → verificar que solo responde con texto
13. **Admin toggle**: Verificar que solo admins ven el selector de engine TTS
