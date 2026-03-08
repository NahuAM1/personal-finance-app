'use client';

import { useEffect, useRef } from 'react';
import type { AgentMessage } from '@/types/agent';
import { DollarRateDisplay } from './confirmation-modals/dollar-rate-display';

interface AgentMessageListProps {
  messages: AgentMessage[];
}

export function AgentMessageList({ messages }: AgentMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm p-4">
        Hola, soy SmartPocket. ¿En qué puedo ayudarte?
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map(message => (
        <div
          key={message.id}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              message.role === 'user'
                ? 'bg-emerald-500 text-white rounded-br-md'
                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-md shadow-sm border border-gray-100 dark:border-gray-700'
            }`}
          >
            <p>{message.content}</p>

            {/* Structured inline display only for dollar_rate (rates grid) */}
            {message.payload?.action === 'dollar_rate' && (
              <div className="mt-2">
                <DollarRateDisplay payload={message.payload} />
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
