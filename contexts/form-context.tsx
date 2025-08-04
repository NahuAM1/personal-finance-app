'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface FormData {
  amount: string;
  category: string;
  description: string;
}

interface FormContextType {
  incomeForm: FormData;
  expenseForm: FormData;
  setIncomeAmount: (amount: string) => void;
  setIncomeCategory: (category: string) => void;
  setIncomeDescription: (description: string) => void;
  setExpenseAmount: (amount: string) => void;
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

export const FormProvider: React.FC<FormProviderProps> = ({ children }) => {
  const [incomeForm, setIncomeForm] = useState<FormData>({
    amount: '',
    category: '',
    description: '',
  });

  const [expenseForm, setExpenseForm] = useState<FormData>({
    amount: '',
    category: '',
    description: '',
  });

  const setIncomeAmount = (amount: string) => {
    setIncomeForm(prev => ({ ...prev, amount }));
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

  const setExpenseCategory = (category: string) => {
    setExpenseForm(prev => ({ ...prev, category }));
  };

  const setExpenseDescription = (description: string) => {
    setExpenseForm(prev => ({ ...prev, description }));
  };

  const resetIncomeForm = () => {
    setIncomeForm({
      amount: '',
      category: '',
      description: '',
    });
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      amount: '',
      category: '',
      description: '',
    });
  };

  const value: FormContextType = {
    incomeForm,
    expenseForm,
    setIncomeAmount,
    setIncomeCategory,
    setIncomeDescription,
    setExpenseAmount,
    setExpenseCategory,
    setExpenseDescription,
    resetIncomeForm,
    resetExpenseForm,
  };

  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
};