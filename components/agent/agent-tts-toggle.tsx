'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAgentContext } from '@/contexts/agent-context';

export function AgentTTSToggle() {
  const { voiceEnabled, toggleVoice } = useAgentContext();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleVoice}
      className="rounded-full w-8 h-8"
      aria-label={voiceEnabled ? 'Desactivar voz' : 'Activar voz'}
    >
      {voiceEnabled ? (
        <Volume2 className="w-4 h-4 text-purple-500" />
      ) : (
        <VolumeX className="w-4 h-4 text-gray-400" />
      )}
    </Button>
  );
}
