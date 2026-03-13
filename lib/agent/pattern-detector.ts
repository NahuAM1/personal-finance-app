interface TransactionForPattern {
  type: string;
  amount: number;
  category: string;
  description: string;
  date: string;
}

export interface RecurringPattern {
  description: string;
  category: string;
  averageAmount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  occurrences: number;
}

function normalizeDescription(desc: string): string {
  return desc.toLowerCase().trim().replace(/\s+/g, ' ');
}

function detectFrequency(dates: Date[]): 'weekly' | 'biweekly' | 'monthly' | null {
  if (dates.length < 3) return null;

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const gaps: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const diffDays = Math.round((sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24));
    gaps.push(diffDays);
  }

  const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

  if (avgGap >= 5 && avgGap <= 10) return 'weekly';
  if (avgGap >= 11 && avgGap <= 18) return 'biweekly';
  if (avgGap >= 25 && avgGap <= 35) return 'monthly';

  return null;
}

export function detectRecurringPatterns(transactions: TransactionForPattern[]): RecurringPattern[] {
  // Group by normalized description
  const groups: Record<string, { amounts: number[]; dates: Date[]; category: string; originalDesc: string }> = {};

  for (const t of transactions) {
    const key = normalizeDescription(t.description);
    if (!key || key.length < 2) continue;

    if (!groups[key]) {
      groups[key] = { amounts: [], dates: [], category: t.category, originalDesc: t.description };
    }
    groups[key].amounts.push(t.amount);
    groups[key].dates.push(new Date(t.date));
  }

  const patterns: RecurringPattern[] = [];

  for (const [, group] of Object.entries(groups)) {
    if (group.amounts.length < 3) continue;

    const frequency = detectFrequency(group.dates);
    if (!frequency) continue;

    const averageAmount = Math.round(group.amounts.reduce((s, a) => s + a, 0) / group.amounts.length);

    patterns.push({
      description: group.originalDesc,
      category: group.category,
      averageAmount,
      frequency,
      occurrences: group.amounts.length,
    });
  }

  // Sort by occurrences descending
  return patterns.sort((a, b) => b.occurrences - a.occurrences).slice(0, 10);
}

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'semanal',
  biweekly: 'quincenal',
  monthly: 'mensual',
};

export function formatPatterns(patterns: RecurringPattern[]): string {
  if (patterns.length === 0) return '';

  let result = '=== PATRONES RECURRENTES DETECTADOS ===\n';
  for (const p of patterns) {
    result += `- ${p.description}: ~$${p.averageAmount.toLocaleString('es-AR')}/${FREQUENCY_LABELS[p.frequency]} (${p.frequency}, ${p.occurrences} ocurrencias)\n`;
  }
  return result + '\n';
}
