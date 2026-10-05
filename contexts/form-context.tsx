'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { emptyMoneyInput, type MoneyInputState } from '@/lib/currency/money-input';

// Amount, currency and rate live together so the forms can hand them to AmountWithCurrencyInput.
interface FormData extends MoneyInputState {
  category: string;
  description: string;
}

interface FormContextType {
  incomeForm: FormData;
  expenseForm: FormData;
  setIncomeAmount: (amount: string) => void;
  setIncomeMoney: (money: MoneyInputState) => void;
  setIncomeCategory: (category: string) => void;
  setIncomeDescription: (description: string) => void;
  setExpenseAmount: (amount: string) => void;
  setExpenseMoney: (money: MoneyInputState) => void;
  setExpenseCategory: (category: string) => void;
  setExpenseDescription: (description: string) => void;
  resetIncomeForm: () => void;
  resetExpenseForm: () => void;
}

const FormContext = createContext<FormContextType | undefined>(undefined);

export const useFormContext = () => {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error('useFormContext must be used within a FormProvider');
  }
  return context;
};

interface FormProviderProps {
  children: ReactNode;
}

// Forms hand over their whole state object: keep only the money fields.
const pickMoney = (m: MoneyInputState): MoneyInputState => ({
  amount: m.amount,
  currency: m.currency,
  rate: m.rate,
  rateSource: m.rateSource,
});

const emptyForm = (): FormData => ({
  ...emptyMoneyInput(),
  category: '',
  description: '',
});

export const FormProvider: React.FC<FormProviderProps> = ({ children }) => {
  const [incomeForm, setIncomeForm] = useState<FormData>(emptyForm);
  const [expenseForm, setExpenseForm] = useState<FormData>(emptyForm);

  const setIncomeAmount = (amount: string) => {
    setIncomeForm(prev => ({ ...prev, amount }));
  };

  const setIncomeMoney = (money: MoneyInputState) => {
    setIncomeForm(prev => ({ ...prev, ...pickMoney(money) }));
  };

  const setIncomeCategory = (category: string) => {
    setIncomeForm(prev => ({ ...prev, category }));
  };

  const setIncomeDescription = (description: string) => {
    setIncomeForm(prev => ({ ...prev, description }));
  };

  const setExpenseAmount = (amount: string) => {
    setExpenseForm(prev => ({ ...prev, amount }));
  };

  const setExpenseMoney = (money: MoneyInputState) => {
    setExpenseForm(prev => ({ ...prev, ...pickMoney(money) }));
  };

  const setExpenseCategory = (category: string) => {
    setExpenseForm(prev => ({ ...prev, category }));
  };

  const setExpenseDescription = (description: string) => {
    setExpenseForm(prev => ({ ...prev, description }));
  };

  const resetIncomeForm = () => {
    setIncomeForm(emptyForm());
  };

  const resetExpenseForm = () => {
    setExpenseForm(emptyForm());
  };

  const value: FormContextType = {
    incomeForm,
    expenseForm,
    setIncomeAmount,
    setIncomeMoney,
    setIncomeCategory,
    setIncomeDescription,
    setExpenseAmount,
    setExpenseMoney,
    setExpenseCategory,
    setExpenseDescription,
    resetIncomeForm,
    resetExpenseForm,
  };

  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
};
