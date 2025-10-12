'use client'

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { createBulkExpenses } from '@/lib/actions/expenses';
import { createBankStatement } from '@/lib/actions/bankStatements';
import type { CreateExpenseData } from '@/types';
import type { BulkExpenseRowData } from '@/lib/validations/expenses';

interface UseExpenseSubmitProps {
  expenses: BulkExpenseRowData[];
  autoRedirect: boolean;
  validateExpenses: () => boolean;
  clearForm: () => void;
}

export function useExpenseSubmit({ expenses, autoRedirect, validateExpenses, clearForm }: UseExpenseSubmitProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewModalState, setReviewModalState] = useState<any | null>(null);
  const [isReviewProcessing, setIsReviewProcessing] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  const saveImportedExpenses = useCallback(async (result: any, fileName?: string) => {
    const { expenses: newExpenses } = result;
    let batchId: string | undefined = undefined;
    if (fileName) {
      batchId = crypto.randomUUID();
      const fileType = fileName.split('.').pop()?.toLowerCase() || 'unknown';
      const statementResult = await createBankStatement({ id: batchId, filename: fileName, file_type: fileType, total_records: newExpenses.length });
      if (statementResult.error) {
        showToast(`Ошибка создания записи о выписке: ${statementResult.error}`, 'error');
        return false;
      }
    }

    const expensesToCreate: CreateExpenseData[] = newExpenses.map((expense: BulkExpenseRowData) => ({ amount: expense.amount, description: expense.description, notes: expense.notes, category_id: expense.category_id || undefined, expense_date: expense.expense_date, expense_time: expense.expense_time || null, city_id: expense.city_id || undefined, city_input: expense.city?.trim() || undefined, input_method: 'bulk_table' as const, batch_id: batchId }));
    const resultAction = await createBulkExpenses(expensesToCreate);

    if (resultAction.error) {
      showToast(resultAction.error, 'error');
      return false;
    }

    if (resultAction.success && resultAction.stats) {
      const { success, failed, uncategorized, total } = resultAction.stats;
      let message = `Создано ${success} из ${total} расходов`;
      if (failed > 0) message += `, ${failed} с ошибками`;
      if (uncategorized > 0) message += `, ${uncategorized} без категории`;
      showToast(message, success > 0 ? 'success' : 'error');
      if (success > 0) {
        clearForm();
        if (autoRedirect) router.push('/expenses');
      }
      return success > 0;
    }
    return false;
  }, [showToast, autoRedirect, router, clearForm]);

  const handleDirectSave = useCallback(async () => {
    if (expenses.length === 0) {
      showToast('Добавьте хотя бы один расход', 'error');
      return;
    }
    if (!validateExpenses()) {
      showToast('Исправьте ошибки в данных', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await saveImportedExpenses({ expenses, stats: {} });
    } catch (error) {
      showToast('Произошла ошибка при сохранении', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [expenses, validateExpenses, showToast, saveImportedExpenses]);

  const handleReviewCancel = useCallback(() => {
    setReviewModalState(null);
    showToast('Сохранение отменено.', 'info');
  }, [showToast]);

  const handleReviewConfirm = useCallback(async () => {
    if (!reviewModalState) return;
    const resultToSave = reviewModalState.result;
    setIsReviewProcessing(true);
    try {
      const success = await saveImportedExpenses(resultToSave);
      if (success) {
        setReviewModalState(null);
      }
    } finally {
      setIsReviewProcessing(false);
    }
  }, [reviewModalState, saveImportedExpenses]);

  return {
    isSubmitting,
    reviewModalState,
    setReviewModalState,
    isReviewProcessing,
    handleDirectSave,
    handleReviewCancel,
    handleReviewConfirm,
    saveImportedExpenses
  };
}

