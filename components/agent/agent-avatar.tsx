'use client';

import Image from 'next/image';
import SmartPocketLogo from '@/assets/images/smartPocketLogo.svg';

interface AgentAvatarProps {
  isSpeaking: boolean;
  size?: number;
}

export function AgentAvatar({ isSpeaking, size = 64 }: AgentAvatarProps) {
  return (
    <div
      className={`rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg ${
        isSpeaking ? 'animate-agent-pulse' : ''
      }`}
      style={{ width: size, height: size }}
    >
      <Image
        src={SmartPocketLogo}
        alt="SmartPocket Agent"
        width={size * 0.6}
        height={size * 0.6}
        className="brightness-0 invert"
      />
    </div>
  );
}
