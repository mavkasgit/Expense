'use client'

import { memo, useRef, useCallback, useMemo, useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Category } from '@/types'
import type { BulkExpenseRowData } from '@/lib/validations/expenses'
import { cn } from '@/lib/utils'
import type { CityOption } from '@/lib/utils/cityOptions'
import { CityCellMemo } from './CityCellMemo'

interface BulkExpenseRowProps {
  expense: BulkExpenseRowData
  index: number
  category: Category | null
  validationErrors: Record<string, string>
  onUpdateRow: (tempId: string, field: keyof BulkExpenseRowData, value: any) => void
  onRemoveRow: (tempId: string) => void
  onSetEditingCell: (cellId: string) => void
  cityOptions: CityOption[]
  cityLookupById: Map<string, CityOption>
  resolveCityByInput: (value: string) => CityOption | null
}

// Функция для конвертации даты из YYYY-MM-DD в DD.MM.YYYY
const formatDateForDisplay = (isoDate: string): string => {
  if (!isoDate) return ''
  const [year, month, day] = isoDate.split('-')
  if (!year || !month || !day) return isoDate
  return `${day}.${month}.${year}`
}

// Функция для конвертации даты из DD.MM.YYYY в YYYY-MM-DD
const formatDateForStorage = (displayDate: string): string => {
  if (!displayDate) return ''
  // Поддерживаем разные разделители
  const parts = displayDate.split(/[.\-/]/)
  if (parts.length !== 3) return displayDate
  
  // Определяем порядок по длине первой части
  const [first, second, third] = parts
  
  // Если первая часть 4 символа - это уже YYYY-MM-DD
  if (first.length === 4) {
    return displayDate
  }
  
  // Иначе DD.MM.YYYY -> YYYY-MM-DD
  return `${third}-${second.padStart(2, '0')}-${first.padStart(2, '0')}`
}

function BulkExpenseRowComponent({
  expense,
  index,
  category,
  validationErrors,
  onUpdateRow,
  onRemoveRow,
  onSetEditingCell,
  cityOptions,
  cityLookupById,
  resolveCityByInput
}: BulkExpenseRowProps) {
  const tempId = expense.tempId || index.toString()
  const timeInputRef = useRef<HTMLInputElement>(null)
  const amountInputRef = useRef<HTMLInputElement>(null)
  const descriptionInputRef = useRef<HTMLInputElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const notesInputRef = useRef<HTMLInputElement>(null)
  
  // Локальное состояние для мгновенного отображения без обновления global state
  const [localDescription, setLocalDescription] = useState(expense.description)
  const [localNotes, setLocalNotes] = useState(expense.notes || '')
  const [localDate, setLocalDate] = useState(formatDateForDisplay(expense.expense_date))
  const [localAmount, setLocalAmount] = useState(expense.amount > 0 ? expense.amount.toString() : '')
  const [localTime, setLocalTime] = useState(expense.expense_time || '')
  const [localCity, setLocalCity] = useState(expense.city || '')
  const [localCityId, setLocalCityId] = useState(expense.city_id)
  
  // Синхронизируем ТОЛЬКО при изменении expense извне (не от нашего ввода)
  const prevExpenseRef = useRef(expense)
  useEffect(() => {
    if (prevExpenseRef.current !== expense) {
      setLocalDescription(expense.description)
      setLocalNotes(expense.notes || '')
      setLocalDate(formatDateForDisplay(expense.expense_date))
      setLocalAmount(expense.amount > 0 ? expense.amount.toString() : '')
      setLocalTime(expense.expense_time || '')
      setLocalCity(expense.city || '')
      setLocalCityId(expense.city_id)
      prevExpenseRef.current = expense
    }
  }, [expense])

  const getCellError = useCallback((field: string) => {
    return validationErrors[`${tempId}-${field}`]
  }, [validationErrors, tempId])

  // Проверяем есть ли хоть одна ошибка в строке
  const hasAnyError = useMemo(() => {
    return Object.keys(validationErrors).some(key => key.startsWith(`${tempId}-`))
  }, [validationErrors, tempId])

  const formatAmount = useCallback((amount: number) => {
    return amount > 0 ? amount.toString() : ''
  }, [])
  
  const amountValue = useMemo(() => formatAmount(expense.amount), [expense.amount, formatAmount])

  const handleCommitChange = useCallback((field: keyof BulkExpenseRowData, value: any) => {
    onUpdateRow(tempId, field, value)
  }, [onUpdateRow, tempId])

  const handleFocusSelect = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    event.target.select()
  }, [])

  const handleKeyDown = useCallback((
    event: React.KeyboardEvent<HTMLInputElement>,
    field: keyof BulkExpenseRowData
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      
      // Коммитим текущее значение перед переходом
      const target = event.currentTarget;
      let valueToCommit: any = target.value;
      
      if (field === 'amount') {
        valueToCommit = parseFloat(target.value) || 0;
      } else if (field === 'expense_date') {
        valueToCommit = formatDateForStorage(target.value);
      }
      
      handleCommitChange(field, valueToCommit);
      
      const fields: (keyof BulkExpenseRowData)[] = ['amount', 'description', 'city', 'expense_date', 'expense_time', 'notes']
      const currentFieldIndex = fields.indexOf(field)
      
      if (currentFieldIndex < fields.length - 1) {
        const nextField = fields[currentFieldIndex + 1]
        onSetEditingCell(`${tempId}-${nextField}`)
        
        // Фокусируем следующее поле
        setTimeout(() => {
          if (nextField === 'amount' && amountInputRef.current) amountInputRef.current.focus()
          else if (nextField === 'description' && descriptionInputRef.current) descriptionInputRef.current.focus()
          else if (nextField === 'expense_date' && dateInputRef.current) dateInputRef.current.focus()
          else if (nextField === 'expense_time' && timeInputRef.current) timeInputRef.current.focus()
          else if (nextField === 'notes' && notesInputRef.current) notesInputRef.current.focus()
        }, 0);
      }
    }
  }, [onSetEditingCell, tempId, handleCommitChange])

  return (
    <tr className="hover:bg-gray-50">
      {/* Номер строки */}
      <td className="border border-gray-300 px-3 py-2 text-sm text-gray-600 text-center">
        <div className="flex items-center justify-center gap-1">
          {hasAnyError && <span className="text-red-500" title="Есть ошибки валидации">⚠️</span>}
          <span>{index + 1}</span>
        </div>
      </td>

      {/* Сумма */}
      <td className="border border-gray-300 px-1 py-1">
        <div className="space-y-1">
          <Input
            ref={amountInputRef}
            type="number"
            step="0.01"
            min="0"
            value={localAmount}
            onChange={(e) => setLocalAmount(e.target.value)}
            onBlur={(e) => handleCommitChange('amount', parseFloat(e.target.value) || 0)}
            onKeyDown={(e) => handleKeyDown(e, 'amount')}
            onFocus={(e) => {
              onSetEditingCell(`${tempId}-amount`)
              handleFocusSelect(e)
            }}
            className={`text-sm ${getCellError('amount') ? 'border-red-500' : ''}`}
            placeholder="0.00"
          />
        </div>
      </td>

      {/* Описание */}
      <td className="border border-gray-300 px-1 py-1">
        <div className="space-y-1">
          <Input
            ref={descriptionInputRef}
            type="text"
            value={localDescription}
            onChange={(e) => setLocalDescription(e.target.value)}
            onBlur={(e) => handleCommitChange('description', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, 'description')}
            onFocus={() => onSetEditingCell(`${tempId}-description`)}
            className={`text-sm ${getCellError('description') ? 'border-red-500' : ''}`}
            placeholder="Описание расхода"
          />
        </div>
      </td>

      {/* Город */}
      <td className="border border-gray-300 px-1 py-1">
        <CityCellMemo
          value={localCity}
          cityId={localCityId}
          error={getCellError('city')}
          onValueChange={(nextValue) => {
            setLocalCity(nextValue)
          }}
          onCityIdChange={(nextCityId) => {
            setLocalCityId(nextCityId)
          }}
          onBlur={() => {
            handleCommitChange('city', localCity)
            handleCommitChange('city_id', localCityId)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleCommitChange('city', localCity)
              handleCommitChange('city_id', localCityId)
            }
            handleKeyDown(event, 'city')
          }}
          onFocus={() => onSetEditingCell(`${tempId}-city`)}
          cityOptions={cityOptions}
          cityLookupById={cityLookupById}
          resolveCityByInput={resolveCityByInput}
        />
      </td>

      {/* Дата */}
      <td className="border border-gray-300 px-1 py-1">
        <div className="space-y-1">
          <Input
            ref={dateInputRef}
            type="text"
            value={localDate}
            onChange={(e) => setLocalDate(e.target.value)}
            onBlur={(e) => handleCommitChange('expense_date', formatDateForStorage(e.target.value))}
            onKeyDown={(e) => handleKeyDown(e, 'expense_date')}
            onFocus={(e) => {
              onSetEditingCell(`${tempId}-expense_date`)
              handleFocusSelect(e)
            }}
            className={`text-sm ${getCellError('expense_date') ? 'border-red-500' : ''}`}
            placeholder="ДД.ММ.ГГГГ"
          />
        </div>
      </td>

      {/* Время */}
      <td className="border border-gray-300 px-1 py-1 w-20">
        <div className="space-y-1">
          <Input
            ref={timeInputRef}
            type="text"
            value={localTime}
            onChange={(e) => setLocalTime(e.target.value)}
            onBlur={(e) => handleCommitChange('expense_time', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, 'expense_time')}
            onFocus={(e) => {
              onSetEditingCell(`${tempId}-expense_time`)
              handleFocusSelect(e)
            }}
            className={`text-sm ${getCellError('expense_time') ? 'ring-red-500' : ''} w-[76px]`}
            placeholder="ЧЧ:ММ"
          />
        </div>
      </td>

      {/* Категория */}
      <td className="border border-gray-300 px-1 py-1">
        <Input
          readOnly
          value={category ? category.name : 'Не определена'}
          className={cn(
            'text-sm pointer-events-none',
            !category && 'text-gray-500'
          )}
          leftIcon={category ? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color || '#ccc' }} /> : undefined}
        />
      </td>

      {/* Примечания */}
      <td className="border border-gray-300 px-1 py-1">
        <Input
          ref={notesInputRef}
          type="text"
          value={localNotes}
          onChange={(e) => setLocalNotes(e.target.value)}
          onBlur={(e) => handleCommitChange('notes', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, 'notes')}
          onFocus={() => onSetEditingCell(`${tempId}-notes`)}
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
}

// Оптимизированное сравнение для memo
export const BulkExpenseRow = memo(BulkExpenseRowComponent)

BulkExpenseRow.displayName = 'BulkExpenseRow'
