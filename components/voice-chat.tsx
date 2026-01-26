'use client';

import { useEffect, useState } from 'react';
import { replaceTranscriptionPlaceholder } from '@/public/utils/transcriptionUtils';
import { MicrophoneComponent } from '@/components/microphone-component';
import { Button } from './ui/button';
import CircularProgress from '@mui/material/CircularProgress';
import { useToast } from '@/hooks/use-toast';

interface VoiceChatProps {
  onResponse?: (response: any) => void;
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
          hidden ? 'flex md:flex-row-reverse' : 'hidden'
        } h-full w-full`}
      >
        {loading ? (
          <div className='flex w-full items-center justify-center m-10'>
            <div className='relative'>
              <div className='absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full blur-xl opacity-30 animate-pulse' />
              <CircularProgress sx={{ color: '#10b981' }} />
            </div>
          </div>
        ) : (
          <Button
            onClick={() => setHidden(false)}
            className='w-full md:w-1/4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/25 m-4 md:mx-0'
          >
            <svg className='w-4 h-4 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' />
            </svg>
            Generar con IA
          </Button>
        )}
      </div>
      <div className={`${hidden ? 'hidden' : 'flex'} h-full w-full`}>
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
