'use client';

import { X } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { Button } from './ui/button';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
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
  const [recordingComplete, setRecordingComplete] = useState(false);

  const recognitionRef = useRef<any>(null);

  const startRecording = () => {
    setIsRecording(true);
    recognitionRef.current = new window.webkitSpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onresult = (event: any) => {
      const { transcript } = event.results[event.results.length - 1][0];

      setTranscript(transcript);
    };

    recognitionRef.current.start();
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setRecordingComplete(true);
      handleHidden();
      setHidden(true);
      setTranscriptDone(true);
    }
  };

  const handleToggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  };

  const handleHidden = () => {
    if (!isRecording) {
      setHidden(true);
      setTranscript('');
    }
  };

  return (
    <div className='flex items-center justify-center h-screen w-full relative'>
      <div onClick={() => handleHidden()} className='absolute top-0 right-0'>
        <Button variant='ghost' size='icon'>
          <X className='w-4 h-4' />
        </Button>
      </div>
      <div className='w-full'>
        {(isRecording || transcript) && (
          <div className='w-[200px] m-auto rounded-md border p-4 bg-white'>
            <div className='flex-1 flex w-full justify-between'>
              <div className='space-y-1'>
                <p className='text-sm font-medium leading-none'>
                  {recordingComplete ? 'Recorded' : 'Recording'}
                </p>
                <p className='text-sm text-muted-foreground'>
                  {recordingComplete
                    ? 'Thanks for talking.'
                    : 'Start speaking...'}
                </p>
              </div>
              {isRecording && (
                <div className='rounded-full w-4 h-4 bg-red-400 animate-pulse' />
              )}
            </div>

            {transcript && (
              <div className='border rounded-md p-2 h-fullm mt-4'>
                <p className='mb-0'>{transcript}</p>
              </div>
            )}
          </div>
        )}

        <div className='flex items-center w-full'>
          {isRecording ? (
            <button
              onClick={handleToggleRecording}
              className='mt-10 m-auto flex items-center justify-center bg-red-400 hover:bg-red-500 rounded-full w-10 h-10 md:w-14 md:h-14 focus:outline-none'
            >
              <svg
                className='h-6 w-6 md:h-12 md:w-12 '
                viewBox='0 0 24 24'
                xmlns='http://www.w3.org/2000/svg'
              >
                <path fill='white' d='M6 19h4V5H6v14zm8-14v14h4V5h-4z' />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleToggleRecording}
              className='mt-10 m-auto flex items-center justify-center bg-blue-400 hover:bg-blue-500 rounded-full w-10 h-10 md:w-14 md:h-14 focus:outline-none'
            >
              <svg
                viewBox='0 0 256 256'
                xmlns='http://www.w3.org/2000/svg'
                className='w-6 h-6 md:w-10 md:h-10 text-white'
              >
                <path
                  fill='currentColor'
                  d='M128 176a48.05 48.05 0 0 0 48-48V64a48 48 0 0 0-96 0v64a48.05 48.05 0 0 0 48 48ZM96 64a32 32 0 0 1 64 0v64a32 32 0 0 1-64 0Zm40 143.6V232a8 8 0 0 1-16 0v-24.4A80.11 80.11 0 0 1 48 128a8 8 0 0 1 16 0a64 64 0 0 0 128 0a8 8 0 0 1 16 0a80.11 80.11 0 0 1-72 79.6Z'
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
