/**
 * Pre-computa fechas relativas para usar en prompts.
 * Extraído de los templates inline de data-query.ts para que sea reusable.
 */

export interface DateReferences {
  today: string;
  year: number;
  month: number;
  startOfMonth: string;
  prevMonthStart: string;
  prevMonthEnd: string;
  prevMonthName: string;
  currentQuarter: number;
  prevQuarterStart: string;
  prevQuarterEnd: string;
  oneWeekAgo: string;
  twoWeeksAgo: string;
  threeWeeksAgo: string;
  startOfYear: string;
  lastYearStart: string;
  lastYearEnd: string;
}

export function computeDateReferences(): DateReferences {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStr = String(month).padStart(2, '0');

  const startOfMonth = `${year}-${monthStr}-01`;

  // Previous month
  const prevMonthDate = new Date(year, month - 2, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonthStr = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
  const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
  const prevMonthStart = `${prevYear}-${prevMonthStr}-01`;
  const prevMonthEnd = `${prevYear}-${prevMonthStr}-${prevMonthLastDay}`;
  const prevMonthName = prevMonthDate.toLocaleString('es-AR', { month: 'long' });

  // Quarters
  const currentQuarter = Math.ceil(month / 3);
  const prevQuarterNum = currentQuarter === 1 ? 4 : currentQuarter - 1;
  const prevQuarterYear = currentQuarter === 1 ? year - 1 : year;
  const prevQuarterStartMonth = String((prevQuarterNum - 1) * 3 + 1).padStart(2, '0');
  const prevQuarterEndMonth = String(prevQuarterNum * 3).padStart(2, '0');
  const prevQuarterEndDay = new Date(prevQuarterYear, prevQuarterNum * 3, 0).getDate();
  const prevQuarterStart = `${prevQuarterYear}-${prevQuarterStartMonth}-01`;
  const prevQuarterEnd = `${prevQuarterYear}-${prevQuarterEndMonth}-${prevQuarterEndDay}`;

  // Relative weeks
  const oneWeekAgo = new Date(now); oneWeekAgo.setDate(now.getDate() - 7);
  const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(now.getDate() - 14);
  const threeWeeksAgo = new Date(now); threeWeeksAgo.setDate(now.getDate() - 21);

  // Year references
  const startOfYear = `${year}-01-01`;
  const lastYearStart = `${year - 1}-01-01`;
  const lastYearEnd = `${year - 1}-12-31`;

  return {
    today,
    year,
    month,
    startOfMonth,
    prevMonthStart,
    prevMonthEnd,
    prevMonthName,
    currentQuarter,
    prevQuarterStart,
    prevQuarterEnd,
    oneWeekAgo: oneWeekAgo.toISOString().split('T')[0],
    twoWeeksAgo: twoWeeksAgo.toISOString().split('T')[0],
    threeWeeksAgo: threeWeeksAgo.toISOString().split('T')[0],
    startOfYear,
    lastYearStart,
    lastYearEnd,
  };
}

/**
 * Genera el bloque de reemplazos de fechas para inyectar en el prompt de data-query.
 */
export function buildDatePromptSection(): string {
  const d = computeDateReferences();
  return [
    `Fecha actual: ${d.today}`,
    '',
    'REGLAS DE PARSEO DE FECHAS (usá estos valores pre-calculados):',
    `- "enero" / "en enero" → dateFrom: "${d.year}-01-01", dateTo: "${d.year}-01-31"`,
    `- "enero ${d.year - 1}" → dateFrom: "${d.year - 1}-01-01", dateTo: "${d.year - 1}-01-31"`,
    `- "este mes" → dateFrom: "${d.startOfMonth}", dateTo: "${d.today}"`,
    `- "mes pasado" / "${d.prevMonthName}" → dateFrom: "${d.prevMonthStart}", dateTo: "${d.prevMonthEnd}"`,
    `- "hace 1 semana" / "hace una semana" → dateFrom: "${d.oneWeekAgo}", dateTo: "${d.today}"`,
    `- "hace 2 semanas" → dateFrom: "${d.twoWeeksAgo}", dateTo: "${d.today}"`,
    `- "hace 3 semanas" → dateFrom: "${d.threeWeeksAgo}", dateTo: "${d.today}"`,
    `- "primer trimestre" / "Q1" → dateFrom: "${d.year}-01-01", dateTo: "${d.year}-03-31"`,
    `- "segundo trimestre" / "Q2" → dateFrom: "${d.year}-04-01", dateTo: "${d.year}-06-30"`,
    `- "tercer trimestre" / "Q3" → dateFrom: "${d.year}-07-01", dateTo: "${d.year}-09-30"`,
    `- "cuarto trimestre" / "Q4" → dateFrom: "${d.year}-10-01", dateTo: "${d.year}-12-31"`,
    `- "trimestre pasado" / "ultimo trimestre" → dateFrom: "${d.prevQuarterStart}", dateTo: "${d.prevQuarterEnd}"`,
    '- "este trimestre" → desde el inicio del trimestre actual hasta hoy',
    '- "la semana pasada" → lunes a domingo de la semana anterior',
    '- "hace 3 meses" → desde hace 3 meses hasta hoy',
    '- "ultimos 6 meses" → desde hace 6 meses hasta hoy',
    `- "el ano pasado" / "${d.year - 1}" → dateFrom: "${d.lastYearStart}", dateTo: "${d.lastYearEnd}"`,
    `- "este ano" → dateFrom: "${d.startOfYear}", dateTo: "${d.today}"`,
    '- "desde marzo hasta mayo" → dateFrom del inicio del primer mes, dateTo del fin del ultimo',
    '- "entre febrero y abril" → dateFrom del inicio del primer mes, dateTo del fin del ultimo',
    '- "compara enero con febrero" → dateFrom/dateTo para febrero, comparisonDateFrom/To para enero',
    `- "noviembre del ano pasado" → dateFrom: "${d.year - 1}-11-01", dateTo: "${d.year - 1}-11-30"`,
  ].join('\n');
}
