'use client';

import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAgentContext } from '@/contexts/agent-context';
import { AgentAvatar } from './agent-avatar';
import { AgentMicrophone } from './agent-microphone';
import { AgentMessageList } from './agent-message-list';
import { AgentTTSToggle } from './agent-tts-toggle';
import { ConfirmTransaction } from './confirmation-modals/confirm-transaction';
import { ConfirmSavingsGoal } from './confirmation-modals/confirm-savings-goal';
import { ConfirmCreditPurchase } from './confirmation-modals/confirm-credit-purchase';
import { ConfirmInvestment } from './confirmation-modals/confirm-investment';
import type {
  AddTransactionPayload,
  CreateSavingsGoalPayload,
  CreditPurchasePayload,
  CreateInvestmentPayload,
} from '@/types/agent';

export function AgentDrawer() {
  const {
    isOpen,
    status,
    messages,
    pendingPayload,
    isSpeaking,
    sendTranscription,
    confirmAction,
    cancelAction,
    toggleDrawer,
  } = useAgentContext();

  if (!isOpen) return null;

  const isProcessing = status === 'classifying' || status === 'executing';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={toggleDrawer}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed px-4 bottom-0 left-0 right-0 z-50 flex justify-center">
        <div className="w-full max-w-lg max-h-[85vh] bg-gray-50 dark:bg-gray-900 rounded-t-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <AgentAvatar isSpeaking={isSpeaking} size={40} />
              <div>
                <h2 className="font-semibold text-sm text-gray-900 dark:text-gray-100">SmartPocket AI</h2>
                <p className="text-xs text-gray-500">
                  {status === 'idle' && 'Listo para ayudarte'}
                  {status === 'listening' && 'Escuchando...'}
                  {status === 'classifying' && 'Analizando...'}
                  {status === 'executing' && 'Procesando...'}
                  {status === 'confirming' && 'Esperando confirmación'}
                  {status === 'done' && 'Completado'}
                  {status === 'error' && 'Ocurrió un error'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <AgentTTSToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDrawer}
                className="rounded-full w-8 h-8"
                aria-label="Cerrar agente"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <AgentMessageList messages={messages} />

            {/* Loading indicator */}
            {isProcessing && (
              <div className="flex justify-center py-2">
                <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
              </div>
            )}

            {/* Confirmation Card (overlay at bottom of messages) */}
            {status === 'confirming' && pendingPayload && (
              <div className="px-4 pb-2">
                {(pendingPayload.action === 'add_expense' || pendingPayload.action === 'add_income') && (
                  <ConfirmTransaction
                    payload={pendingPayload as AddTransactionPayload}
                    onConfirm={confirmAction}
                    onCancel={cancelAction}
                  />
                )}
                {pendingPayload.action === 'create_savings_goal' && (
                  <ConfirmSavingsGoal
                    payload={pendingPayload as CreateSavingsGoalPayload}
                    onConfirm={confirmAction}
                    onCancel={cancelAction}
                  />
                )}
                {pendingPayload.action === 'credit_purchase' && (
                  <ConfirmCreditPurchase
                    payload={pendingPayload as CreditPurchasePayload}
                    onConfirm={confirmAction}
                    onCancel={cancelAction}
                  />
                )}
                {pendingPayload.action === 'create_investment' && (
                  <ConfirmInvestment
                    payload={pendingPayload as CreateInvestmentPayload}
                    onConfirm={confirmAction}
                    onCancel={cancelAction}
                  />
                )}
              </div>
            )}
          </div>

          {/* Footer - Microphone */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <AgentMicrophone
              onTranscription={sendTranscription}
              disabled={isProcessing || status === 'confirming'}
            />
          </div>
        </div>
      </div>
    </>
  );
}
