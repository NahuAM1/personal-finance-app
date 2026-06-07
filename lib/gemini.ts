import {
  ApiError,
  GoogleGenAI,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from "@google/genai";

const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([
  408, 429, 500, 502, 503, 504,
]);

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 4,
  baseDelayMs: 1000,
  maxDelayMs: 16000,
};

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (_client === null) {
    _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return _client;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeBackoff(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const exponential: number = baseDelayMs * 2 ** attempt;
  const jitter: number = Math.random() * baseDelayMs;
  return Math.min(exponential + jitter, maxDelayMs);
}

export async function generateContentWithRetry(
  params: GenerateContentParameters,
  options: RetryOptions = {},
): Promise<GenerateContentResponse> {
  const config: Required<RetryOptions> = { ...DEFAULT_OPTIONS, ...options };
  const client = getClient();

  for (let attempt = 0; ; attempt++) {
    try {
      return await client.models.generateContent(params);
    } catch (error) {
      if (!(error instanceof ApiError) || attempt >= config.maxRetries) {
        throw error;
      }

      const status: number = error.status;
      if (!RETRYABLE_STATUSES.has(status)) {
        throw error;
      }

      const delay: number = computeBackoff(
        attempt,
        config.baseDelayMs,
        config.maxDelayMs,
      );

      console.warn(
        `[gemini] Retryable error (status=${status}) on attempt ${
          attempt + 1
        }/${config.maxRetries + 1}. Retrying in ${Math.round(delay)}ms`,
      );

      await sleep(delay);
    }
  }
}
