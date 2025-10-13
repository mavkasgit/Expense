'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/useToast'
import { createBulkExpenses } from '@/lib/actions/expenses'
import { createBankStatement } from '@/lib/actions/bankStatements'
import type { CreateExpenseData } from '@/types'
import type { BulkExpenseRowData } from '@/lib/validations/expenses'
import type { BuildExpensesResult } from './types'

interface UseExpenseSubmitProps {
  expenses: BulkExpenseRowData[]
  autoRedirect: boolean
  validateExpenses: () => boolean
  clearExpenses: () => void
  resetFileState: () => void
  onDatasetSaved: (result: BuildExpensesResult) => void
  fileName: string
}

export function useExpenseSubmit({
  expenses,
  autoRedirect,
  validateExpenses,
  clearExpenses,
  resetFileState,
  onDatasetSaved,
  fileName
}: UseExpenseSubmitProps) {
  const router = useRouter()
  const { showToast } = useToast()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isReviewProcessing, setIsReviewProcessing] = useState(false)

  const saveExpensesBatch = useCallback(
    async (rows: BulkExpenseRowData[], stats?: BuildExpensesResult['stats']) => {
      let batchId: string | undefined

      if (fileName) {
        batchId = crypto.randomUUID()
        const fileType = fileName.split('.').pop()?.toLowerCase() || 'unknown'

        const statementResult = await createBankStatement({
          id: batchId,
          filename: fileName,
          file_type: fileType,
          total_records: rows.length
        })

        if (statementResult.error) {
          showToast(`Ошибка создания записи о выписке: ${statementResult.error}`, 'error')
          return false
        }
      }

      const payload: CreateExpenseData[] = rows.map(expense => ({
        amount: expense.amount,
        description: expense.description,
        notes: expense.notes,
        category_id: expense.category_id || undefined,
        expense_date: expense.expense_date,
        expense_time: expense.expense_time || null,
        city_id: expense.city_id || undefined,
        city_input: expense.city?.trim() || undefined,
        input_method: 'bulk_table',
        batch_id: batchId
      }))

      const result = await createBulkExpenses(payload)

      if (result.error) {
        showToast(result.error, 'error')
        return false
      }

      if (result.success && result.stats) {
        const { success, failed, uncategorized, total } = result.stats
        let message = `Создано ${success} из ${total} расходов`
        if (failed > 0) {
          message += `, ${failed} с ошибками`
        }
        if (uncategorized > 0) {
          message += `, ${uncategorized} без категории`
        }
        showToast(message, success > 0 ? 'success' : 'error')

        if (success > 0 && stats) {
          const details: string[] = []
          if (stats.autoDetectedCities > 0) {
            details.push(`автогорода: ${stats.autoDetectedCities}`)
          }
          if (stats.manualTimes + stats.detectedTimes > 0) {
            details.push(`время: ${stats.manualTimes + stats.detectedTimes}`)
          }
          if (details.length > 0) {
            showToast(`Автозаполненные поля сохранены (${details.join(', ')}). Проверьте их в списке расходов.`, 'info')
          }
        }

        return success > 0
      }

      return false
    },
    [fileName, showToast]
  )

  const handleDirectSave = useCallback(async () => {
    if (expenses.length === 0) {
      showToast('Добавьте хотя бы один расход', 'error')
      return
    }

    if (!validateExpenses()) {
      showToast('Исправьте ошибки в данных', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      const success = await saveExpensesBatch(expenses)
      if (success) {
        clearExpenses()
        resetFileState()
        if (autoRedirect) {
          router.push('/expenses')
        }
      }
    } catch (error) {
      showToast('Произошла ошибка при сохранении', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }, [autoRedirect, clearExpenses, expenses, resetFileState, router, saveExpensesBatch, showToast, validateExpenses])

  const saveImportedExpenses = useCallback(
    async (result: BuildExpensesResult) => {
      setIsReviewProcessing(true)
      try {
        const success = await saveExpensesBatch(result.expenses, result.stats)
        if (success) {
          onDatasetSaved(result)
          if (autoRedirect) {
            router.push('/expenses')
          }
        }
        return success
      } finally {
        setIsReviewProcessing(false)
      }
    },
    [autoRedirect, onDatasetSaved, router, saveExpensesBatch]
  )

  return {
    isSubmitting,
    isReviewProcessing,
    handleDirectSave,
    saveImportedExpenses
  }
}
