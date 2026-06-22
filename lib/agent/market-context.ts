/**
 * Builds market data context for the AI agent.
 * Obtiene cotizaciones de dólar, crypto, acciones, bonos, CEDEARs, letras
 * según las palabras clave en la transcripción del usuario.
 */

interface DollarApiEntry {
  nombre: string;
  compra: number;
  venta: number;
  casa: string;
}

interface CryptoApiResponse {
  displayName: string;
  marketData: {
    currentPrice: number;
    dailyChangePercent: number;
    dailyHigh: number;
    dailyLow: number;
  };
}

interface MarketListItem {
  symbol: string;
  price: number;
  change: number;
}

const MARKET_KEYWORDS = [
  'dolar', 'dólar', 'bitcoin', 'btc', 'crypto', 'cripto', 'ethereum',
  'accion', 'acciones', 'bono', 'bonos', 'inversion', 'inversión',
  'inversiones', 'invertir', 'cedear', 'plazo fijo', 'tasa', 'rendimiento',
  'lecap', 'letras', 'merval', 'me conviene', 'blue', 'mep', 'ccl',
];

export function transcriptionNeedsMarketData(transcription: string): boolean {
  const lower = transcription.toLowerCase();
  return MARKET_KEYWORDS.some(kw => lower.includes(kw));
}

export async function buildMarketContext(
  baseUrl: string,
  transcription: string,
  action?: string,
): Promise<string> {
  const lowerTranscription = transcription.toLowerCase();

  const marketFetches: Promise<string>[] = [];
  let hasAcciones = false;
  let hasBonos = false;

  // Always include dollar rates
  marketFetches.push(
    fetch(`${baseUrl}/api/market?type=dolar`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || !Array.isArray(data)) return '';
        const rates = data as DollarApiEntry[];
        return '<dollar_rates>\n' + rates.map(r =>
          `  ${r.nombre}: Compra $${r.compra} / Venta $${r.venta}`
        ).join('\n') + '\n</dollar_rates>';
      })
      .catch(() => ''),
  );

  if (lowerTranscription.includes('bitcoin') || lowerTranscription.includes('btc') ||
      lowerTranscription.includes('crypto') || lowerTranscription.includes('ethereum') ||
      lowerTranscription.includes('cripto')) {
    marketFetches.push(
      fetch(`${baseUrl}/api/market?type=crypto&instrumentId=100000`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) return '';
          const d = data as CryptoApiResponse;
          return `<crypto name="${d.displayName}" price="${d.marketData.currentPrice}" change="${d.marketData.dailyChangePercent.toFixed(2)}%" high="${d.marketData.dailyHigh}" low="${d.marketData.dailyLow}" />`;
        })
        .catch(() => ''),
    );
  }

  if (lowerTranscription.includes('accion') || lowerTranscription.includes('acciones') ||
      lowerTranscription.includes('bolsa') || lowerTranscription.includes('merval') ||
      lowerTranscription.includes('invertir') || lowerTranscription.includes('inversion') ||
      lowerTranscription.includes('inversiones') || lowerTranscription.includes('me conviene')) {
    hasAcciones = true;
    marketFetches.push(
      fetch(`${baseUrl}/api/market?type=acciones`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data || !Array.isArray(data)) return '';
          const top5 = data.slice(0, 5) as MarketListItem[];
          return '<stocks>\n' + top5.map((s: MarketListItem) =>
            `  ${s.symbol}: $${s.price} (${s.change > 0 ? '+' : ''}${s.change}%)`
          ).join('\n') + '\n</stocks>';
        })
        .catch(() => ''),
    );
  }

  if (lowerTranscription.includes('bono') || lowerTranscription.includes('bonos') ||
      lowerTranscription.includes('invertir') || lowerTranscription.includes('inversion') ||
      lowerTranscription.includes('inversiones') || lowerTranscription.includes('me conviene')) {
    hasBonos = true;
    marketFetches.push(
      fetch(`${baseUrl}/api/market?type=bonos`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data || !Array.isArray(data)) return '';
          const top5 = data.slice(0, 5) as MarketListItem[];
          return '<bonds>\n' + top5.map((b: MarketListItem) =>
            `  ${b.symbol}: $${b.price} (${b.change > 0 ? '+' : ''}${b.change}%)`
          ).join('\n') + '\n</bonds>';
        })
        .catch(() => ''),
    );
  }

  if (lowerTranscription.includes('cedear')) {
    marketFetches.push(
      fetch(`${baseUrl}/api/market?type=cedears`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data || !Array.isArray(data)) return '';
          const top5 = data.slice(0, 5) as MarketListItem[];
          return '<cedears>\n' + top5.map((c: MarketListItem) =>
            `  ${c.symbol}: $${c.price} (${c.change > 0 ? '+' : ''}${c.change}%)`
          ).join('\n') + '\n</cedears>';
        })
        .catch(() => ''),
    );
  }

  if (lowerTranscription.includes('plazo fijo') || lowerTranscription.includes('tasa') ||
      lowerTranscription.includes('rendimiento') || lowerTranscription.includes('letras') ||
      lowerTranscription.includes('lecap')) {
    marketFetches.push(
      fetch(`${baseUrl}/api/market?type=letras`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data || !Array.isArray(data)) return '';
          const top5 = data.slice(0, 5) as MarketListItem[];
          return '<treasury>\n' + top5.map((l: MarketListItem) =>
            `  ${l.symbol}: $${l.price} (${l.change > 0 ? '+' : ''}${l.change}%)`
          ).join('\n') + '\n</treasury>';
        })
        .catch(() => ''),
    );
  }

  // For general_question, always include diversified market data
  if (action === 'general_question') {
    if (!hasAcciones) {
      marketFetches.push(
        fetch(`${baseUrl}/api/market?type=acciones`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (!data || !Array.isArray(data)) return '';
            const top5 = data.slice(0, 5) as MarketListItem[];
            return '<stocks>\n' + top5.map((s: MarketListItem) =>
              `  ${s.symbol}: $${s.price} (${s.change > 0 ? '+' : ''}${s.change}%)`
            ).join('\n') + '\n</stocks>';
          })
          .catch(() => ''),
      );
    }
    if (!hasBonos) {
      marketFetches.push(
        fetch(`${baseUrl}/api/market?type=bonos`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (!data || !Array.isArray(data)) return '';
            const top5 = data.slice(0, 5) as MarketListItem[];
            return '<bonds>\n' + top5.map((b: MarketListItem) =>
              `  ${b.symbol}: $${b.price} (${b.change > 0 ? '+' : ''}${b.change}%)`
            ).join('\n') + '\n</bonds>';
          })
          .catch(() => ''),
      );
    }
  }

  const results = await Promise.all(marketFetches);
  return results.filter(Boolean).join('\n\n');
}
