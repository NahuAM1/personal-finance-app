import type { AgentStrategy, DollarRatePayload, DollarRateEntry } from '@/types/agent';

export const dollarRateStrategy: AgentStrategy = {
  // This strategy doesn't use AI - it fetches from the market API directly
  buildPrompt(_transcription: string): string {
    return '';
  },

  parseResponse(raw: string): DollarRatePayload {
    const rates: DollarRateEntry[] = JSON.parse(raw);
    return {
      action: 'dollar_rate',
      rates,
    };
  },
};
