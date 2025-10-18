'use client';

import { useCallback, useState } from 'react';
import { getCurrentDateISO } from '@/lib/utils/dateUtils';
import type { BulkExpenseRowData } from '@/lib/validations/expenses';

function createEmptyRow(): BulkExpenseRowData {
  return {
    amount: 0,
    description: '',
    notes: '',
    category_id: '',
    expense_date: getCurrentDateISO(),
    expense_time: '',
    city: '',
    city_id: null,
    tempId: crypto.randomUUID(),
  };
}

export function useBulkExpenseState() {
  const [expenses, setExpenses] = useState<BulkExpenseRowData[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  const toggleShowErrorsOnly = useCallback(() => {
    setShowErrorsOnly(prev => !prev);
  }, []);

  const addRow = useCallback((count = 1) => {
    const newRows = Array.from({ length: count }, createEmptyRow);
    setExpenses(prev => [...prev, ...newRows]);
  }, []);

  const removeRow = useCallback((tempId: string) => {
    setExpenses(prev => prev.filter(expense => expense.tempId !== tempId));
    setValidationErrors(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        if (key.startsWith(`${tempId}-`)) {
          delete next[key];
        }
      });
      return next;
    });
  }, []);

  const validateSingleExpense = useCallback((expense: BulkExpenseRowData) => {
    const errors: Record<string, string> = {};
    const prefix = expense.tempId || '';

    if (!expense.amount || expense.amount <= 0) {
      errors[`${prefix}-amount`] = 'Сумма должна быть больше 0';
    }

    if (!expense.description?.trim()) {
      errors[`${prefix}-description`] = 'Описание обязательно';
    }

    if (!expense.expense_date) {
      errors[`${prefix}-expense_date`] = 'Дата обязательна';
    }

    if (expense.expense_time && expense.expense_time.trim()) {
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(expense.expense_time.trim())) {
        errors[`${prefix}-expense_time`] = 'Время должно быть в формате ЧЧ:ММ';
      }
    }

    return errors;
  }, []);

  const updateRow = useCallback(<K extends keyof BulkExpenseRowData>(tempId: string, field: K, value: BulkExpenseRowData[K]) => {
    let updatedExpense: BulkExpenseRowData | null = null;
    
    // Обновляем данные сразу
    setExpenses(prev =>
      prev.map(expense => {
        if (expense.tempId === tempId) {
          updatedExpense = { ...expense, [field]: value };
          return updatedExpense;
        }
        return expense;
      })
    );

    // Валидируем асинхронно чтобы не блокировать ввод
    if (updatedExpense) {
      const expenseToValidate = updatedExpense;
      setTimeout(() => {
        const newErrors = validateSingleExpense(expenseToValidate);
        
        setValidationErrors(prev => {
          const next = { ...prev };
          
          // Удаляем старые ошибки для этой строки
          Object.keys(next).forEach(key => {
            if (key.startsWith(`${tempId}-`)) {
              delete next[key];
            }
          });
          
          // Добавляем новые ошибки для этой строки
          Object.assign(next, newErrors);
          
          return next;
        });
      }, 0);
    }
  }, [validateSingleExpense]);

  const validateExpenses = useCallback(() => {
    const errors: Record<string, string> = {};
    let hasErrors = false;

    expenses.forEach((expense, index) => {
      const prefix = expense.tempId || index.toString();

      if (!expense.amount || expense.amount <= 0) {
        errors[`${prefix}-amount`] = 'Сумма должна быть больше 0';
        hasErrors = true;
      }

      if (!expense.description?.trim()) {
        errors[`${prefix}-description`] = 'Описание обязательно';
        hasErrors = true;
      }

      if (!expense.expense_date) {
        errors[`${prefix}-expense_date`] = 'Дата обязательна';
        hasErrors = true;
      }

      if (expense.expense_time && expense.expense_time.trim()) {
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(expense.expense_time.trim())) {
          errors[`${prefix}-expense_time`] = 'Время должно быть в формате ЧЧ:ММ';
          hasErrors = true;
        }
      }
    });

    setValidationErrors(errors);
    return !hasErrors;
  }, [expenses]);

  const clearAll = useCallback(() => {
    setExpenses([]);
    setValidationErrors({});
  }, []);

  return {
    expenses,
    setExpenses,
    validationErrors,
    setValidationErrors,
    showErrorsOnly,
    toggleShowErrorsOnly,
    addRow,
    removeRow,
    updateRow,
    validateExpenses,
    clearAll,
  };
}
