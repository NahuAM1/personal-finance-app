import {
  ApiError,
  GoogleGenAI,
  type ContentListUnion,
  type GenerateContentConfig,
  type GenerateContentParameters,
} from "@google/genai";
import { GeminiModels } from "@/public/enums";

export enum AiTask {
  SCAN_RECEIPT = "scan_receipt",
  SHOPPING_RECOMMENDATIONS = "shopping_recommendations",
  TRANSCRIBE_TRANSACTION = "transcribe_transaction",
  AGENT_CLASSIFY = "agent_classify",
  AGENT_REPLY = "agent_reply",
}

export interface AiTaskProfile {
  models: readonly GeminiModels[];
  attemptsPerModel: number;
  attemptTimeoutMs: number;
  budgetMs: number;
  config: GenerateContentConfig;
}

export interface AiRequest {
  contents: ContentListUnion;
  systemInstruction?: string;
}

export interface AiRuntime {
  transport: (params: GenerateContentParameters) => Promise<string>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  random: () => number;
  timeoutSignal: (ms: number) => AbortSignal;
}

export class AiUnavailableError extends Error {
  public readonly task: AiTask;
  public readonly rateLimited: boolean;

  constructor(task: AiTask, rateLimited: boolean) {
    super(`AI task ${task} is unavailable: every model failed or the time budget ran out`);
    this.name = "AiUnavailableError";
    this.task = task;
    this.rateLimited = rateLimited;
  }
}

const MODEL_CHAIN: readonly GeminiModels[] = [
  GeminiModels.GEMINI_3_5_FLASH,
  GeminiModels.GEMINI_2_5_FLASH,
];

const TRANSIENT_STATUSES: ReadonlySet<number> = new Set([408, 429, 500, 502, 503, 504]);
const RATE_LIMITED_STATUS: number = 429;
const TIMEOUT_STATUS: number = 504;
const ABORT_ERROR_NAMES: ReadonlySet<string> = new Set(["AbortError", "TimeoutError"]);
const BASE_DELAY_MS: number = 1000;
const MIN_ATTEMPT_MS: number = 2000;

export const AI_TASK_PROFILES: Readonly<Record<AiTask, AiTaskProfile>> = {
  [AiTask.SCAN_RECEIPT]: {
    models: MODEL_CHAIN,
    attemptsPerModel: 2,
    attemptTimeoutMs: 25_000,
    budgetMs: 50_000,
    config: { temperature: 0.1 },
  },
  [AiTask.SHOPPING_RECOMMENDATIONS]: {
    models: MODEL_CHAIN,
    attemptsPerModel: 2,
    attemptTimeoutMs: 20_000,
    budgetMs: 40_000,
    config: { temperature: 0.1 },
  },
  [AiTask.TRANSCRIBE_TRANSACTION]: {
    models: MODEL_CHAIN,
    attemptsPerModel: 2,
    attemptTimeoutMs: 15_000,
    budgetMs: 25_000,
    config: { temperature: 0.1, responseMimeType: "application/json" },
  },
  [AiTask.AGENT_CLASSIFY]: {
    models: MODEL_CHAIN,
    attemptsPerModel: 2,
    attemptTimeoutMs: 10_000,
    budgetMs: 15_000,
    config: { temperature: 0.1, responseMimeType: "application/json" },
  },
  [AiTask.AGENT_REPLY]: {
    models: MODEL_CHAIN,
    attemptsPerModel: 2,
    attemptTimeoutMs: 15_000,
    budgetMs: 20_000,
    config: { temperature: 0.2 },
  },
};

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (client === null) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

const geminiRuntime: AiRuntime = {
  transport: async (params: GenerateContentParameters): Promise<string> => {
    const response = await getClient().models.generateContent(params);
    return response.text ?? "";
  },
  sleep: (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms)),
  now: (): number => Date.now(),
  random: (): number => Math.random(),
  timeoutSignal: (ms: number): AbortSignal => AbortSignal.timeout(ms),
};

function transientStatus(error: Error): number | null {
  if (error instanceof ApiError) {
    return TRANSIENT_STATUSES.has(error.status) ? error.status : null;
  }
  return ABORT_ERROR_NAMES.has(error.name) ? TIMEOUT_STATUS : null;
}

function buildConfig(
  profile: AiTaskProfile,
  request: AiRequest,
  abortSignal: AbortSignal,
): GenerateContentConfig {
  const config: GenerateContentConfig = { ...profile.config, abortSignal };
  if (request.systemInstruction) {
    config.systemInstruction = request.systemInstruction;
  }
  return config;
}

export async function runAiTask(
  task: AiTask,
  request: AiRequest,
  runtime: AiRuntime = geminiRuntime,
): Promise<string> {
  const profile: AiTaskProfile = AI_TASK_PROFILES[task];
  const deadline: number = runtime.now() + profile.budgetMs;
  let rateLimited: boolean = false;

  for (const model of profile.models) {
    for (let attempt: number = 0; attempt < profile.attemptsPerModel; attempt++) {
      const remainingMs: number = deadline - runtime.now();
      if (remainingMs < MIN_ATTEMPT_MS) {
        throw new AiUnavailableError(task, rateLimited);
      }

      try {
        return await runtime.transport({
          model,
          contents: request.contents,
          config: buildConfig(
            profile,
            request,
            runtime.timeoutSignal(Math.min(profile.attemptTimeoutMs, remainingMs)),
          ),
        });
      } catch (error) {
        if (!(error instanceof Error)) {
          throw error;
        }
        const status: number | null = transientStatus(error);
        if (status === null) {
          throw error;
        }
        rateLimited = status === RATE_LIMITED_STATUS;

        const delayMs: number = BASE_DELAY_MS * 2 ** attempt + runtime.random() * BASE_DELAY_MS;
        const isLastAttempt: boolean = attempt + 1 >= profile.attemptsPerModel;
        if (isLastAttempt || runtime.now() + delayMs >= deadline) {
          console.warn(
            `[ai] ${task}: ${model} failed with status ${status} on attempt ${attempt + 1}/${profile.attemptsPerModel}. Moving to the next model`,
          );
          break;
        }

        console.warn(
          `[ai] ${task}: ${model} failed with status ${status} on attempt ${attempt + 1}/${profile.attemptsPerModel}. Retrying in ${Math.round(delayMs)}ms`,
        );
        await runtime.sleep(delayMs);
      }
    }
  }

  throw new AiUnavailableError(task, rateLimited);
}
