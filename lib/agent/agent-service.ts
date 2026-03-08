import type {
  AgentClassifyResponse,
  AgentExecuteResponse,
  AgentActionType,
} from '@/types/agent';

export async function classifyIntent(transcription: string): Promise<AgentClassifyResponse> {
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcription, step: 'classify' }),
  });

  if (!response.ok) {
    const errorData: { error: string } = await response.json();
    throw new Error(errorData.error ?? 'Classification failed');
  }

  const data: AgentClassifyResponse = await response.json();
  return data;
}

export async function executeStrategy(
  action: AgentActionType,
  transcription: string,
): Promise<AgentExecuteResponse> {
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcription, step: 'execute', action }),
  });

  if (!response.ok) {
    const errorData: { error: string } = await response.json();
    throw new Error(errorData.error ?? 'Execution failed');
  }

  const data: AgentExecuteResponse = await response.json();
  return data;
}
