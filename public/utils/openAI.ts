interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function getMessage(openaiMessage: string): OpenAIMessage {
  return {
    role: 'user',
    content: openaiMessage,
  };
}
