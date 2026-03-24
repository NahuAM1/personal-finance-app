import { AgentAction } from '@/types/agent';
import type { AgentStrategy, SavingsDepositPayload, AgentPayload, AgentClarificationPayload } from '@/types/agent';

export const savingsDepositStrategy: AgentStrategy = {
  needsUserData: true,

  buildPrompt(transcription: string, context?: string): string {
    return `Sos un asistente financiero argentino. El usuario quiere depositar dinero en una de sus metas de ahorro existentes.

Metas de ahorro del usuario:
${context ?? 'No hay metas de ahorro disponibles.'}

Transcripción: "${transcription}"

Instrucciones:
- Identificá la meta de ahorro mencionada por nombre o contexto
- Extraé el monto a depositar
- Calculá el nuevo total (current_amount + depositAmount) y el progreso porcentual (newTotal / target_amount * 100)
- Si no se menciona monto → {"needsClarification": true, "question": "¿Cuánto querés depositar?"}
- Si la meta no está clara → {"needsClarification": true, "question": "¿En cuál de tus metas querés depositar?"}
- Si hay solo una meta, usala por defecto
- Usá el ID exacto de la meta del contexto

Respondé ÚNICAMENTE con un JSON válido (sin markdown, sin texto extra):
{"goalId": "uuid", "goalName": "nombre", "depositAmount": 0, "newTotal": 0, "progressPercent": 0}`;
  },

  parseResponse(raw: string): AgentPayload {
    const jsonMatch =
      raw.match(/```json([\s\S]*?)```/) ||
      raw.match(/```([\s\S]*?)```/) ||
      raw.match(/\{[\s\S]*\}/);

    const cleanJson = jsonMatch
      ? jsonMatch[1]?.trim() || jsonMatch[0].trim()
      : raw;

    const parsed: {
      needsClarification?: boolean;
      question?: string;
      goalId?: string;
      goalName?: string;
      depositAmount?: number;
      newTotal?: number;
      progressPercent?: number;
    } = JSON.parse(cleanJson);

    if (parsed.needsClarification && parsed.question) {
      const clarification: AgentClarificationPayload = {
        action: AgentAction.CLARIFICATION,
        question: parsed.question,
        originalAction: 'savings_deposit',
      };
      return clarification;
    }

    const result: SavingsDepositPayload = {
      action: AgentAction.SAVINGS_DEPOSIT,
      goalId: parsed.goalId ?? '',
      goalName: parsed.goalName ?? '',
      depositAmount: parsed.depositAmount ?? 0,
      newTotal: parsed.newTotal ?? 0,
      progressPercent: Math.min(100, parsed.progressPercent ?? 0),
    };
    return result;
  },
};
