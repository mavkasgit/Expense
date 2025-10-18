'use client'

import { useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import type { Category } from '@/types'
import type { BulkExpenseRowData } from '@/lib/validations/expenses'
import type { CityOption } from '@/lib/utils/cityOptions'
import { BulkExpenseRow } from './BulkExpenseRow'

interface BulkExpenseTableProps {
  expenses: BulkExpenseRowData[]
  categories: Category[]
  validationErrors: Record<string, string>
  onUpdateRow: (tempId: string, field: keyof BulkExpenseRowData, value: any) => void
  onRemoveRow: (tempId: string) => void
  onPaste: (event: React.ClipboardEvent) => void
  cityOptions: CityOption[]
  cityLookupById: Map<string, CityOption>
  resolveCityByInput: (value: string) => CityOption | null
  showErrorsOnly?: boolean
  showNewCitiesOnly?: boolean
  showNewDescriptionsOnly?: boolean
  existingCities?: Set<string>
  existingDescriptions?: Set<string>
  onAddRow?: (count: number) => void
}

export function BulkExpenseTable({
  expenses,
  categories,
  validationErrors,
  onUpdateRow,
  onRemoveRow,
  onPaste,
  cityOptions,
  cityLookupById,
  resolveCityByInput,
  showErrorsOnly = false,
  showNewCitiesOnly = false,
  showNewDescriptionsOnly = false,
  existingCities = new Set(),
  existingDescriptions = new Set(),
  onAddRow
}: BulkExpenseTableProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null)

  // Мемоизируем категории для быстрого поиска
  const categoryMap = useMemo(() => 
    new Map(categories.map(c => [c.id, c])), 
    [categories]
  )

  // Фильтруем расходы на основе активных фильтров
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      // Фильтр по ошибкам
      if (showErrorsOnly) {
        const tempId = expense.tempId || '';
        const hasError = Object.keys(validationErrors).some(key => key.startsWith(tempId));
        if (!hasError) return false;
      }

      // Фильтр по новым городам
      if (showNewCitiesOnly) {
        const cityName = expense.city?.toLowerCase().trim();
        if (!cityName || existingCities.has(cityName)) return false;
      }

      // Фильтр по новым описаниям
      if (showNewDescriptionsOnly) {
        const description = expense.description?.toLowerCase().trim();
        if (!description || existingDescriptions.has(description)) return false;
      }

      return true;
    });
  }, [expenses, showErrorsOnly, showNewCitiesOnly, showNewDescriptionsOnly, validationErrors, existingCities, existingDescriptions])

  // Мемоизируем обработчики чтобы не создавать их заново при каждом рендере
  const handleSetEditingCell = useCallback((cellId: string) => {
    setEditingCell(cellId)
  }, [])

  return (
    <div className="overflow-x-auto">
      <div
        className="min-w-full"
        onPaste={onPaste}
        tabIndex={0}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 w-24">
                №
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 w-32">
                Сумма *
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 min-w-48">
                Описание *
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 min-w-40">
                Город
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 w-32">
                Дата *
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 w-20">
                Время
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 w-48">
                Категория
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 min-w-48">
                Примечания
              </th>
              <th className="border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700 w-16">
                Действия
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.map((expense, index) => {
              const tempId = expense.tempId || index.toString()
              const category = expense.category_id ? categoryMap.get(expense.category_id) : null

              return (
                <BulkExpenseRow
                  key={tempId}
                  expense={expense}
                  index={index}
                  category={category ?? null}
                  validationErrors={validationErrors}
                  onUpdateRow={onUpdateRow}
                  onRemoveRow={onRemoveRow}
                  onSetEditingCell={handleSetEditingCell}
                  cityOptions={cityOptions}
                  cityLookupById={cityLookupById}
                  resolveCityByInput={resolveCityByInput}
                />
              )
            })}
          </tbody>
        </table>
      </div>
      
      {onAddRow && (
        <div className="mt-4">
          <Button
            onClick={() => onAddRow(1)}
            variant="outline"
            size="sm"
            className="w-full"
          >
            + Добавить строку
          </Button>
        </div>
      )}
    </div>
  )
}
