import { transcriptionPrompt } from '../promts/transcriptions';

export function replaceTranscriptionPlaceholder(transcription: string): string {
  return transcriptionPrompt.replace('<TRANSCRIPTION/>', transcription);
}
