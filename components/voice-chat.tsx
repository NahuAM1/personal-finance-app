'use client';

import { useEffect, useState } from 'react';
import { replaceTranscriptionPlaceholder } from '@/public/utils/transcriptionUtils';
import { MicrophoneComponent } from '@/components/microphone-component';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Loader2, ChevronRight } from 'lucide-react';

interface VoiceChatProps {
  onResponse?: (response: string) => void;
}

export default function VoiceChat({ onResponse }: VoiceChatProps) {
  const [transcript, setTranscript] = useState('');
  const [transcriptDone, setTranscriptDone] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const sendToOpenAI = async (text: string) => {
    setLoading(true);
    const message: string = replaceTranscriptionPlaceholder(text);

    try {
      toast({
        title: 'Procesando',
        description:
          'La transacción se esta procesando, por favor aguarde un instante',
        variant: 'info',
      });
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
      toast({
        title: 'Limite de creditos de IA',
        description:
          'Se alcanzaron los limites de creditos diarios de la IA, lamentamos la molestia.',
        variant: 'destructive',
      });
    } finally {
      setTranscriptDone(false);
      setLoading(false);
      setTranscript('');
    }
  };

  useEffect(() => {
    const handleTranscript = async () => {
      if (transcript && transcriptDone) {
        await sendToOpenAI(transcript);
      }
    };
    handleTranscript();
  }, [transcript, transcriptDone]);

  return (
    <>
      <div
        className={`${
          hidden ? 'block' : 'hidden'
        } w-full mb-4`}
      >
        {loading ? (
          <div className='rounded-2xl border bg-card text-card-foreground shadow-sm p-5'>
            <div className='flex items-center gap-4'>
              <div className='relative flex-shrink-0'>
                <div className='absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full blur-lg opacity-40 animate-pulse motion-reduce:animate-none' />
                <div className='relative flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md shadow-emerald-500/25'>
                  <Loader2 className='w-5 h-5 text-white animate-spin motion-reduce:animate-none' aria-hidden='true' />
                </div>
              </div>
              <div className='min-w-0'>
                <p className='text-sm font-semibold leading-none tracking-tight text-card-foreground'>
                  Procesando con IA
                </p>
                <p className='text-sm text-muted-foreground mt-1'>
                  Analizando tu mensaje de voz{'\u2026'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setHidden(false)}
            className='group card-hover w-full rounded-2xl border-2 border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-card-foreground shadow-sm p-5 text-left focus-ring transition-all duration-300'
          >
            <div className='flex items-center gap-4'>
              <div className='relative flex-shrink-0'>
                <div className='absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full blur-lg opacity-20 transition-opacity duration-300 group-hover:opacity-40 motion-reduce:transition-none' />
                <div className='relative flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md shadow-emerald-500/25'>
                  <Sparkles className='w-5 h-5 text-white' aria-hidden='true' />
                </div>
              </div>
              <div className='min-w-0 flex-1'>
                <p className='text-sm font-semibold leading-none tracking-tight text-card-foreground'>
                  Generar con IA
                </p>
                <p className='text-sm text-muted-foreground mt-1'>
                  Dicta tu transacción por voz
                </p>
              </div>
              <ChevronRight className='w-5 h-5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none' aria-hidden='true' />
            </div>
          </button>
        )}
      </div>
      <div className={`${hidden ? 'hidden' : 'flex'} fixed inset-0 z-50 h-full w-full`}>
        <MicrophoneComponent
          transcript={transcript}
          setTranscript={setTranscript}
          setHidden={setHidden}
          setTranscriptDone={setTranscriptDone}
        />
      </div>
    </>
  );
}
