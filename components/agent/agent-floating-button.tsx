'use client';

import Image from 'next/image';
import SmartPocketLogo from '@/assets/images/smartPocketLogo.svg';
import { useAgentContext } from '@/contexts/agent-context';
import { AccessControl } from '@/components/access-control';
import { USER_ROLES } from '@/types/database';
import { AgentDrawer } from './agent-drawer';
import './agent-floating-button.css';

export function AgentFloatingButton() {
  const { toggleDrawer, isOpen } = useAgentContext();

  return (
    <AccessControl allowedRoles={[USER_ROLES.PREMIUM]}>
      <button
        onClick={toggleDrawer}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-500/30 flex items-center justify-center hover:shadow-xl hover:shadow-purple-500/40 transition-shadow duration-200 ${
          isOpen ? 'scale-0 opacity-0' : 'breathing-button'
        }`}
        aria-label="Abrir SmartPocket AI"
      >
        <Image
          src={SmartPocketLogo}
          alt="SmartPocket"
          width={32}
          height={32}
          className="brightness-0 invert"
        />
      </button>

      <AgentDrawer />
    </AccessControl>
  );
}
