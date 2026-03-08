import type { TTSCallbacks, TTSService } from './tts-service';
import type { AgentTTSResponse } from '@/types/agent';

export class GenaiTTSService implements TTSService {
  private audio: HTMLAudioElement | null = null;
  private callbacks: TTSCallbacks;

  constructor(callbacks: TTSCallbacks) {
    this.callbacks = callbacks;
  }

  async speak(text: string): Promise<void> {
    this.stop();

    try {
      const response = await fetch('/api/agent/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        console.warn('GenAI TTS failed, falling back to browser TTS');
        this.fallbackBrowserTTS(text);
        return;
      }

      const data: AgentTTSResponse = await response.json();
      const audioBlob = this.base64ToBlob(data.audio, data.mimeType);
      const audioUrl = URL.createObjectURL(audioBlob);

      this.audio = new Audio(audioUrl);

      this.audio.addEventListener('play', () => {
        this.callbacks.onStart();
      });

      this.audio.addEventListener('ended', () => {
        this.callbacks.onEnd();
        URL.revokeObjectURL(audioUrl);
      });

      this.audio.addEventListener('error', () => {
        this.callbacks.onEnd();
        URL.revokeObjectURL(audioUrl);
      });

      await this.audio.play();
    } catch (error) {
      console.warn('GenAI TTS error, falling back to browser TTS:', error);
      this.fallbackBrowserTTS(text);
    }
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
      this.callbacks.onEnd();
    }
  }

  private fallbackBrowserTTS(text: string): void {
    if (!window.speechSynthesis) {
      this.callbacks.onEnd();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-AR';
    utterance.rate = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find(v => v.lang.startsWith('es-AR'))
      ?? voices.find(v => v.lang.startsWith('es'));
    if (spanishVoice) {
      utterance.voice = spanishVoice;
    }

    utterance.onstart = () => this.callbacks.onStart();
    utterance.onend = () => this.callbacks.onEnd();
    utterance.onerror = () => this.callbacks.onEnd();

    window.speechSynthesis.speak(utterance);
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
}
