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
  // Models tried in order when the primary one keeps failing with a
  // retryable error (e.g. 503 "model overloaded").
  fallbackModels?: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 4,
  baseDelayMs: 1000,
  maxDelayMs: 16000,
  fallbackModels: [],
};

function isRetryable(error: unknown): error is ApiError {
  return error instanceof ApiError && RETRYABLE_STATUSES.has(error.status);
}

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

async function generateWithBackoff(
  client: GoogleGenAI,
  params: GenerateContentParameters,
  config: Required<RetryOptions>,
): Promise<GenerateContentResponse> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.models.generateContent(params);
    } catch (error) {
      if (!isRetryable(error) || attempt >= config.maxRetries) {
        throw error;
      }

      const delay: number = computeBackoff(
        attempt,
        config.baseDelayMs,
        config.maxDelayMs,
      );

      console.warn(
        `[gemini] Retryable error (model=${params.model}, status=${error.status}) on attempt ${
          attempt + 1
        }/${config.maxRetries + 1}. Retrying in ${Math.round(delay)}ms`,
      );

      await sleep(delay);
    }
  }
}

export async function generateContentWithRetry(
  params: GenerateContentParameters,
  options: RetryOptions = {},
): Promise<GenerateContentResponse> {
  const config: Required<RetryOptions> = { ...DEFAULT_OPTIONS, ...options };
  const client = getClient();
  const models: string[] = [params.model, ...config.fallbackModels];

  for (let i = 0; ; i++) {
    try {
      return await generateWithBackoff(client, { ...params, model: models[i] }, config);
    } catch (error) {
      const next: string | undefined = models[i + 1];
      if (!isRetryable(error) || next === undefined) {
        throw error;
      }
      console.warn(
        `[gemini] Model ${models[i]} unavailable (status=${error.status}). Falling back to ${next}`,
      );
    }
  }
}
