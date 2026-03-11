import { GenaiTTSService } from './genai-tts';

export interface TTSCallbacks {
  onStart: () => void;
  onEnd: () => void;
}

export interface TTSService {
  speak: (text: string) => Promise<void>;
  stop: () => void;
}

export function createTTSService(callbacks: TTSCallbacks): TTSService {
  return new GenaiTTSService(callbacks);
}
