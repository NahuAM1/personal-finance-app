import type { TTSCallbacks, TTSService } from './tts-service';

export class BrowserTTSService implements TTSService {
  private callbacks: TTSCallbacks;

  constructor(callbacks: TTSCallbacks) {
    this.callbacks = callbacks;
  }

  async speak(text: string): Promise<void> {
    this.stop();

    if (!window.speechSynthesis) {
      console.error('Speech synthesis not supported');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-AR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try to find a Spanish voice
    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find(v => v.lang.startsWith('es-AR'))
      ?? voices.find(v => v.lang.startsWith('es'));

    if (spanishVoice) {
      utterance.voice = spanishVoice;
    }

    utterance.onstart = () => {
      this.callbacks.onStart();
    };

    utterance.onend = () => {
      this.callbacks.onEnd();
    };

    utterance.onerror = () => {
      this.callbacks.onEnd();
    };

    window.speechSynthesis.speak(utterance);
  }

  stop(): void {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this.callbacks.onEnd();
    }
  }
}
