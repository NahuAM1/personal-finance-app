import type {
  AgentClassifyResponse,
  AgentExecuteResponse,
  AgentActionType,
  AgentPayload,
  ConversationMessage,
} from '@/types/agent';

export async function classifyIntent(
  transcription: string,
  conversationHistory?: ConversationMessage[],
): Promise<AgentClassifyResponse> {
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcription, step: 'classify', conversationHistory }),
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
  conversationHistory?: ConversationMessage[],
): Promise<AgentExecuteResponse> {
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcription, step: 'execute', action, conversationHistory }),
  });

  if (!response.ok) {
    const errorData: { error: string } = await response.json();
    throw new Error(errorData.error ?? 'Execution failed');
  }

  const data: AgentExecuteResponse = await response.json();
  return data;
}

export async function fetchPostConfirmMessage(
  action: AgentActionType,
  payload: AgentPayload,
): Promise<string> {
  try {
    const response = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcription: '', step: 'post-confirm', action, payload }),
    });
    if (!response.ok) return 'Listo, se registró correctamente.';
    const data: { message: string } = await response.json();
    return data.message || 'Listo, se registró correctamente.';
  } catch {
    return 'Listo, se registró correctamente.';
  }
}

export async function fetchWelcomeMessage(): Promise<string> {
  try {
    const response = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcription: '', step: 'welcome' }),
    });
    if (!response.ok) return '¿En qué te puedo ayudar?';
    const data: { message: string } = await response.json();
    return data.message || '¿En qué te puedo ayudar?';
  } catch {
    return '¿En qué te puedo ayudar?';
  }
}
