import type { Investment } from "@/types/database";

// --- Action enum ---
export const AgentAction = {
  ADD_EXPENSE: "add_expense",
  ADD_INCOME: "add_income",
  CREATE_SAVINGS_GOAL: "create_savings_goal",
  CREDIT_PURCHASE: "credit_purchase",
  CREATE_INVESTMENT: "create_investment",
  DOLLAR_RATE: "dollar_rate",
  MARKET_QUERY: "market_query",
  GENERAL_QUESTION: "general_question",
  DATA_QUERY: "data_query",
  SCAN_RECEIPT: "scan_receipt",
  CLARIFICATION: "clarification",
  SAVINGS_DEPOSIT: "savings_deposit",
  DELETE_TRANSACTION: "delete_transaction",
} as const;

export type AgentActionType = (typeof AgentAction)[keyof typeof AgentAction];

// --- Status ---
export type AgentStatus =
  | "idle"
  | "listening"
  | "classifying"
  | "executing"
  | "confirming"
  | "scanning"
  | "done"
  | "error";

// --- Payloads (discriminated union) ---
export interface AddTransactionPayload {
  action: typeof AgentAction.ADD_EXPENSE | typeof AgentAction.ADD_INCOME;
  type: "income" | "expense";
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
  investmentType: Investment["investment_type"];
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

export interface DataQueryPayload {
  action: typeof AgentAction.DATA_QUERY;
  answer: string;
}

export interface ScanReceiptPayload {
  action: typeof AgentAction.SCAN_RECEIPT;
  triggerScanner: true;
}

export interface AgentClarificationPayload {
  action: typeof AgentAction.CLARIFICATION;
  question: string;
  originalAction: AgentActionType;
  partialData?: {
    amount?: number;
    category?: string;
    transactionType?: "income" | "expense";
  };
}

export interface SavingsDepositPayload {
  action: typeof AgentAction.SAVINGS_DEPOSIT;
  goalId: string;
  goalName: string;
  depositAmount: number;
  newTotal: number;
  progressPercent: number;
}

export interface DeleteTransactionPayload {
  action: typeof AgentAction.DELETE_TRANSACTION;
  transactionId: string;
  description: string;
  amount: number;
  transactionType: "income" | "expense";
  category: string;
  date: string;
}

// Internal params used only in route.ts for data_query two-pass flow
export interface DataQueryParams {
  dateFrom: string;
  dateTo: string;
  transactionType: "income" | "expense" | "credit" | "all";
  category: string;
  comparisonDateFrom: string | null;
  comparisonDateTo: string | null;
  dataScope: "transactions" | "investments" | "credit_purchases" | "savings_goals" | "all";
  queryIntent: "sum" | "list" | "compare" | "trend" | "detail";
}

export type AgentPayload =
  | AddTransactionPayload
  | CreateSavingsGoalPayload
  | CreditPurchasePayload
  | CreateInvestmentPayload
  | DollarRatePayload
  | MarketQueryPayload
  | GeneralQuestionPayload
  | DataQueryPayload
  | ScanReceiptPayload
  | AgentClarificationPayload
  | SavingsDepositPayload
  | DeleteTransactionPayload;

// --- Conversation History (for multi-turn) ---
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

// --- Messages ---
export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
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
  buildPrompt: (
    transcription: string,
    context?: string,
    conversationHistory?: ConversationMessage[],
  ) => string;
  parseResponse: (raw: string) => AgentPayload;
  needsUserData?: boolean;
  needsMarketData?: boolean;
}

// --- API Types ---
export interface AgentClassifyRequest {
  transcription: string;
  step: "classify";
  conversationHistory?: ConversationMessage[];
}

export interface AgentExecuteRequest {
  transcription: string;
  step: "execute";
  action: AgentActionType;
  conversationHistory?: ConversationMessage[];
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
