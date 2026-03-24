import { AgentAction } from '@/types/agent';
import type { AgentActionType, AgentStrategy } from '@/types/agent';
import { addTransactionStrategy } from './add-transaction';
import { createSavingsGoalStrategy } from './create-savings-goal';
import { creditPurchaseStrategy } from './credit-purchase';
import { createInvestmentStrategy } from './create-investment';
import { dollarRateStrategy } from './dollar-rate';
import { marketQueryStrategy } from './market-query';
import { generalQuestionStrategy } from './general-question';
import { dataQueryParamStrategy } from './data-query';
import { scanReceiptStrategy } from './scan-receipt';
import { savingsDepositStrategy } from './savings-deposit';
import { deleteTransactionStrategy } from './delete-transaction';

const strategyRegistry: Record<AgentActionType, AgentStrategy> = {
  [AgentAction.ADD_EXPENSE]: addTransactionStrategy,
  [AgentAction.ADD_INCOME]: addTransactionStrategy,
  [AgentAction.CREATE_SAVINGS_GOAL]: createSavingsGoalStrategy,
  [AgentAction.CREDIT_PURCHASE]: creditPurchaseStrategy,
  [AgentAction.CREATE_INVESTMENT]: createInvestmentStrategy,
  [AgentAction.DOLLAR_RATE]: dollarRateStrategy,
  [AgentAction.MARKET_QUERY]: marketQueryStrategy,
  [AgentAction.GENERAL_QUESTION]: generalQuestionStrategy,
  [AgentAction.DATA_QUERY]: dataQueryParamStrategy,
  [AgentAction.SCAN_RECEIPT]: scanReceiptStrategy,
  [AgentAction.SAVINGS_DEPOSIT]: savingsDepositStrategy,
  [AgentAction.DELETE_TRANSACTION]: deleteTransactionStrategy,
  // Clarification is handled before strategy execution; this entry satisfies the Record type
  [AgentAction.CLARIFICATION]: generalQuestionStrategy,
};

export function getStrategy(action: AgentActionType): AgentStrategy {
  return strategyRegistry[action];
}
