import { AiTask, runAiTask, type AiRequest, type AiRuntime } from '@/lib/ai/gateway';
import { safeParseJson } from '@/lib/agent/utils/json-utils';
import { serializeHistory } from '@/lib/agent/utils/serialize-history';
import { buildClassifierPrompt } from '@/public/promts/classifier-prompt';
import { AgentAction, type AgentActionType, type ConversationMessage } from '@/types/agent';

export interface IntentClassification {
  action: AgentActionType;
  confidence: number;
}

export async function classifyTranscription(
  transcription: string,
  conversationHistory?: ConversationMessage[],
  runtime?: AiRuntime,
): Promise<IntentClassification> {
  const prompt: string = buildClassifierPrompt(transcription, conversationHistory);
  const rawContent: string = await runAiTask(AiTask.AGENT_CLASSIFY, { contents: prompt }, runtime);

  const defaultClassification: IntentClassification = {
    action: AgentAction.GENERAL_QUESTION,
    confidence: 0,
  };
  const parsed: IntentClassification = safeParseJson<IntentClassification>(rawContent, defaultClassification);
  return parsed.action ? parsed : defaultClassification;
}

export async function generateAgentReply(
  prompt: string,
  conversationHistory?: ConversationMessage[],
  runtime?: AiRuntime,
): Promise<string> {
  const request: AiRequest = { contents: prompt };
  if (conversationHistory && conversationHistory.length > 0) {
    request.systemInstruction = `<conversation_history>\n${serializeHistory(conversationHistory)}\n</conversation_history>`;
  }
  return runAiTask(AiTask.AGENT_REPLY, request, runtime);
}
