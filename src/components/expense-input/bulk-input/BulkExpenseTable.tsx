'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DatePicker } from '@/components/ui/DatePicker'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { TimeInput, TimeInputRef } from '@/components/ui/TimeInput'
import type { Category } from '@/types'
import type { BulkExpenseRowData } from '@/lib/validations/expenses'
import { CityInput } from '@/components/ui/CityInput'
import { cn } from '@/lib/utils'
import type { CityOption } from '@/lib/utils/cityOptions'

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
}

interface CityCellProps {
  value: string
  cityId: string | null | undefined
  disabled: boolean
  error?: string
  onValueChange: (value: string) => void
  onCityIdChange: (cityId: string | null) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  onFocus: () => void
  cityOptions: CityOption[]
  cityLookupById: Map<string, CityOption>
  resolveCityByInput: (value: string) => CityOption | null
}

function CityCell({
  value,
  cityId,
  disabled,
  error,
  onValueChange,
  onCityIdChange,
  onKeyDown,
  onFocus,
  cityOptions,
  cityLookupById,
  resolveCityByInput
}: CityCellProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownTimeoutRef = useRef<number | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const resolvedCity = useMemo(() => {
    if (cityId) {
      return cityLookupById.get(cityId) ?? null
    }

    if (value) {
      return resolveCityByInput(value)
    }

    return null
  }, [cityId, cityLookupById, resolveCityByInput, value])

  const filteredCityOptions = useMemo(() => {
    const query = value.trim().toLowerCase()

    // If the input is empty, show favorite cities (up to 6).
    if (!query) {
      const favorites = cityOptions.filter(option => option.isFavorite);
      if (favorites.length > 0) {
        return favorites.slice(0, 6);
      }
      return cityOptions.slice(0, 6);
    }

    // If the query perfectly matches the currently resolved city, show ALL favorites.
    // This happens when re-opening the dropdown for an already selected city.
    if (resolvedCity && query === resolvedCity.cityName.toLowerCase()) {
      const favorites = cityOptions.filter(option => option.isFavorite);
      // If there are favorites, show them. Otherwise, just show the resolved city.
      return favorites.length > 0 ? favorites : (resolvedCity ? [resolvedCity] : []);
    }

    // Otherwise, filter based on the query.
    const base = cityOptions.filter((option) =>
      option.cityName.toLowerCase().includes(query) ||
      option.synonyms.some((synonym) => synonym.toLowerCase().includes(query))
    )

    return base.slice(0, 6)
  }, [cityOptions, value, resolvedCity])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredCityOptions])

  useEffect(() => () => {
    if (dropdownTimeoutRef.current) {
      window.clearTimeout(dropdownTimeoutRef.current)
    }
  }, [])

  const handleChange = (nextValue: string) => {
    const match = resolveCityByInput(nextValue)
    onValueChange(nextValue)
    onCityIdChange(match?.cityId ?? null)
    setIsOpen(Boolean(nextValue))
    setHighlightedIndex(0)
  }

  const handleSelect = (option: CityOption) => {
    onValueChange(option.cityName)
    onCityIdChange(option.cityId)
    setIsOpen(false)
  }

  const handleFocus = () => {
    if (dropdownTimeoutRef.current) {
      window.clearTimeout(dropdownTimeoutRef.current)
      dropdownTimeoutRef.current = null
    }
    onFocus()
    setIsOpen(true)
  }

  const handleBlur = () => {
    dropdownTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false)
    }, 120)
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        setHighlightedIndex(0)
        return
      }
      if (filteredCityOptions.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % filteredCityOptions.length)
      }
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        setHighlightedIndex(filteredCityOptions.length > 0 ? filteredCityOptions.length - 1 : 0)
        return
      }
      if (filteredCityOptions.length > 0) {
        setHighlightedIndex((prev) => (prev - 1 + filteredCityOptions.length) % filteredCityOptions.length)
      }
      return
    }

    if (event.key === 'Enter') {
      if (isOpen && filteredCityOptions[highlightedIndex]) {
        event.preventDefault()
        handleSelect(filteredCityOptions[highlightedIndex])
        return
      }
    }

    if (event.key === 'Escape') {
      setIsOpen(false)
      return
    }

    onKeyDown(event)
  }

  return (
    <div className="space-y-1">
      <CityInput
        value={value || ''}
        onChange={handleChange}
        onCitySelect={(cityId) => onCityIdChange(cityId)}
        cityOptions={filteredCityOptions}
        resolvedCity={resolvedCity}
        disabled={disabled}
        placeholder="Город"
        className={cn('text-sm', error && 'ring-red-300 focus:ring-red-500')}
      />
      {error && <ErrorMessage error={error} />}
    </div>
  )
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
  resolveCityByInput
}: BulkExpenseTableProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null)

  // Опции для селекта категорий
  const categoryOptions = [
    { value: '', label: 'Автоопределение' },
    ...categories.map(category => ({
      value: category.id,
      label: category.name,
      color: category.color || undefined
    }))
  ]
  const timeInputRefs = useRef<Record<string, TimeInputRef | null>>({})



  // Обработка изменения значения в ячейке
  const handleCellChange = useCallback((
    tempId: string,
    field: keyof BulkExpenseRowData,
    value: any
  ) => {
    onUpdateRow(tempId, field, value)
  }, [onUpdateRow])

  // Обработка нажатия Enter для перехода к следующей ячейке
  const handleKeyDown = useCallback((
    event: React.KeyboardEvent,
    tempId: string,
    field: keyof BulkExpenseRowData
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault()

      const currentIndex = expenses.findIndex(e => e.tempId === tempId)
      const fields: (keyof BulkExpenseRowData)[] = ['amount', 'description', 'city', 'expense_date', 'expense_time', 'notes']
      const currentFieldIndex = fields.indexOf(field)

      // Переход к следующему полю или следующей строке
      if (currentFieldIndex < fields.length - 1) {
        const nextField = fields[currentFieldIndex + 1]
        setEditingCell(`${tempId}-${nextField}`)
      } else if (currentIndex < expenses.length - 1) {
        const nextExpense = expenses[currentIndex + 1]
        setEditingCell(`${nextExpense.tempId}-amount`)
      }
    }
  }, [expenses])

  // Получение ошибки для ячейки
  const getCellError = useCallback((tempId: string, field: string) => {
    return validationErrors[`${tempId}-${field}`]
  }, [validationErrors])

  // Форматирование суммы для отображения
  const formatAmount = useCallback((amount: number) => {
    return amount > 0 ? amount.toString() : ''
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
            {expenses.map((expense, index) => {
              const tempId = expense.tempId || index.toString()

              return (
                <tr key={tempId} className="hover:bg-gray-50">
                  {/* Номер строки */}
                  <td className="border border-gray-300 px-3 py-2 text-sm text-gray-600 text-center">
                    {index + 1}
                  </td>

                  {/* Сумма */}
                  <td
                    className="border border-gray-300 px-1 py-1 cursor-pointer hover:bg-gray-50"
                    onClick={(e) => {
                      const input = e.currentTarget.querySelector('input')
                      input?.focus()
                    }}
                  >
                    <div className="space-y-1">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formatAmount(expense.amount)}
                        onChange={(e) => handleCellChange(tempId, 'amount', parseFloat(e.target.value) || 0)}
                        onKeyDown={(e) => handleKeyDown(e, tempId, 'amount')}
                        onFocus={() => setEditingCell(`${tempId}-amount`)}
                        className={`text-sm ${getCellError(tempId, 'amount') ? 'border-red-500' : ''}`}
                        placeholder="0.00"
                      />
                      {getCellError(tempId, 'amount') && (
                        <ErrorMessage error={getCellError(tempId, 'amount')} />
                      )}
                    </div>
                  </td>

                  {/* Описание */}
                  <td
                    className="border border-gray-300 px-1 py-1 cursor-pointer hover:bg-gray-50"
                    onClick={(e) => {
                      const input = e.currentTarget.querySelector('input')
                      input?.focus()
                    }}
                  >
                    <div className="space-y-1">
                      <Input
                        type="text"
                        value={expense.description}
                        onChange={(e) => handleCellChange(tempId, 'description', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, tempId, 'description')}
                        onFocus={() => setEditingCell(`${tempId}-description`)}
                        className={`text-sm ${getCellError(tempId, 'description') ? 'border-red-500' : ''}`}
                        placeholder="Описание расхода"
                      />
                      {getCellError(tempId, 'description') && (
                        <ErrorMessage error={getCellError(tempId, 'description')} />
                      )}
                    </div>
                  </td>

                  {/* Город */}
                  <td
                    className="border border-gray-300 px-1 py-1 cursor-pointer hover:bg-gray-50"
                    onClick={(e) => {
                      const input = e.currentTarget.querySelector('input')
                      input?.focus()
                    }}
                  >
                    <CityCell
                      value={expense.city ?? ''}
                      cityId={expense.city_id ?? null}
                      disabled={false}
                      error={getCellError(tempId, 'city')}
                      onValueChange={(nextValue) => handleCellChange(tempId, 'city', nextValue)}
                      onCityIdChange={(nextCityId) => handleCellChange(tempId, 'city_id', nextCityId)}
                      onKeyDown={(event) => handleKeyDown(event, tempId, 'city')}
                      onFocus={() => setEditingCell(`${tempId}-city`)}
                      cityOptions={cityOptions}
                      cityLookupById={cityLookupById}
                      resolveCityByInput={resolveCityByInput}
                    />
                  </td>

                  {/* Дата */}
                  <td
                    className="border border-gray-300 px-1 py-1 cursor-pointer hover:bg-gray-50"
                    onClick={(e) => {
                      const input = e.currentTarget.querySelector('input')
                      input?.focus()
                    }}
                  >
                    <div className="space-y-1">
                      <DatePicker
                        value={expense.expense_date}
                        onChange={(value) => handleCellChange(tempId, 'expense_date', value)}
                        onKeyPress={(e) => handleKeyDown(e, tempId, 'expense_date')}
                        className={`text-sm ${getCellError(tempId, 'expense_date') ? 'border-red-500' : ''}`}
                      />
                      {getCellError(tempId, 'expense_date') && (
                        <ErrorMessage error={getCellError(tempId, 'expense_date')} />
                      )}
                    </div>
                  </td>

                  {/* Время */}
                  <td
                    className="border border-gray-300 px-1 py-1 cursor-pointer hover:bg-gray-50 w-20"
                    onClick={() => {
                      setEditingCell(`${tempId}-expense_time`)
                      timeInputRefs.current[tempId]?.focus()
                    }}
                  >
                    <div className="space-y-1">
                      <TimeInput
                        ref={(ref) => {
                          if (ref) {
                            timeInputRefs.current[tempId] = ref
                          }
                        }}
                        value={expense.expense_time || ''}
                        onChange={(value) => handleCellChange(tempId, 'expense_time', value)}
                        onKeyPress={(e) => handleKeyDown(e, tempId, 'expense_time')}
                        onFocus={() => setEditingCell(`${tempId}-expense_time`)}
                        disabled={false}
                        className={`text-sm ${getCellError(tempId, 'expense_time') ? 'ring-red-500' : ''} w-[76px]`}
                      />
                      {getCellError(tempId, 'expense_time') && (
                        <ErrorMessage error={getCellError(tempId, 'expense_time')} />
                      )}
                    </div>
                  </td>

                  {/* Категория */}
                  <td className="border border-gray-300 px-1 py-1">
                    <SearchableSelect
                      options={categoryOptions}
                      value={expense.category_id || ''}
                      onChange={(value) => handleCellChange(tempId, 'category_id', value)}
                      placeholder="Выберите категорию"
                      className="text-sm"
                    />
                  </td>

                  {/* Примечания */}
                  <td
                    className="border border-gray-300 px-1 py-1 cursor-pointer hover:bg-gray-50"
                    onClick={(e) => {
                      const input = e.currentTarget.querySelector('input')
                      input?.focus()
                    }}
                  >
                    <Input
                      type="text"
                      value={expense.notes || ''}
                      onChange={(e) => handleCellChange(tempId, 'notes', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, tempId, 'notes')}
                      onFocus={() => setEditingCell(`${tempId}-notes`)}
                      className="text-sm"
                      placeholder="Дополнительные заметки"
                    />
                  </td>

                  {/* Действия */}
                  <td className="border border-gray-300 px-1 py-1 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRemoveRow(tempId)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1"
                      title="Удалить строку"
                    >
                      🗑️
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {expenses.length > 0 && (
          <div className="mt-4 text-sm text-gray-600 space-y-1">
            <p>💡 <strong>Советы:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Используйте Tab или Enter для перехода между ячейками</li>
              <li>Обязательные поля отмечены звёздочкой (*)</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}