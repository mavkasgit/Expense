'use client'

import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import type { ColumnMapping } from '@/types'
import type { BuildExpensesResult } from './types'
import {
  sanitizeColumnMapping,
  COLUMN_MAPPING_STORAGE_KEY
} from './utils/columnMapping'

interface UseColumnMappingProps {
  buildExpensesFromMappedData: (mapping: ColumnMapping[]) => BuildExpensesResult
  appendExpensesWithStats: (result: BuildExpensesResult) => void
  saveImportedExpenses: (result: BuildExpensesResult) => Promise<boolean>
  setReviewModalState: (state: { mode: 'append' | 'directSave'; result: BuildExpensesResult } | null) => void
  isEditingColumnMapping: boolean
}

export function useColumnMapping({
  buildExpensesFromMappedData,
  appendExpensesWithStats,
  saveImportedExpenses,
  setReviewModalState,
  isEditingColumnMapping
}: UseColumnMappingProps) {
  const { showToast } = useToast()
  const [savedColumnMapping, setSavedColumnMapping] = useState<ColumnMapping[] | null>(null)

  const loadSavedColumnMapping = useCallback(() => {
    try {
      const saved = localStorage.getItem(COLUMN_MAPPING_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const sanitized = sanitizeColumnMapping(parsed)
        setSavedColumnMapping(sanitized)
        return sanitized
      }
    } catch (error) {
      console.warn('Ошибка загрузки сохраненной схемы столбцов:', error)
    }
    setSavedColumnMapping(null)
    return []
  }, [])

  const saveColumnMapping = useCallback((mapping: ColumnMapping[]) => {
    try {
      const sanitized = sanitizeColumnMapping(mapping)
      localStorage.setItem(COLUMN_MAPPING_STORAGE_KEY, JSON.stringify(sanitized))
      setSavedColumnMapping(sanitized.length > 0 ? sanitized : null)
    } catch (error) {
      console.warn('Ошибка сохранения схемы столбцов:', error)
    }
  }, [])

  const handleColumnMappingApply = useCallback(
    (mapping: ColumnMapping[]) => {
      saveColumnMapping(mapping)

      if (isEditingColumnMapping) {
        showToast('Настройки столбцов сохранены', 'success')
        return
      }

      const result = buildExpensesFromMappedData(mapping)

      if (result.expenses.length === 0) {
        showToast('Не удалось обработать данные с текущими настройками столбцов', 'error')
        return
      }

      if (result.reviewItems.length > 0) {
        setReviewModalState({ mode: 'append', result })
        showToast('Найдены автоматически выделенные поля. Подтвердите импорт.', 'info')
        return
      }

      appendExpensesWithStats(result)
    },
    [
      appendExpensesWithStats,
      buildExpensesFromMappedData,
      isEditingColumnMapping,
      saveColumnMapping,
      setReviewModalState,
      showToast
    ]
  )

  const handleColumnMappingApplyAndSave = useCallback(
    async (mapping: ColumnMapping[]) => {
      saveColumnMapping(mapping)

      const result = buildExpensesFromMappedData(mapping)

      if (result.expenses.length === 0) {
        showToast('Не удалось обработать данные с текущими настройками столбцов', 'error')
        return
      }

      if (result.reviewItems.length > 0) {
        setReviewModalState({ mode: 'directSave', result })
        showToast('Найдены автоматически выделенные поля. Подтвердите сохранение.', 'info')
        return
      }

      await saveImportedExpenses(result)
    },
    [
      buildExpensesFromMappedData,
      saveColumnMapping,
      saveImportedExpenses,
      setReviewModalState,
      showToast
    ]
  )

  return {
    savedColumnMapping,
    loadSavedColumnMapping,
    handleColumnMappingApply,
    handleColumnMappingApplyAndSave
  }
}
