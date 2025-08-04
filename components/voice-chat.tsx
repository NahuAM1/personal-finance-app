'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { replaceTranscriptionPlaceholder } from '@/public/utils/transcriptionUtils';
import { useToast } from '@/hooks/use-toast';

interface VoiceChatProps {
  onResponse?: (response: any) => void;
}

export default function VoiceChat({ onResponse }: VoiceChatProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'es-ES';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + ' ';
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        if (finalTranscript) {
          setTranscript((prev) => prev + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setError(`Error de reconocimiento: ${event.error}`);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        if (isListening) {
          recognitionRef.current.start();
        }
      };
    } else {
      console.error('[VoiceChat] Browser does not support speech recognition');
      setError('Tu navegador no soporta reconocimiento de voz');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isListening]);

  const startListening = () => {
    setError(null);
    setTranscript('');
    setIsListening(true);
    if (recognitionRef.current) {
      recognitionRef.current.start();
    }
  };

  const stopListening = async () => {
    setIsListening(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    if (transcript.trim()) {
      console.log('[VoiceChat] Transcript to send:', transcript);
      await sendToOpenAI(transcript);
    } else {
      toast({
        title: 'Error',
        description:
          'No se pudo registrar el audio correctamente, por favor intentelo nuevamente.',
        variant: 'destructive',
      });
      console.log('[VoiceChat] No transcript to send (empty or whitespace)');
    }
  };

  const sendToOpenAI = async (text: string) => {
    setIsProcessing(true);
    setError(null);

    const message: string = replaceTranscriptionPlaceholder(text);
    console.log('message: ', message);
    console.log('text: ', text);

    try {
      const response = await fetch('/api/openAI', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al procesar la solicitud');
      }

      const data = await response.json();

      if (onResponse) {
        onResponse(data.choices[0]?.message?.content);
      }
    } catch (err) {
      console.error('[VoiceChat] Error sending to OpenAI:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className='flex flex-col items-center space-y-4 p-4'>
      <button
        onClick={toggleListening}
        disabled={isProcessing}
        className={`p-4 rounded-full transition-all ${
          isListening
            ? 'bg-red-500 hover:bg-red-600 animate-pulse'
            : 'bg-blue-500 hover:bg-blue-600'
        } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isProcessing ? (
          <Loader2 className='w-8 h-8 animate-spin' />
        ) : isListening ? (
          <MicOff className='w-8 h-8' />
        ) : (
          <Mic className='w-8 h-8' />
        )}
      </button>

      {transcript && (
        <div className='w-full max-w-md p-4 bg-gray-100 rounded-lg'>
          <p className='text-sm text-gray-700'>{transcript}</p>
        </div>
      )}

      {error && (
        <div className='w-full max-w-md p-4 bg-red-100 text-red-700 rounded-lg'>
          <p className='text-sm'>{error}</p>
        </div>
      )}

      <div className='text-center text-sm text-gray-600'>
        {isListening && 'Escuchando...'}
        {isProcessing && 'Procesando...'}
        {!isListening && !isProcessing && 'Haz clic para hablar'}
      </div>
    </div>
  );
}
