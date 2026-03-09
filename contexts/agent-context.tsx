'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { AgentAction } from '@/types/agent';
import type {
  AgentActionType,
  AgentStatus,
  AgentMessage,
  AgentPayload,
  AgentClarificationPayload,
  AddTransactionPayload,
  CreateSavingsGoalPayload,
  CreditPurchasePayload,
  CreateInvestmentPayload,
  ConversationMessage,
} from '@/types/agent';
import type { Transaction, ExpensePlan, CreditPurchase, CreditInstallment, Investment } from '@/types/database';
import { classifyIntent, executeStrategy } from '@/lib/agent/agent-service';
import { createTTSService } from '@/lib/agent/tts/tts-service';
import type { TTSService } from '@/lib/agent/tts/tts-service';
import { useAuth } from '@/contexts/auth-context';
import * as api from '@/lib/database-api';

interface AgentContextType {
  isOpen: boolean;
  status: AgentStatus;
  messages: AgentMessage[];
  pendingPayload: AgentPayload | null;
  voiceEnabled: boolean;
  isSpeaking: boolean;
  sendTranscription: (text: string) => Promise<void>;
  confirmAction: () => Promise<void>;
  cancelAction: () => void;
  toggleDrawer: () => void;
  toggleVoice: () => void;
  setOnActionCompleted: (callback: () => void) => void;
}

const AgentContext = createContext<AgentContextType | null>(null);

interface AgentProviderProps {
  children: React.ReactNode;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Actions that require DB writes and confirmation
const DB_ACTIONS: Set<AgentActionType> = new Set([
  AgentAction.ADD_EXPENSE,
  AgentAction.ADD_INCOME,
  AgentAction.CREATE_SAVINGS_GOAL,
  AgentAction.CREDIT_PURCHASE,
  AgentAction.CREATE_INVESTMENT,
]);

export function AgentProvider({ children }: AgentProviderProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [pendingPayload, setPendingPayload] = useState<AgentPayload | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const onActionCompletedRef = useRef<(() => void) | null>(null);
  const ttsServiceRef = useRef<TTSService | null>(null);

  const getTTSService = useCallback((): TTSService => {
    if (!ttsServiceRef.current) {
      ttsServiceRef.current = createTTSService({
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
      });
    }
    return ttsServiceRef.current;
  }, []);

  const speakIfEnabled = useCallback((text: string) => {
    if (voiceEnabled) {
      const service = getTTSService();
      service.speak(text);
    }
  }, [voiceEnabled, getTTSService]);

  const addMessage = useCallback((role: 'user' | 'assistant', content: string, payload?: AgentPayload) => {
    const message: AgentMessage = {
      id: generateId(),
      role,
      content,
      payload,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, message]);
    return message;
  }, []);

  const sendTranscription = useCallback(async (text: string) => {
    addMessage('user', text);
    setStatus('classifying');

    // Build recent conversation history for multi-turn context
    const recentHistory: ConversationMessage[] = messages
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      // Step 1: Classify intent (with conversation history)
      const classification = await classifyIntent(text, recentHistory);
      setStatus('executing');

      // Step 2: Execute strategy (with conversation history)
      const result = await executeStrategy(classification.action, text, recentHistory);

      // Step 3: Handle result based on action type
      if (result.payload.action === AgentAction.CLARIFICATION) {
        // Clarification needed - add as assistant message and wait for user input
        const clarification = result.payload as AgentClarificationPayload;
        addMessage('assistant', clarification.question);
        speakIfEnabled(clarification.question);
        setStatus('idle');
      } else if (DB_ACTIONS.has(classification.action)) {
        // Needs confirmation
        setPendingPayload(result.payload);
        addMessage('assistant', result.message, result.payload);
        setStatus('confirming');
        speakIfEnabled(result.message + '. ¿Querés confirmar?');
      } else {
        // Display-only (dollar rate, market query, general question)
        addMessage('assistant', result.message, result.payload);
        setStatus('done');

        if (classification.action === 'general_question' || classification.action === 'market_query') {
          speakIfEnabled((result.payload as { answer: string }).answer);
        } else {
          speakIfEnabled(result.message);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error procesando tu solicitud';
      addMessage('assistant', errorMessage);
      setStatus('error');
    }
  }, [addMessage, speakIfEnabled, messages]);

  const confirmAction = useCallback(async () => {
    if (!pendingPayload || !user) return;

    try {
      setStatus('executing');

      switch (pendingPayload.action) {
        case AgentAction.ADD_EXPENSE:
        case AgentAction.ADD_INCOME: {
          const p = pendingPayload as AddTransactionPayload;
          const transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'> = {
            user_id: user.id,
            type: p.type,
            amount: p.amount,
            category: p.category,
            description: p.description,
            date: p.date,
            is_recurring: null,
            installments: null,
            current_installment: null,
            paid: null,
            parent_transaction_id: null,
            due_date: null,
            balance_total: null,
            ticket_id: null,
          };
          await api.addTransaction(transaction);
          break;
        }

        case AgentAction.CREATE_SAVINGS_GOAL: {
          const p = pendingPayload as CreateSavingsGoalPayload;
          const plan: Omit<ExpensePlan, 'id' | 'deleted_at' | 'created_at' | 'updated_at'> = {
            user_id: user.id,
            name: p.name,
            target_amount: p.targetAmount,
            current_amount: 0,
            deadline: p.deadline,
            category: p.category,
          };
          await api.addExpensePlan(plan);
          break;
        }

        case AgentAction.CREDIT_PURCHASE: {
          const p = pendingPayload as CreditPurchasePayload;
          const monthlyAmount = Math.ceil((p.totalAmount / p.installments) * 100) / 100;

          const purchase: Omit<CreditPurchase, 'id' | 'created_at' | 'updated_at'> = {
            user_id: user.id,
            description: p.description,
            category: p.category,
            total_amount: p.totalAmount,
            installments: p.installments,
            monthly_amount: monthlyAmount,
            start_date: p.startDate,
          };

          const installments: Omit<CreditInstallment, 'id' | 'credit_purchase_id' | 'created_at' | 'updated_at'>[] = [];
          const startDate = new Date(p.startDate);

          for (let i = 0; i < p.installments; i++) {
            const dueDate = new Date(startDate);
            dueDate.setMonth(dueDate.getMonth() + i);

            installments.push({
              installment_number: i + 1,
              due_date: dueDate.toISOString().split('T')[0],
              amount: monthlyAmount,
              paid: false,
              paid_date: null,
              transaction_id: null,
            });
          }

          await api.createCreditPurchase(purchase, installments);
          break;
        }

        case AgentAction.CREATE_INVESTMENT: {
          const p = pendingPayload as CreateInvestmentPayload;
          const investment: Omit<Investment, 'id' | 'created_at' | 'updated_at'> = {
            user_id: user.id,
            investment_type: p.investmentType,
            amount: p.amount,
            description: p.description,
            start_date: p.startDate,
            maturity_date: null,
            annual_rate: null,
            estimated_return: 0,
            is_liquidated: false,
            liquidation_date: null,
            actual_return: null,
            transaction_id: null,
            currency: null,
            exchange_rate: null,
          };
          await api.createInvestment(investment);
          break;
        }
      }

      addMessage('assistant', 'Listo, se registró correctamente.');
      speakIfEnabled('Listo, se registró correctamente.');
      setPendingPayload(null);
      setStatus('done');

      // Refresh data in page
      onActionCompletedRef.current?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al confirmar la acción';
      addMessage('assistant', errorMessage);
      setStatus('error');
      setPendingPayload(null);
    }
  }, [pendingPayload, user, addMessage, speakIfEnabled]);

  const cancelAction = useCallback(() => {
    setPendingPayload(null);
    addMessage('assistant', 'Acción cancelada.');
    setStatus('idle');
  }, [addMessage]);

  const toggleDrawer = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      if (prev && ttsServiceRef.current) {
        ttsServiceRef.current.stop();
      }
      return !prev;
    });
  }, []);

  const setOnActionCompleted = useCallback((callback: () => void) => {
    onActionCompletedRef.current = callback;
  }, []);

  const value = useMemo<AgentContextType>(() => ({
    isOpen,
    status,
    messages,
    pendingPayload,
    voiceEnabled,
    isSpeaking,
    sendTranscription,
    confirmAction,
    cancelAction,
    toggleDrawer,
    toggleVoice,
    setOnActionCompleted,
  }), [
    isOpen, status, messages, pendingPayload, voiceEnabled, isSpeaking,
    sendTranscription, confirmAction, cancelAction, toggleDrawer, toggleVoice,
    setOnActionCompleted,
  ]);

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgentContext(): AgentContextType {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgentContext must be used within an AgentProvider');
  }
  return context;
}
