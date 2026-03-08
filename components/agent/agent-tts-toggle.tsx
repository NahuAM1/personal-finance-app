'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAgentContext } from '@/contexts/agent-context';
import { AccessControl } from '@/components/access-control';
import { USER_ROLES } from '@/types/database';
import type { TTSEngine } from '@/types/agent';

export function AgentTTSToggle() {
  const { voiceEnabled, toggleVoice, ttsEngine, setTTSEngine } = useAgentContext();

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleVoice}
        className="rounded-full w-8 h-8"
        aria-label={voiceEnabled ? 'Desactivar voz' : 'Activar voz'}
      >
        {voiceEnabled ? (
          <Volume2 className="w-4 h-4 text-emerald-500" />
        ) : (
          <VolumeX className="w-4 h-4 text-gray-400" />
        )}
      </Button>

      <AccessControl allowedRoles={[USER_ROLES.ADMIN]}>
        <select
          value={ttsEngine}
          onChange={(e) => setTTSEngine(e.target.value as TTSEngine)}
          className="text-xs bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-1 border-0"
          aria-label="Motor de voz"
        >
          <option value="genai">GenAI</option>
          <option value="browser">Browser</option>
        </select>
      </AccessControl>
    </div>
  );
}
