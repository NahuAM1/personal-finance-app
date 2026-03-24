'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
  ScanReceiptPayload,
  ConversationMessage,
} from '@/types/agent';
import type { Transaction, ExpensePlan, CreditPurchase, CreditInstallment, Investment } from '@/types/database';
import type { SavingsDepositPayload, DeleteTransactionPayload } from '@/types/agent';
import { classifyIntent, executeStrategy, fetchPostConfirmMessage, fetchWelcomeMessage } from '@/lib/agent/agent-service';
import { createTTSService } from '@/lib/agent/tts/tts-service';
import type { TTSService } from '@/lib/agent/tts/tts-service';
import { useAuth } from '@/contexts/auth-context';
import * as api from '@/lib/database-api';

interface ScanCompleteData {
  storeName: string;
  totalAmount: number;
  ticketDate: string;
  ticketId: string;
  notes: string | null;
  imagePreview: string;
}

interface SessionPreferences {
  lastUsedCategories: string[];
  frequentDescriptions: string[];
}

interface AgentContextType {
  isOpen: boolean;
  status: AgentStatus;
  messages: AgentMessage[];
  pendingPayload: AgentPayload | null;
  pendingImagePreview: string | null;
  voiceEnabled: boolean;
  isSpeaking: boolean;
  scannerActive: boolean;
  sendTranscription: (text: string) => Promise<void>;
  confirmAction: () => Promise<void>;
  cancelAction: () => void;
  toggleDrawer: () => void;
  toggleVoice: () => void;
  setOnActionCompleted: (callback: () => void) => void;
  onScanComplete: (data: ScanCompleteData) => void;
  onScanCancel: () => void;
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
  AgentAction.SAVINGS_DEPOSIT,
  AgentAction.DELETE_TRANSACTION,
]);

// Actions that are display-only (no confirmation needed)
const DISPLAY_ACTIONS: Set<AgentActionType> = new Set([
  AgentAction.GENERAL_QUESTION,
  AgentAction.MARKET_QUERY,
  AgentAction.DOLLAR_RATE,
  AgentAction.DATA_QUERY,
]);

export function AgentProvider({ children }: AgentProviderProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [pendingPayload, setPendingPayload] = useState<AgentPayload | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [pendingSequenceCount, setPendingSequenceCount] = useState(0);

  // Clear conversation and state on sign out
  useEffect(() => {
    if (!user) {
      setIsOpen(false);
      setStatus('idle');
      setMessages([]);
      setPendingPayload(null);
      setPendingImagePreview(null);
      setScannerActive(false);
      setPendingSequenceCount(0);
      welcomeSentRef.current = false;
      if (ttsServiceRef.current) {
        ttsServiceRef.current.stop();
      }
    }
  }, [user]);

  const onActionCompletedRef = useRef<(() => void) | null>(null);
  const ttsServiceRef = useRef<TTSService | null>(null);
  const welcomeSentRef = useRef(false);
  const sessionPrefsRef = useRef<SessionPreferences>({
    lastUsedCategories: [],
    frequentDescriptions: [],
  });

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

  const buildFollowUpSuggestion = useCallback((payload: AgentPayload): string | null => {
    if (payload.action === AgentAction.ADD_EXPENSE) {
      const p = payload as AddTransactionPayload;
      const suggestions: Record<string, string> = {
        'Compras': '¿Querés ver cuánto llevás en Compras este mes?',
        'Delivery': '¿Querés comparar cuánto gastaste en Delivery este mes versus el anterior?',
        'Salidas': '¿Te gustaría ver tu resumen de entretenimiento del mes?',
        'Auto': '¿Querés ver el total de gastos en Auto este mes?',
        'Servicios': '¿Querés revisar tus gastos fijos este mes?',
      };
      return suggestions[p.category] ?? '¿Querés ver el resumen de gastos del mes?';
    }
    if (payload.action === AgentAction.ADD_INCOME) {
      return '¿Querés ver tu balance total del mes?';
    }
    if (payload.action === AgentAction.CREATE_SAVINGS_GOAL) {
      return '¿Querés ver el progreso de todas tus metas de ahorro?';
    }
    if (payload.action === AgentAction.CREDIT_PURCHASE) {
      return '¿Querés ver el resumen de tus cuotas pendientes?';
    }
    if (payload.action === AgentAction.CREATE_INVESTMENT) {
      return '¿Querés ver el estado de tu portfolio de inversiones?';
    }
    return null;
  }, []);

  const updateSessionPreferences = useCallback((payload: AgentPayload) => {
    const prefs = sessionPrefsRef.current;

    if ('category' in payload && typeof payload.category === 'string') {
      prefs.lastUsedCategories = [
        payload.category,
        ...prefs.lastUsedCategories.filter(c => c !== payload.category),
      ].slice(0, 3);
    }

    if ('description' in payload && typeof payload.description === 'string') {
      prefs.frequentDescriptions = [
        payload.description,
        ...prefs.frequentDescriptions.filter(d => d !== payload.description),
      ].slice(0, 5);
    }
  }, []);

  const sendTranscription = useCallback(async (text: string) => {
    addMessage('user', text);
    setStatus('classifying');

    // Check for multi-step intent (e.g., "agregar 3 gastos")
    const multiStepMatch = text.match(/(?:agregar|cargar|registrar)\s+(\d+)\s+(?:gastos?|ingresos?|transacciones?)/i);
    if (multiStepMatch) {
      const count = parseInt(multiStepMatch[1], 10);
      if (count > 1 && count <= 10) {
        setPendingSequenceCount(count);
      }
    }

    // Build recent conversation history for multi-turn context
    const recentHistory: ConversationMessage[] = messages
      .slice(-10)
      .map(m => {
        if (m.role === 'assistant' && m.payload) {
          const actionContext =
            m.payload.action === AgentAction.CLARIFICATION
              ? `[Acción en curso: ${(m.payload as AgentClarificationPayload).originalAction}]`
              : `[Acción realizada: ${m.payload.action}]`;
          return { role: m.role, content: `${actionContext} ${m.content}` };
        }
        return { role: m.role, content: m.content };
      });

    try {
      // Step 1: Classify intent (with conversation history)
      const classification = await classifyIntent(text, recentHistory);
      setStatus('executing');

      // Step 2: Execute strategy (with conversation history)
      const result = await executeStrategy(classification.action, text, recentHistory);

      // Step 3: Handle result based on action type
      if (result.payload.action === AgentAction.CLARIFICATION) {
        const clarification = result.payload as AgentClarificationPayload;
        let clarificationMessage = clarification.question;
        if (clarification.partialData) {
          const parts: string[] = [];
          if (clarification.partialData.amount !== undefined) {
            parts.push(`monto: $${clarification.partialData.amount.toLocaleString('es-AR')}`);
          }
          if (clarification.partialData.category !== undefined) {
            parts.push(`categoría: ${clarification.partialData.category}`);
          }
          if (clarification.partialData.transactionType !== undefined) {
            parts.push(clarification.partialData.transactionType === 'income' ? 'tipo: ingreso' : 'tipo: gasto');
          }
          if (parts.length > 0) {
            clarificationMessage = `Entiendo que querés registrar un ${parts.join(', ')}. ${clarification.question}`;
          }
        }
        addMessage('assistant', clarificationMessage);
        speakIfEnabled(clarificationMessage);
        setStatus('idle');
      } else if (result.payload.action === AgentAction.SCAN_RECEIPT) {
        // Scan receipt - activate scanner UI
        addMessage('assistant', 'Abriendo el scanner de tickets...');
        speakIfEnabled('Abriendo el scanner de tickets');
        setScannerActive(true);
        setStatus('scanning');
      } else if (DB_ACTIONS.has(classification.action)) {
        // Needs confirmation
        setPendingPayload(result.payload);
        addMessage('assistant', result.message, result.payload);
        setStatus('confirming');
        speakIfEnabled(result.message + '. ¿Querés confirmar?');
      } else if (DISPLAY_ACTIONS.has(classification.action)) {
        // Display-only (dollar rate, market query, general question, data query)
        addMessage('assistant', result.message, result.payload);
        setStatus('done');

        if (classification.action === 'general_question' || classification.action === 'market_query' || classification.action === 'data_query') {
          speakIfEnabled((result.payload as { answer: string }).answer);
        } else {
          speakIfEnabled(result.message);
        }
      } else {
        // Fallback for any other action
        addMessage('assistant', result.message, result.payload);
        setStatus('done');
        speakIfEnabled(result.message);
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
      const savedPayload = pendingPayload;

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
          updateSessionPreferences(pendingPayload);
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
          updateSessionPreferences(pendingPayload);
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

        case AgentAction.SAVINGS_DEPOSIT: {
          const p = pendingPayload as SavingsDepositPayload;
          await api.updateExpensePlan(p.goalId, { current_amount: p.newTotal });
          break;
        }

        case AgentAction.DELETE_TRANSACTION: {
          const p = pendingPayload as DeleteTransactionPayload;
          await api.deleteTransaction(p.transactionId, user.id);
          break;
        }
      }

      // Fetch contextual post-confirmation message
      const confirmationMessage = await fetchPostConfirmMessage(savedPayload.action, savedPayload).catch(
        () => 'Listo, se registró correctamente.',
      );
      addMessage('assistant', confirmationMessage);
      speakIfEnabled(confirmationMessage);

      // Follow-up suggestion after confirmation
      setTimeout(() => {
        const suggestion = buildFollowUpSuggestion(savedPayload);
        if (suggestion) addMessage('assistant', suggestion);
      }, 800);

      setPendingPayload(null);
      setPendingImagePreview(null);
      setStatus('done');

      // Refresh data in page
      onActionCompletedRef.current?.();

      // Multi-step sequence handling
      if (pendingSequenceCount > 1) {
        setPendingSequenceCount(prev => prev - 1);
        setTimeout(() => {
          addMessage('assistant', `¿Cuál es el siguiente? (quedan ${pendingSequenceCount - 1})`);
          speakIfEnabled(`¿Cuál es el siguiente? Quedan ${pendingSequenceCount - 1}`);
          setStatus('idle');
        }, 500);
      } else if (pendingSequenceCount === 1) {
        setPendingSequenceCount(0);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al confirmar la acción';
      addMessage('assistant', errorMessage);
      setStatus('error');
      setPendingPayload(null);
      setPendingImagePreview(null);
    }
  }, [pendingPayload, user, addMessage, speakIfEnabled, updateSessionPreferences, pendingSequenceCount, buildFollowUpSuggestion]);

  const cancelAction = useCallback(() => {
    setPendingPayload(null);
    setPendingImagePreview(null);
    setPendingSequenceCount(0);
    addMessage('assistant', 'Acción cancelada.');
    setStatus('idle');
  }, [addMessage]);

  const onScanComplete = useCallback((data: ScanCompleteData) => {
    setScannerActive(false);

    addMessage('assistant', `Ticket de ${data.storeName} por $${data.totalAmount.toLocaleString('es-AR')} escaneado. ¿Querés registrarlo como gasto?`);
    speakIfEnabled(`Ticket de ${data.storeName} por ${data.totalAmount} pesos escaneado. ¿Querés registrarlo como gasto?`);

    // Pre-populate an add_expense payload with ticket data
    const expensePayload: AddTransactionPayload = {
      action: AgentAction.ADD_EXPENSE,
      type: 'expense',
      amount: data.totalAmount,
      category: 'Compras',
      description: data.notes ? `${data.storeName}: ${data.notes}` : `Compra en ${data.storeName}`,
      date: data.ticketDate,
    };

    setPendingImagePreview(data.imagePreview);
    setPendingPayload(expensePayload);
    setStatus('confirming');
  }, [addMessage, speakIfEnabled]);

  const onScanCancel = useCallback(() => {
    setScannerActive(false);
    addMessage('assistant', 'Scanner cerrado.');
    setStatus('idle');
  }, [addMessage]);

  const toggleDrawer = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Send personalized welcome the first time the drawer opens
  useEffect(() => {
    if (isOpen && messages.length === 0 && !welcomeSentRef.current) {
      welcomeSentRef.current = true;
      fetchWelcomeMessage().then(msg => {
        addMessage('assistant', msg);
      }).catch(() => {
        addMessage('assistant', '¿En qué te puedo ayudar?');
      });
    }
  }, [isOpen, messages.length, addMessage]);

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
    pendingImagePreview,
    voiceEnabled,
    isSpeaking,
    scannerActive,
    sendTranscription,
    confirmAction,
    cancelAction,
    toggleDrawer,
    toggleVoice,
    setOnActionCompleted,
    onScanComplete,
    onScanCancel,
  }), [
    isOpen, status, messages, pendingPayload, pendingImagePreview, voiceEnabled, isSpeaking, scannerActive,
    sendTranscription, confirmAction, cancelAction, toggleDrawer, toggleVoice,
    setOnActionCompleted, onScanComplete, onScanCancel,
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
