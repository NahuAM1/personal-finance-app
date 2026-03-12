import type { AgentStrategy, ScanReceiptPayload } from '@/types/agent';

export const scanReceiptStrategy: AgentStrategy = {
  needsUserData: false,
  needsMarketData: false,

  buildPrompt(): string {
    // Not used - scan_receipt has a fast-path in route.ts
    return '';
  },

  parseResponse(): ScanReceiptPayload {
    return {
      action: 'scan_receipt',
      triggerScanner: true,
    };
  },
};
