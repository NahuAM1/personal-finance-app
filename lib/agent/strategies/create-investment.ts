import type { AgentStrategy, CreateInvestmentPayload } from '@/types/agent';
import type { Investment } from '@/types/database';

const INVESTMENT_TYPES: Investment['investment_type'][] = [
  'plazo_fijo', 'fci', 'bonos', 'acciones', 'crypto',
  'letras', 'cedears', 'cauciones', 'fondos_comunes_inversion', 'compra_divisas',
];

export const createInvestmentStrategy: AgentStrategy = {
  buildPrompt(transcription: string): string {
    return `Sos un asistente financiero argentino. Extraé los datos de una inversión de la transcripción de voz.

Tipos de inversión válidos: ${INVESTMENT_TYPES.map(t => `"${t}"`).join(', ')}

Mapeo de términos comunes:
- "plazo fijo" -> "plazo_fijo"
- "FCI" o "fondo común" -> "fci" o "fondos_comunes_inversion"
- "bonos" -> "bonos"
- "acciones" -> "acciones"
- "crypto" o "bitcoin" o "ethereum" -> "crypto"
- "letras" o "LECAPs" -> "letras"
- "CEDEARs" -> "cedears"
- "cauciones" -> "cauciones"
- "dólares" o "divisas" o "compra de dólares" -> "compra_divisas"

Reglas:
- "investmentType" debe ser EXACTAMENTE uno de los tipos válidos listados
- "amount" debe ser un número positivo (monto de la inversión en pesos)
- "description" debe ser breve y descriptiva
- "startDate" debe ser la fecha en formato YYYY-MM-DD. Si no se menciona, usá hoy: ${new Date().toISOString().split('T')[0]}

Transcripción: "${transcription}"

Respondé ÚNICAMENTE con un JSON válido (sin markdown, sin texto extra):
{"investmentType": "", "amount": 0, "description": "", "startDate": "YYYY-MM-DD"}`;
  },

  parseResponse(raw: string): CreateInvestmentPayload {
    const jsonMatch =
      raw.match(/```json([\s\S]*?)```/) ||
      raw.match(/```([\s\S]*?)```/) ||
      raw.match(/\{[\s\S]*\}/);

    const cleanJson = jsonMatch
      ? jsonMatch[1]?.trim() || jsonMatch[0].trim()
      : raw;

    const parsed: { investmentType: Investment['investment_type']; amount: number; description: string; startDate: string } = JSON.parse(cleanJson);

    return {
      action: 'create_investment',
      investmentType: parsed.investmentType,
      amount: parsed.amount,
      description: parsed.description,
      startDate: parsed.startDate,
    };
  },
};
