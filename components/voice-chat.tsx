'use client';

import { useEffect, useState } from 'react';
import { replaceTranscriptionPlaceholder } from '@/public/utils/transcriptionUtils';
import { MicrophoneComponent } from '@/components/microphone-component';
import { Button } from './ui/button';

interface VoiceChatProps {
  onResponse?: (response: any) => void;
}

export default function VoiceChat({ onResponse }: VoiceChatProps) {
  const [transcript, setTranscript] = useState('');
  const [transcriptDone, setTranscriptDone] = useState(false);
  const [hidden, setHidden] = useState(true);

  const sendToOpenAI = async (text: string) => {
    const message: string = replaceTranscriptionPlaceholder(text);

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
        <Button
          onClick={() => setHidden(false)}
          className='w-full md:w-1/4 bg-blue-500 hover:bg-blue-600 m-4 md:mx-0'
        >
          Generar con IA
        </Button>
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
