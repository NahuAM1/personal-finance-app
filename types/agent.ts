import type { Investment } from '@/types/database';

// --- Action enum ---
export const AgentAction = {
  ADD_EXPENSE: 'add_expense',
  ADD_INCOME: 'add_income',
  CREATE_SAVINGS_GOAL: 'create_savings_goal',
  CREDIT_PURCHASE: 'credit_purchase',
  CREATE_INVESTMENT: 'create_investment',
  DOLLAR_RATE: 'dollar_rate',
  MARKET_QUERY: 'market_query',
  GENERAL_QUESTION: 'general_question',
} as const;

export type AgentActionType = typeof AgentAction[keyof typeof AgentAction];

// --- Status ---
export type AgentStatus = 'idle' | 'listening' | 'classifying' | 'executing' | 'confirming' | 'done' | 'error';

// --- TTS ---
export type TTSEngine = 'genai' | 'browser';

// --- Payloads (discriminated union) ---
export interface AddTransactionPayload {
  action: typeof AgentAction.ADD_EXPENSE | typeof AgentAction.ADD_INCOME;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string;
}

export interface CreateSavingsGoalPayload {
  action: typeof AgentAction.CREATE_SAVINGS_GOAL;
  name: string;
  targetAmount: number;
  deadline: string;
  category: string;
}

export interface CreditPurchasePayload {
  action: typeof AgentAction.CREDIT_PURCHASE;
  description: string;
  category: string;
  totalAmount: number;
  installments: number;
  startDate: string;
}

export interface CreateInvestmentPayload {
  action: typeof AgentAction.CREATE_INVESTMENT;
  investmentType: Investment['investment_type'];
  amount: number;
  description: string;
  startDate: string;
}

export interface DollarRateEntry {
  nombre: string;
  compra: number;
  venta: number;
  casa: string;
}

export interface DollarRatePayload {
  action: typeof AgentAction.DOLLAR_RATE;
  rates: DollarRateEntry[];
}

export interface MarketQueryPayload {
  action: typeof AgentAction.MARKET_QUERY;
  answer: string;
}

export interface GeneralQuestionPayload {
  action: typeof AgentAction.GENERAL_QUESTION;
  answer: string;
}

export type AgentPayload =
  | AddTransactionPayload
  | CreateSavingsGoalPayload
  | CreditPurchasePayload
  | CreateInvestmentPayload
  | DollarRatePayload
  | MarketQueryPayload
  | GeneralQuestionPayload;

// --- Messages ---
export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  payload?: AgentPayload;
  timestamp: Date;
}

// --- Classification ---
export interface AgentClassification {
  action: AgentActionType;
  confidence: number;
}

// --- Strategy ---
export interface AgentStrategy {
  buildPrompt: (transcription: string, context?: string) => string;
  parseResponse: (raw: string) => AgentPayload;
  needsUserData?: boolean;
  needsMarketData?: boolean;
}

// --- API Types ---
export interface AgentClassifyRequest {
  transcription: string;
  step: 'classify';
}

export interface AgentExecuteRequest {
  transcription: string;
  step: 'execute';
  action: AgentActionType;
}

export type AgentApiRequest = AgentClassifyRequest | AgentExecuteRequest;

export interface AgentClassifyResponse {
  action: AgentActionType;
  confidence: number;
}

export interface AgentExecuteResponse {
  payload: AgentPayload;
  message: string;
}

export interface AgentTTSRequest {
  text: string;
}

export interface AgentTTSResponse {
  audio: string;
  mimeType: string;
}
