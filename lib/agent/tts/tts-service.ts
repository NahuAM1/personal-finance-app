import type { TTSEngine } from '@/types/agent';
import { GenaiTTSService } from './genai-tts';
import { BrowserTTSService } from './browser-tts';

export interface TTSCallbacks {
  onStart: () => void;
  onEnd: () => void;
}

export interface TTSService {
  speak: (text: string) => Promise<void>;
  stop: () => void;
}

export function createTTSService(engine: TTSEngine, callbacks: TTSCallbacks): TTSService {
  if (engine === 'genai') {
    return new GenaiTTSService(callbacks);
  }
  return new BrowserTTSService(callbacks);
}
