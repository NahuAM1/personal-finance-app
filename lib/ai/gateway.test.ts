import { describe, expect, it } from 'vitest';
import { ApiError, type GenerateContentParameters } from '@google/genai';
import {
  AI_TASK_PROFILES,
  AiTask,
  AiUnavailableError,
  runAiTask,
  type AiRuntime,
} from '@/lib/ai/gateway';
import { GeminiModels } from '@/public/enums';

const FUNCTION_MAX_DURATION_MS = 60_000;

interface FakeCall {
  result: string | Error;
  latencyMs: number;
}

interface FakeRuntime {
  runtime: AiRuntime;
  models: string[];
  sleeps: number[];
  timeouts: number[];
  params: GenerateContentParameters[];
  elapsed: () => number;
}

function ok(text: string, latencyMs: number = 0): FakeCall {
  return { result: text, latencyMs };
}

function fail(status: number, latencyMs: number = 0): FakeCall {
  return { result: new ApiError({ message: `status ${status}`, status }), latencyMs };
}

function timedOut(): FakeCall {
  return { result: new DOMException('This operation was aborted', 'AbortError'), latencyMs: 0 };
}

function createRuntime(calls: FakeCall[]): FakeRuntime {
  let clock: number = 0;
  const queue: FakeCall[] = [...calls];
  const fake: FakeRuntime = {
    models: [],
    sleeps: [],
    timeouts: [],
    params: [],
    elapsed: () => clock,
    runtime: {
      now: () => clock,
      random: () => 0,
      sleep: async (ms: number) => {
        fake.sleeps.push(ms);
        clock += ms;
      },
      timeoutSignal: (ms: number) => {
        fake.timeouts.push(ms);
        return new AbortController().signal;
      },
      transport: async (params: GenerateContentParameters) => {
        fake.models.push(params.model);
        fake.params.push(params);
        const next: FakeCall | undefined = queue.shift();
        if (next === undefined) {
          throw new Error('Unexpected Gemini call');
        }
        clock += next.latencyMs;
        if (next.result instanceof Error) {
          throw next.result;
        }
        return next.result;
      },
    },
  };
  return fake;
}

const PRIMARY: GeminiModels = GeminiModels.GEMINI_3_5_FLASH;
const FALLBACK: GeminiModels = GeminiModels.GEMINI_2_5_FLASH;

describe('runAiTask', () => {
  it('returns the primary model text on the first success', async () => {
    const fake: FakeRuntime = createRuntime([ok('ticket')]);

    const text: string = await runAiTask(AiTask.SCAN_RECEIPT, { contents: 'prompt' }, fake.runtime);

    expect(text).toBe('ticket');
    expect(fake.models).toEqual([PRIMARY]);
    expect(fake.sleeps).toEqual([]);
  });

  it('retries the same model with backoff when a transient error is followed by a success', async () => {
    const fake: FakeRuntime = createRuntime([fail(503), ok('ticket')]);

    const text: string = await runAiTask(AiTask.SCAN_RECEIPT, { contents: 'prompt' }, fake.runtime);

    expect(text).toBe('ticket');
    expect(fake.models).toEqual([PRIMARY, PRIMARY]);
    expect(fake.sleeps).toEqual([1000]);
  });

  it('falls back to the next model after two consecutive 503 responses', async () => {
    const fake: FakeRuntime = createRuntime([fail(503), fail(503), ok('ticket')]);

    const text: string = await runAiTask(AiTask.SCAN_RECEIPT, { contents: 'prompt' }, fake.runtime);

    expect(text).toBe('ticket');
    expect(fake.models).toEqual([PRIMARY, PRIMARY, FALLBACK]);
    expect(fake.sleeps).toEqual([1000]);
  });

  it('treats an aborted attempt as a transient timeout', async () => {
    const fake: FakeRuntime = createRuntime([timedOut(), ok('ticket')]);

    const text: string = await runAiTask(AiTask.SCAN_RECEIPT, { contents: 'prompt' }, fake.runtime);

    expect(text).toBe('ticket');
    expect(fake.models).toEqual([PRIMARY, PRIMARY]);
  });

  it('rethrows a non-transient Gemini error without retrying or falling back', async () => {
    const fake: FakeRuntime = createRuntime([fail(400)]);

    await expect(
      runAiTask(AiTask.SCAN_RECEIPT, { contents: 'prompt' }, fake.runtime),
    ).rejects.toMatchObject({ status: 400 });
    expect(fake.models).toEqual([PRIMARY]);
  });

  it('throws AiUnavailableError once every model is exhausted', async () => {
    const fake: FakeRuntime = createRuntime([fail(503), fail(503), fail(503), fail(503)]);

    const error: Error = await runAiTask(AiTask.SCAN_RECEIPT, { contents: 'prompt' }, fake.runtime).then(
      () => new Error('Expected a rejection'),
      (rejection: Error) => rejection,
    );

    expect(error).toBeInstanceOf(AiUnavailableError);
    expect(error).toMatchObject({ task: AiTask.SCAN_RECEIPT, rateLimited: false });
    expect(fake.models).toEqual([PRIMARY, PRIMARY, FALLBACK, FALLBACK]);
  });

  it('flags the failure as rate limited when the last error was a 429', async () => {
    const fake: FakeRuntime = createRuntime([fail(429), fail(429), fail(429), fail(429)]);

    await expect(
      runAiTask(AiTask.AGENT_REPLY, { contents: 'prompt' }, fake.runtime),
    ).rejects.toMatchObject({ rateLimited: true });
  });

  it('stops instead of starting an attempt the remaining budget cannot hold', async () => {
    const budgetMs: number = AI_TASK_PROFILES[AiTask.SCAN_RECEIPT].budgetMs;
    const fake: FakeRuntime = createRuntime([fail(503, budgetMs - 1000)]);

    await expect(
      runAiTask(AiTask.SCAN_RECEIPT, { contents: 'prompt' }, fake.runtime),
    ).rejects.toBeInstanceOf(AiUnavailableError);
    expect(fake.models).toEqual([PRIMARY]);
    expect(fake.sleeps).toEqual([]);
    expect(fake.elapsed()).toBeLessThanOrEqual(budgetMs);
  });

  it('caps each attempt timeout to the budget that is left', async () => {
    const profile = AI_TASK_PROFILES[AiTask.SCAN_RECEIPT];
    const fake: FakeRuntime = createRuntime([fail(503, 30_000), ok('ticket')]);

    await runAiTask(AiTask.SCAN_RECEIPT, { contents: 'prompt' }, fake.runtime);

    expect(fake.timeouts).toEqual([
      profile.attemptTimeoutMs,
      profile.budgetMs - 30_000 - 1000,
    ]);
  });

  it('sends the task config, the abort signal and the system instruction to Gemini', async () => {
    const fake: FakeRuntime = createRuntime([ok('{"message":"hola"}')]);

    await runAiTask(
      AiTask.AGENT_REPLY,
      { contents: 'prompt', systemInstruction: '<conversation_history></conversation_history>' },
      fake.runtime,
    );

    expect(fake.params[0]?.contents).toBe('prompt');
    expect(fake.params[0]?.config).toMatchObject({
      ...AI_TASK_PROFILES[AiTask.AGENT_REPLY].config,
      systemInstruction: '<conversation_history></conversation_history>',
    });
    expect(fake.params[0]?.config?.abortSignal).toBeInstanceOf(AbortSignal);
  });
});

describe('AI_TASK_PROFILES', () => {
  it.each(Object.values(AiTask))('%s falls back to a second model within the function time limit', (task: AiTask) => {
    const profile = AI_TASK_PROFILES[task];

    expect(profile.models).toEqual([PRIMARY, FALLBACK]);
    expect(profile.attemptsPerModel).toBe(2);
    expect(profile.attemptTimeoutMs).toBeLessThanOrEqual(profile.budgetMs);
    expect(profile.budgetMs).toBeLessThan(FUNCTION_MAX_DURATION_MS);
  });
});
