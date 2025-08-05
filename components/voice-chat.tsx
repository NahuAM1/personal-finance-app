'use client';

import { useState } from 'react';
import { replaceTranscriptionPlaceholder } from '@/public/utils/transcriptionUtils';
import { MicrophoneComponent } from '@/components/microphone-component';

interface VoiceChatProps {
  onResponse?: (response: any) => void;
}

export default function VoiceChat({ onResponse }: VoiceChatProps) {
  const [transcript, setTranscript] = useState('');

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

  return (
    <div className='absolute w-full h-full bottom-0 right-0'>
      <MicrophoneComponent
        transcript={transcript}
        setTranscript={setTranscript}
      />
    </div>
  );
}
