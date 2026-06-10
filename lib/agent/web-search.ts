// --- Web search utility for the SmartPocket agent ---
// Uses Tavily API (https://tavily.com) — purpose-built for AI agents.
// Falls back to Wikipedia API (free, no key needed) for definitions/concepts.
// Returns empty array if all sources fail — agent continues without web context.

export interface SearchResult {
  title: string;
  content: string;
  url: string;
}

/**
 * Search the web for a query and return structured results.
 * Falls back through: Tavily → Wikipedia → empty.
 */
export async function searchWeb(query: string): Promise<SearchResult[]> {
  // 1. Try Tavily (needs TAVILY_API_KEY)
  if (process.env.TAVILY_API_KEY) {
    try {
      const results = await searchTavily(query);
      if (results.length > 0) return results;
    } catch {
      // fall through to Wikipedia
    }
  }

  // 2. Try Wikipedia (free, no key needed) for definitions, concepts, explainers
  try {
    const results = await searchWikipedia(query);
    if (results.length > 0) return results;
  } catch {
    // fall through to empty
  }

  return [];
}

// --- Tavily API ---

async function searchTavily(query: string): Promise<SearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      max_results: 5,
      include_answer: false,
    }),
  });

  if (!response.ok) return [];

  const data = await response.json() as { results?: Array<Record<string, unknown>> };
  return (data.results ?? []).map((r: Record<string, unknown>) => ({
    title: typeof r.title === 'string' ? r.title : '',
    content: typeof r.content === 'string' ? r.content : '',
    url: typeof r.url === 'string' ? r.url : '',
  }));
}

// --- Wikipedia API (free fallback) ---

async function searchWikipedia(query: string): Promise<SearchResult[]> {
  // Wikipedia's opensearch API returns [query, [titles], [descriptions], [urls]]
  const response = await fetch(
    `https://es.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&namespace=0&format=json`,
    { headers: { 'User-Agent': 'PersonalWallet/1.0' } },
  );

  if (!response.ok) return [];

  const data = await response.json() as [string, string[], string[], string[]];
  const [, titles, descriptions, urls] = data;

  if (!titles || titles.length === 0) return [];

  return titles.map((title, i) => ({
    title,
    content: descriptions?.[i] ?? '',
    url: urls?.[i] ?? '',
  }));
}

// --- Formatter ---

/**
 * Format search results as an XML section for LLM prompt injection.
 */
export function buildSearchContext(results: SearchResult[]): string {
  if (results.length === 0) return '';

  let xml = '<web_search_results>\n';
  for (const r of results) {
    xml += '  <result>\n';
    xml += `    <title>${escapeXml(r.title)}</title>\n`;
    xml += `    <content>${escapeXml(r.content)}</content>\n`;
    xml += `    <url>${escapeXml(r.url)}</url>\n`;
    xml += '  </result>\n';
  }
  xml += '</web_search_results>';
  return xml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
