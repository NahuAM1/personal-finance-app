'use client';

import { Mic, MicOff, X } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from './ui/button';

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
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

declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
    SpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

interface MicrophoneComponentProps {
  transcript: string;
  setTranscript: (transcript: string) => void;
  setHidden: (hidden: boolean) => void;
  setTranscriptDone: (transcriptDone: boolean) => void;
}

export function MicrophoneComponent({
  transcript,
  setTranscript,
  setHidden,
  setTranscriptDone,
}: MicrophoneComponentProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const accumulatedTranscriptRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const isRecordingRef = useRef(false);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getRecognitionInstance = useCallback((): SpeechRecognitionInstance | null => {
    if (recognitionRef.current) {
      return recognitionRef.current;
    }

    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      return null;
    }

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
    setElapsed(0);
    accumulatedTranscriptRef.current = '';

    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    const recognition = getRecognitionInstance();
    if (!recognition) return;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = accumulatedTranscriptRef.current;
      let interimTranscript = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const segmentText = result[0].transcript.trim();
          if (!finalTranscript.includes(segmentText)) {
            finalTranscript += (finalTranscript ? ' ' : '') + segmentText;
          }
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      accumulatedTranscriptRef.current = finalTranscript;
      const fullTranscript = finalTranscript + (interimTranscript ? ' ' + interimTranscript : '');
      setTranscript(fullTranscript.trim());
    };

    recognition.onend = () => {
      if (isRecordingRef.current) {
        try {
          recognition.start();
        } catch {
          // Already started
        }
      }
    };

    recognition.onerror = () => {
      setIsRecording(false);
      isRecordingRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };

    try {
      recognition.start();
    } catch {
      recognition.stop();
      setTimeout(() => {
        try {
          recognition.start();
        } catch {
          // Ignore
        }
      }, 100);
    }
  }, [getRecognitionInstance, setTranscript]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      isRecordingRef.current = false;
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setHidden(true);
      setTranscriptDone(true);
    }
  }, [setHidden, setTranscriptDone]);

  const handleToggleRecording = useCallback(() => {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleClose = useCallback(() => {
    if (isRecording) {
      isRecordingRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setHidden(true);
    setTranscript('');
    accumulatedTranscriptRef.current = '';
  }, [isRecording, setHidden, setTranscript]);

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className='flex flex-col items-center justify-between h-[100dvh] w-full relative bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] overflow-hidden overscroll-contain'>
      {/* Decorative background blobs — same style as dashboard */}
      <div className='absolute inset-0 overflow-hidden pointer-events-none'>
        <div className={`absolute -top-40 -right-40 w-80 h-80 bg-emerald-400/20 rounded-full blur-3xl transition-opacity duration-1000 motion-reduce:transition-none ${isRecording ? 'opacity-60' : 'opacity-30'}`} />
        <div className={`absolute -bottom-40 -left-40 w-80 h-80 bg-teal-400/20 rounded-full blur-3xl transition-opacity duration-1000 motion-reduce:transition-none ${isRecording ? 'opacity-60' : 'opacity-30'}`} />
      </div>

      {/* Header bar */}
      <div className='relative z-10 w-full flex items-center justify-between px-5 pt-5'>
        <div className='flex items-center gap-3'>
          {isRecording && (
            <>
              <div className='w-2.5 h-2.5 rounded-full bg-destructive animate-pulse motion-reduce:animate-none' />
              <span className='text-sm font-semibold tabular-nums text-muted-foreground'>
                {formatTime(elapsed)}
              </span>
            </>
          )}
        </div>
        <Button
          onClick={handleClose}
          variant='ghost'
          size='icon'
          className='rounded-full'
          aria-label='Cerrar grabación'
        >
          <X className='w-5 h-5' aria-hidden='true' />
        </Button>
      </div>

      {/* Transcript area */}
      <div className='relative z-10 flex-1 w-full max-w-sm px-6 flex flex-col justify-center'>
        {transcript ? (
          <div className='glass rounded-2xl border p-5 max-h-48 overflow-y-auto scrollbar-thin shadow-sm'>
            <p className='text-sm leading-relaxed text-card-foreground'>
              {transcript}
            </p>
            <div ref={transcriptEndRef} />
          </div>
        ) : (
          <div className='text-center'>
            <p className='text-lg font-semibold leading-none tracking-tight text-card-foreground dark:text-foreground'>
              {isRecording ? 'Escuchando\u2026' : 'Toca el micrófono para empezar'}
            </p>
            <p className='text-sm text-muted-foreground mt-2'>
              {isRecording
                ? 'Habla de forma natural, todo queda registrado'
                : 'Dicta tu transacción por voz'}
            </p>
          </div>
        )}
      </div>

      {/* Microphone button area */}
      <div className='relative z-10 flex flex-col items-center pb-12 pt-6'>
        {/* Animated rings — emerald themed */}
        <div className='relative flex items-center justify-center'>
          {isRecording && (
            <>
              <div className='absolute w-28 h-28 md:w-32 md:h-32 rounded-full border border-emerald-500/20 animate-ping motion-reduce:animate-none' style={{ animationDuration: '2s' }} />
              <div className='absolute w-36 h-36 md:w-40 md:h-40 rounded-full border border-emerald-500/10 animate-ping motion-reduce:animate-none' style={{ animationDuration: '2.5s' }} />
            </>
          )}

          <button
            onClick={handleToggleRecording}
            className={`btn-press relative flex items-center justify-center rounded-full w-20 h-20 md:w-24 md:h-24 focus-ring shadow-lg transition-transform duration-200 hover:scale-105 motion-reduce:transition-none touch-action-manipulation ${
              isRecording
                ? 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-red-500/25'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/25'
            }`}
            aria-label={isRecording ? 'Detener grabación' : 'Iniciar grabación'}
          >
            {isRecording ? (
              <MicOff className='relative w-8 h-8 md:w-10 md:h-10 text-white' aria-hidden='true' />
            ) : (
              <Mic className='relative w-8 h-8 md:w-10 md:h-10 text-white' aria-hidden='true' />
            )}
          </button>
        </div>

        <p className='text-center text-xs text-muted-foreground mt-5'>
          {isRecording ? 'Toca para enviar' : 'Toca para grabar'}
        </p>
      </div>
    </div>
  );
}
