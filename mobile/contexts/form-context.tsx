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

const FormContext = createContext<FormContextType | null>(null);

export const useFormContext = (): FormContextType => {
  const context = useContext(FormContext);
  if (!context) throw new Error('useFormContext must be used within a FormProvider');
  return context;
};

interface FormProviderProps {
  children: ReactNode;
}

const EMPTY: FormData = { amount: '', category: '', description: '' };

export const FormProvider: React.FC<FormProviderProps> = ({ children }) => {
  const [incomeForm, setIncomeForm] = useState<FormData>(EMPTY);
  const [expenseForm, setExpenseForm] = useState<FormData>(EMPTY);

  const value: FormContextType = {
    incomeForm,
    expenseForm,
    setIncomeAmount: (amount: string): void => setIncomeForm((prev) => ({ ...prev, amount })),
    setIncomeCategory: (category: string): void => setIncomeForm((prev) => ({ ...prev, category })),
    setIncomeDescription: (description: string): void => setIncomeForm((prev) => ({ ...prev, description })),
    setExpenseAmount: (amount: string): void => setExpenseForm((prev) => ({ ...prev, amount })),
    setExpenseCategory: (category: string): void => setExpenseForm((prev) => ({ ...prev, category })),
    setExpenseDescription: (description: string): void => setExpenseForm((prev) => ({ ...prev, description })),
    resetIncomeForm: (): void => setIncomeForm(EMPTY),
    resetExpenseForm: (): void => setExpenseForm(EMPTY),
  };

  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
};
