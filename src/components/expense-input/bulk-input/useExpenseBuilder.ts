'use client'

import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { getCurrentDateISO } from '@/lib/utils/dateUtils'
import { extractCityFromDescription } from '@/lib/utils/cityParser'
import {
  parseAmount,
  parseDateAndTime,
  parseTimeValue
} from '@/lib/utils/bankStatementParsers'
import {
  bulkExpenseRowSchema,
  type BulkExpenseRowData
} from '@/lib/validations/expenses'
import type { ColumnMapping } from '@/types'
import type { CityOption } from '@/lib/utils/cityOptions'
import {
  sanitizeColumnMapping,
  getColumnLabel
} from './utils/columnMapping'
import type {
  AutoExtractionReviewItem,
  BuildExpensesResult,
  BuildExpensesStats
} from './types'

function normalizeRow(row: string[] = []): string[] {
  return row.map(cell => (cell ?? '').trim())
}

interface UseExpenseBuilderProps {
  pastedData: string[][]
  hasHeaderRow: boolean
  resolveCityByInput: (value: string) => CityOption | null
  onDatasetConsumed?: () => void
}

export function useExpenseBuilder({
  pastedData,
  hasHeaderRow,
  resolveCityByInput,
  onDatasetConsumed
}: UseExpenseBuilderProps) {
  const { showToast } = useToast()
  const [expenses, setExpenses] = useState<BulkExpenseRowData[]>([])
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const addRow = useCallback(() => {
    const newRow: BulkExpenseRowData = {
      amount: 0,
      description: '',
      notes: '',
      category_id: '',
      expense_date: getCurrentDateISO(),
      expense_time: '',
      city: '',
      city_id: null,
      tempId: crypto.randomUUID()
    }
    setExpenses(prev => [...prev, newRow])
  }, [])

  const removeRow = useCallback((tempId: string) => {
    setExpenses(prev => prev.filter(expense => expense.tempId !== tempId))
    setValidationErrors(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(key => {
        if (key.startsWith(`${tempId}-`)) {
          delete next[key]
        }
      })
      return next
    })
  }, [])

  const updateRow = useCallback(
    (tempId: string, field: keyof BulkExpenseRowData, value: unknown) => {
      setExpenses(prev =>
        prev.map(expense =>
          expense.tempId === tempId ? { ...expense, [field]: value } : expense
        )
      )
      setValidationErrors(prev => {
        const key = `${tempId}-${field}`
        if (!prev[key]) {
          return prev
        }
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    []
  )

  const handleClear = useCallback(() => {
    setExpenses([])
    setValidationErrors({})
  }, [])

  const validateExpenses = useCallback(() => {
    const nextErrors: Record<string, string> = {}
    let isValid = true

    for (const expense of expenses) {
      const result = bulkExpenseRowSchema.safeParse(expense)
      if (!result.success) {
        isValid = false
        const fieldErrors = result.error.flatten().fieldErrors
        for (const key of Object.keys(fieldErrors)) {
          const typedKey = key as keyof typeof fieldErrors
          const messages = fieldErrors[typedKey]
          if (messages && messages[0] && expense.tempId) {
            nextErrors[`${expense.tempId}-${typedKey}`] = messages[0]
          }
        }
      }
    }

    setValidationErrors(nextErrors)
    return isValid
  }, [expenses])

  const appendSingleColumnExpenses = useCallback(
    (rows: string[][], headerPresent: boolean, sourceLabel: string) => {
      const dataRows = (headerPresent ? rows.slice(1) : rows)
        .map(normalizeRow)
        .filter(row => row[0] && row[0].trim())

      if (dataRows.length === 0) {
        showToast('Не найдены значения для описания', 'warning')
        return 0
      }

      const newExpenses: BulkExpenseRowData[] = dataRows.map(row => ({
        amount: 0,
        description: row[0].trim(),
        city: '',
        city_id: null,
        notes: '',
        category_id: '',
        expense_date: getCurrentDateISO(),
        expense_time: '',
        tempId: crypto.randomUUID()
      }))

      setExpenses(prev => [...prev, ...newExpenses])
      showToast(`Добавлено ${newExpenses.length} описаний из ${sourceLabel}`, 'success')
      return newExpenses.length
    },
    [showToast]
  )

  const buildExpensesFromMappedData = useCallback(
    (mapping: ColumnMapping[]): BuildExpensesResult => {
      const stats: BuildExpensesStats = {
        totalRows: 0,
        importedRows: 0,
        skippedRows: 0,
        autoDetectedCities: 0,
        manualCities: 0,
        detectedTimes: 0,
        manualTimes: 0
      }

      if (pastedData.length === 0) {
        return { expenses: [], stats, reviewItems: [] }
      }

      const headerRow = hasHeaderRow ? pastedData[0] : null

      const mappingWithMeta = sanitizeColumnMapping(mapping).map((column, columnIndex) => ({
        ...column,
        columnIndex,
        columnLabel: getColumnLabel(columnIndex, headerRow),
        targetFields: Array.isArray(column.targetFields) ? column.targetFields : [],
        hidden: Boolean(column.hidden)
      }))

      const rowsToProcess = (hasHeaderRow ? pastedData.slice(1) : pastedData)
        .map(normalizeRow)
        .filter(row => row.some(cell => cell && cell.trim().length > 0))

      stats.totalRows = rowsToProcess.length

      const newExpenses: BulkExpenseRowData[] = []
      const reviewItems: AutoExtractionReviewItem[] = []

      rowsToProcess.forEach((row, dataRowIndex) => {
        const expenseDraft: Partial<BulkExpenseRowData> & {
          expense_time?: string | null
        } = {
          tempId: crypto.randomUUID()
        }

        let descriptionColumnLabel: string | null = null
        let descriptionSourceValue = ''
        let descriptionColumnIndex: number | null = null

        mappingWithMeta.forEach(column => {
          if (column.hidden || !column.enabled || column.targetFields.length === 0) {
            return
          }

          const cellValue = row[column.columnIndex]?.trim() || ''
          if (!cellValue) {
            return
          }

          column.targetFields.forEach(targetField => {
            switch (targetField) {
              case 'amount': {
                try {
                  const parsedAmount = parseAmount(cellValue)
                  const normalizedAmount = Math.abs(parsedAmount)
                  if (normalizedAmount > 0) {
                    expenseDraft.amount = normalizedAmount
                  }
                } catch (error) {
                  console.warn('Не удалось распарсить сумму из столбца', cellValue, error)
                }
                break
              }
              case 'description':
                expenseDraft.description = cellValue
                descriptionColumnLabel = column.columnLabel
                descriptionSourceValue = cellValue
                descriptionColumnIndex = column.columnIndex
                break
              case 'city':
                expenseDraft.city = cellValue
                break
              case 'expense_date': {
                const dateTimeResult = parseDateAndTime(cellValue)
                expenseDraft.expense_date = dateTimeResult.date
                if (dateTimeResult.time && !expenseDraft.expense_time) {
                  expenseDraft.expense_time = dateTimeResult.time
                  stats.detectedTimes += 1
                }
                break
              }
              case 'expense_time': {
                if (expenseDraft.expense_time) {
                  break
                }
                const parsedTime = parseTimeValue(cellValue)
                if (parsedTime) {
                  expenseDraft.expense_time = parsedTime
                  stats.manualTimes += 1
                }
                break
              }
              case 'notes':
                expenseDraft.notes = cellValue
                break
            }
          })
        })

        if (expenseDraft.amount && expenseDraft.description) {
          let cleanDescription = expenseDraft.description.trim()
          let notes = expenseDraft.notes?.trim() || ''
          let detectedCity: string | null = null

          if (cleanDescription) {
            const cityParseResult = extractCityFromDescription(cleanDescription)
            if (cityParseResult.confidence > 0.6) {
              cleanDescription = cityParseResult.cleanDescription
              if (!expenseDraft.city && cityParseResult.displayCity) {
                detectedCity = cityParseResult.displayCity
              }
            }
          }

          const providedCity = expenseDraft.city?.trim()
          let finalCity = providedCity || detectedCity || ''
          let resolvedCityId: string | null = null

          if (providedCity) {
            stats.manualCities += 1
            const resolved = resolveCityByInput(providedCity)
            if (resolved) {
              finalCity = resolved.cityName
              resolvedCityId = resolved.cityId
            }
          } else if (detectedCity) {
            stats.autoDetectedCities += 1
            const resolved = resolveCityByInput(detectedCity)
            if (resolved) {
              finalCity = resolved.cityName
              resolvedCityId = resolved.cityId
            }

            const reviewNote = `Автодетект города: ${finalCity || detectedCity}`
            if (!notes.includes(reviewNote)) {
              notes = notes ? `${notes}\n${reviewNote}` : reviewNote
            }

            reviewItems.push({
              type: 'city-from-description',
              rowIndex: dataRowIndex + 1,
              columnLabel:
                descriptionColumnLabel || getColumnLabel(descriptionColumnIndex ?? 0, headerRow),
              sourceValue: descriptionSourceValue,
              extractedCity: finalCity || detectedCity,
              cleanedDescription: cleanDescription
            })
          }

          newExpenses.push({
            amount: expenseDraft.amount,
            description: cleanDescription,
            notes,
            category_id: '',
            expense_date: expenseDraft.expense_date || getCurrentDateISO(),
            expense_time: expenseDraft.expense_time || null,
            city: finalCity,
            city_id: resolvedCityId,
            tempId: expenseDraft.tempId!
          })
        }
      })

      stats.importedRows = newExpenses.length
      stats.skippedRows = Math.max(stats.totalRows - stats.importedRows, 0)

      return { expenses: newExpenses, stats, reviewItems }
    },
    [hasHeaderRow, pastedData, resolveCityByInput]
  )

  const appendExpensesWithStats = useCallback(
    (result: BuildExpensesResult) => {
      const { expenses: newExpenses, stats } = result
      setExpenses(prev => [...prev, ...newExpenses])
      onDatasetConsumed?.()

      showToast(`Добавлено ${newExpenses.length} из ${stats.totalRows} записей`, 'success')

      if (stats.autoDetectedCities > 0 || stats.detectedTimes > 0 || stats.manualTimes > 0) {
        const details: string[] = []
        if (stats.autoDetectedCities > 0) {
          details.push(`автогорода: ${stats.autoDetectedCities}`)
        }
        if (stats.manualTimes + stats.detectedTimes > 0) {
          details.push(`время: ${stats.manualTimes + stats.detectedTimes}`)
        }
        const suffix = details.length > 0 ? ` (${details.join(', ')})` : ''
        showToast(`Пожалуйста, подтвердите автоматически заполненные поля${suffix}.`, 'info')
      } else {
        showToast('Проверьте импортированные данные перед сохранением.', 'info')
      }
    },
    [onDatasetConsumed, showToast]
  )

  return {
    expenses,
    setExpenses,
    validationErrors,
    setValidationErrors,
    addRow,
    removeRow,
    updateRow,
    handleClear,
    validateExpenses,
    appendSingleColumnExpenses,
    buildExpensesFromMappedData,
    appendExpensesWithStats
  }
}
