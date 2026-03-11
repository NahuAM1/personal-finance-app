'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { readonly transcript: string; readonly confidence: number };
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface AgentMicrophoneProps {
  onTranscription: (text: string) => void;
  disabled: boolean;
}

export function AgentMicrophone({ onTranscription, disabled }: AgentMicrophoneProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [textInput, setTextInput] = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const accumulatedRef = useRef('');
  const lastInterimRef = useRef('');
  const isRecordingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const getRecognition = useCallback((): SpeechRecognitionInstance | null => {
    if (recognitionRef.current) return recognitionRef.current;

    const SpeechRecognitionClass =
      (window as { SpeechRecognition?: new () => SpeechRecognitionInstance; webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
        .SpeechRecognition ??
      (window as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) return null;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-AR';
    recognitionRef.current = recognition;
    return recognition;
  }, []);

  const startRecording = useCallback(() => {
    setIsRecording(true);
    isRecordingRef.current = true;
    accumulatedRef.current = '';
    lastInterimRef.current = '';
    setInterimText('');

    const recognition = getRecognition();
    if (!recognition) return;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = accumulatedRef.current;
      let interim = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const segment = result[0].transcript.trim();
          if (!finalText.includes(segment)) {
            finalText += (finalText ? ' ' : '') + segment;
          }
        } else {
          interim += result[0].transcript;
        }
      }

      accumulatedRef.current = finalText;
      lastInterimRef.current = interim;
      setInterimText(finalText + (interim ? ' ' + interim : ''));
    };

    recognition.onend = () => {
      if (isRecordingRef.current) {
        try { recognition.start(); } catch { /* already started */ }
      }
    };

    recognition.onerror = () => {
      isRecordingRef.current = false;
      setIsRecording(false);
    };

    try {
      recognition.start();
    } catch {
      recognition.stop();
      setTimeout(() => {
        try { recognition.start(); } catch { /* ignore */ }
      }, 100);
    }
  }, [getRecognition]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
    }
    setIsRecording(false);

    // Use final text, but fall back to interim if nothing was finalized yet
    const finalText = accumulatedRef.current.trim() || lastInterimRef.current.trim();
    if (finalText) {
      onTranscription(finalText);
    }
    setInterimText('');
    accumulatedRef.current = '';
    lastInterimRef.current = '';
  }, [onTranscription]);

  const handleToggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleSendText = useCallback(() => {
    const trimmed = textInput.trim();
    if (trimmed) {
      onTranscription(trimmed);
      setTextInput('');
    }
  }, [textInput, onTranscription]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  }, [handleSendText]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="flex items-center gap-2 w-full">
      {isRecording ? (
        <div className="flex-1 min-h-[40px] px-4 py-2 rounded-full text-sm overflow-hidden backdrop-blur-sm bg-purple-100/60 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
          {interimText || 'Escuchando...'}
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="text"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí tu mensaje..."
            disabled={disabled}
            className="flex-1 min-h-[40px] px-4 py-2 rounded-full text-sm bg-white/90 dark:bg-gray-800/90 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
          />
          {textInput.trim() && (
            <Button
              size="icon"
              className="rounded-full w-10 h-10 shrink-0 shadow-md bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
              onClick={handleSendText}
              disabled={disabled}
              aria-label="Enviar mensaje"
            >
              <Send className="w-4 h-4 text-white" />
            </Button>
          )}
        </>
      )}
      <Button
        size="icon"
        variant={isRecording ? 'destructive' : 'default'}
        className={`rounded-full w-12 h-12 shrink-0 shadow-md ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700'
        }`}
        onClick={handleToggle}
        disabled={disabled}
        aria-label={isRecording ? 'Detener grabación' : 'Iniciar grabación'}
      >
        {isRecording ? (
          <MicOff className="w-5 h-5 text-white" />
        ) : (
          <Mic className="w-5 h-5 text-white" />
        )}
      </Button>
    </div>
  );
}
