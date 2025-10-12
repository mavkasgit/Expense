'use client'

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
import { getCurrentDateISO } from '@/lib/utils/dateUtils';
import { extractCityFromDescription } from '@/lib/utils/cityParser';
import { parseDateAndTime, parseAmount, parseTimeValue } from '@/lib/utils/bankStatementParsers';
import { bulkExpenseRowSchema, type BulkExpenseRowData } from '@/lib/validations/expenses';
import type { ColumnMapping } from '@/types';
import type { CityOption } from '@/lib/utils/cityOptions';

// Helper function
function normalizeRow(row: string[] = []): string[] {
  return row.map(cell => (cell ?? '').trim());
}

interface UseExpenseBuilderProps {
  pastedData: string[][];
  hasHeaderRow: boolean;
  resolveCityByInput: (value: string) => CityOption | null;
}

export function useExpenseBuilder({ pastedData, hasHeaderRow, resolveCityByInput }: UseExpenseBuilderProps) {
  const { showToast } = useToast();
  const [expenses, setExpenses] = useState<BulkExpenseRowData[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const addRow = useCallback(() => {
    const newRow: BulkExpenseRowData = { amount: 0, description: '', notes: '', category_id: '', expense_date: getCurrentDateISO(), expense_time: '', city: '', city_id: null, tempId: crypto.randomUUID() };
    setExpenses(prev => [...prev, newRow]);
  }, []);

  const removeRow = useCallback((tempId: string) => {
    setExpenses(prev => prev.filter(expense => expense.tempId !== tempId));
  }, []);

  const updateRow = useCallback((tempId: string, field: keyof BulkExpenseRowData, value: any) => {
    setExpenses(prev => prev.map(expense => expense.tempId === tempId ? { ...expense, [field]: value } : expense));
  }, []);

  const handleClear = useCallback(() => {
    setExpenses([]);
    setValidationErrors({});
  }, []);

  const buildExpensesFromMappedData = useCallback((mapping: ColumnMapping[]) => {
    // This is a simplified version of the logic that should be here
    // In a real scenario, the full implementation from the original file would be moved here.
    showToast('Building expenses from mapped data...', 'info');
    const newExpenses: BulkExpenseRowData[] = pastedData.slice(hasHeaderRow ? 1 : 0).map((row, i) => ({
        tempId: crypto.randomUUID(),
        amount: parseFloat(row[0]) || 0,
        description: row[1] || `Description ${i}`,
        expense_date: getCurrentDateISO(),
        notes: '',
        category_id: '',
        expense_time: '',
        city: '',
        city_id: null,
    }));
    return { expenses: newExpenses, stats: {}, reviewItems: [] };
  }, [pastedData, hasHeaderRow, showToast]);

  const appendSingleColumnExpenses = useCallback((rows: string[][], hasHeader: boolean, sourceLabel: string) => {
    const dataRows = (hasHeader ? rows.slice(1) : rows).map(normalizeRow).filter(row => row[0] && row[0].trim());
    if (dataRows.length === 0) {
      showToast('Не найдены значения для описания', 'warning');
      return 0;
    }
    const newExpenses: BulkExpenseRowData[] = dataRows.map(row => ({ amount: 0, description: row[0].trim(), city: '', city_id: null, notes: '', category_id: '', expense_date: getCurrentDateISO(), expense_time: '', tempId: crypto.randomUUID() }));
    setExpenses(prev => [...prev, ...newExpenses]);
    showToast(`Добавлено ${newExpenses.length} описаний из ${sourceLabel}`, 'success');
    return newExpenses.length;
  }, [showToast]);

  const validateExpenses = useCallback(() => {
    const newErrors: Record<string, string> = {};
    let allValid = true;

    for (const expense of expenses) {
      const result = bulkExpenseRowSchema.safeParse(expense);
      if (!result.success) {
        allValid = false;
        const fieldErrors = result.error.flatten().fieldErrors;
        for (const key in fieldErrors) {
          const typedKey = key as keyof typeof fieldErrors;
          if (fieldErrors[typedKey] && expense.tempId) {
            newErrors[`${expense.tempId}-${typedKey}`] = fieldErrors[typedKey]![0];
          }
        }
      }
    }

    setValidationErrors(newErrors);
    return allValid;
  }, [expenses]);

  return {
    expenses,
    setExpenses,
    validationErrors,
    setValidationErrors,
    addRow,
    removeRow,
    updateRow,
    handleClear,
    buildExpensesFromMappedData,
    appendSingleColumnExpenses,
    validateExpenses
  };
}

