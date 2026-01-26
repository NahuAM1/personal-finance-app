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
    <div className='flex items-center justify-center h-screen w-full relative bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-gray-950 dark:via-emerald-950/20 dark:to-gray-950'>
      {/* Decorative background elements */}
      <div className='absolute inset-0 overflow-hidden pointer-events-none'>
        <div className='absolute -top-40 -right-40 w-80 h-80 bg-emerald-400/20 rounded-full blur-3xl' />
        <div className='absolute -bottom-40 -left-40 w-80 h-80 bg-teal-400/20 rounded-full blur-3xl' />
      </div>

      <div onClick={() => handleHidden()} className='absolute top-4 right-4 z-10'>
        <Button variant='ghost' size='icon' className='hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-full' aria-label='Cerrar grabación'>
          <X className='w-5 h-5' aria-hidden='true' />
        </Button>
      </div>

      <div className='w-full relative z-10'>
        {(isRecording || transcript) && (
          <div className='w-[280px] m-auto rounded-2xl border-2 border-emerald-100 dark:border-emerald-900 p-5 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-xl shadow-emerald-500/10'>
            <div className='flex-1 flex w-full justify-between items-center'>
              <div className='space-y-1'>
                <p className='text-sm font-semibold leading-none text-gray-900 dark:text-gray-100'>
                  {recordingComplete ? 'Grabación completada' : 'Grabando...'}
                </p>
                <p className='text-sm text-gray-500 dark:text-gray-400'>
                  {recordingComplete
                    ? 'Procesando tu mensaje...'
                    : 'Habla claramente...'}
                </p>
              </div>
              {isRecording && (
                <div className='relative'>
                  <div className='rounded-full w-4 h-4 bg-red-500 animate-pulse' />
                  <div className='absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75' />
                </div>
              )}
            </div>

            {transcript && (
              <div className='border-2 border-emerald-100 dark:border-emerald-900 rounded-xl p-3 mt-4 bg-emerald-50/50 dark:bg-emerald-950/30'>
                <p className='mb-0 text-sm text-gray-700 dark:text-gray-300'>{transcript}</p>
              </div>
            )}
          </div>
        )}

        <div className='flex items-center w-full justify-center'>
          {isRecording ? (
            <button
              onClick={handleToggleRecording}
              className='mt-10 flex items-center justify-center bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 rounded-full w-16 h-16 md:w-20 md:h-20 focus:outline-none focus:ring-4 focus:ring-red-500/30 shadow-lg shadow-red-500/30 transition-all duration-200 hover:scale-105'
              aria-label='Detener grabación'
            >
              <svg
                className='h-8 w-8 md:h-10 md:w-10'
                viewBox='0 0 24 24'
                xmlns='http://www.w3.org/2000/svg'
                aria-hidden='true'
              >
                <path fill='white' d='M6 19h4V5H6v14zm8-14v14h4V5h-4z' />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleToggleRecording}
              className='mt-10 flex items-center justify-center bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-full w-16 h-16 md:w-20 md:h-20 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 shadow-lg shadow-emerald-500/30 transition-all duration-200 hover:scale-105'
              aria-label='Iniciar grabación'
            >
              <svg
                viewBox='0 0 256 256'
                xmlns='http://www.w3.org/2000/svg'
                className='w-8 h-8 md:w-10 md:h-10 text-white'
                aria-hidden='true'
              >
                <path
                  fill='currentColor'
                  d='M128 176a48.05 48.05 0 0 0 48-48V64a48 48 0 0 0-96 0v64a48.05 48.05 0 0 0 48 48ZM96 64a32 32 0 0 1 64 0v64a32 32 0 0 1-64 0Zm40 143.6V232a8 8 0 0 1-16 0v-24.4A80.11 80.11 0 0 1 48 128a8 8 0 0 1 16 0a64 64 0 0 0 128 0a8 8 0 0 1 16 0a80.11 80.11 0 0 1-72 79.6Z'
                />
              </svg>
            </button>
          )}
        </div>

        <p className='text-center text-sm text-gray-500 dark:text-gray-400 mt-6'>
          {isRecording ? 'Toca para detener' : 'Toca para grabar'}
        </p>
      </div>
    </div>
  );
}
