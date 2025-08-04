import { transcriptionPromt } from '../promts/transcriptions';

export function replaceTranscriptionPlaceholder(transcription: string): string {
  return transcriptionPromt.replace('<TRANSCRIPTION/>', transcription);
}