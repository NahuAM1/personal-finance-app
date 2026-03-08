'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
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
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const accumulatedRef = useRef('');
  const lastInterimRef = useRef('');
  const isRecordingRef = useRef(false);

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

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 min-h-[40px] px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm text-gray-600 dark:text-gray-400 overflow-hidden">
        {interimText || (isRecording ? 'Escuchando...' : 'Toca el micrófono para hablar')}
      </div>
      <Button
        size="icon"
        variant={isRecording ? 'destructive' : 'default'}
        className={`rounded-full w-12 h-12 shrink-0 ${
          isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'
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
