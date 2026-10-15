import { describe, expect, it } from 'vitest';
import type { GenerateContentParameters } from '@google/genai';
import { AI_TASK_PROFILES, AiTask, type AiRuntime } from '@/lib/ai/gateway';
import { classifyTranscription, generateAgentReply } from '@/lib/agent/llm';
import { buildClassifierPrompt } from '@/public/promts/classifier-prompt';
import { serializeHistory } from '@/lib/agent/utils/serialize-history';
import { GeminiModels } from '@/public/enums';
import { AgentAction, type ConversationMessage } from '@/types/agent';

interface FakeRuntime {
  runtime: AiRuntime;
  params: GenerateContentParameters[];
}

function createRuntime(reply: string): FakeRuntime {
  const params: GenerateContentParameters[] = [];
  return {
    params,
    runtime: {
      now: () => 0,
      random: () => 0,
      sleep: async () => {},
      timeoutSignal: () => new AbortController().signal,
      transport: async (request: GenerateContentParameters) => {
        params.push(request);
        return reply;
      },
    },
  };
}

const HISTORY: ConversationMessage[] = [
  { role: 'user', content: 'Gasté 5000 en el super' },
  { role: 'assistant', content: 'Anotado.' },
];

describe('classifyTranscription', () => {
  it('asks Gemini for a JSON classification and returns the parsed action', async () => {
    const fake: FakeRuntime = createRuntime('{"action":"add_expense","confidence":0.92}');

    const result = await classifyTranscription('Gasté 5000 en el super', HISTORY, fake.runtime);

    expect(result).toEqual({ action: AgentAction.ADD_EXPENSE, confidence: 0.92 });
    expect(fake.params[0]?.model).toBe(GeminiModels.GEMINI_3_5_FLASH);
    expect(fake.params[0]?.contents).toBe(buildClassifierPrompt('Gasté 5000 en el super', HISTORY));
    expect(fake.params[0]?.config).toMatchObject(AI_TASK_PROFILES[AiTask.AGENT_CLASSIFY].config);
  });

  it('keeps returning a zero-confidence general question when the model gives no action', async () => {
    const fake: FakeRuntime = createRuntime('no json here');

    const result = await classifyTranscription('hola', [], fake.runtime);

    expect(result).toEqual({ action: AgentAction.GENERAL_QUESTION, confidence: 0 });
  });
});

describe('generateAgentReply', () => {
  it('sends the conversation history to Gemini as the system instruction', async () => {
    const fake: FakeRuntime = createRuntime('{"message":"Listo"}');

    const reply: string = await generateAgentReply('prompt', HISTORY, fake.runtime);

    expect(reply).toBe('{"message":"Listo"}');
    expect(fake.params[0]?.contents).toBe('prompt');
    expect(fake.params[0]?.config).toMatchObject({
      ...AI_TASK_PROFILES[AiTask.AGENT_REPLY].config,
      systemInstruction: `<conversation_history>\n${serializeHistory(HISTORY)}\n</conversation_history>`,
    });
  });

  it('sends no system instruction when there is no history', async () => {
    const fake: FakeRuntime = createRuntime('ok');

    await generateAgentReply('prompt', [], fake.runtime);

    expect(fake.params[0]?.config).not.toHaveProperty('systemInstruction');
  });
});
