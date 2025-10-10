'use client'

import { useState, useTransition, useEffect, useRef, useMemo, useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { DatePicker } from '@/components/ui/DatePicker'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { TimeInput } from '@/components/ui/TimeInput'
import { updateExpense } from '@/lib/actions/expenses'
import { useToast } from '@/hooks/useToast'
import type { ExpenseWithCategory, Category, City, CitySynonymOptionRecord } from '@/types'
import type { UpdateExpenseData } from '@/lib/validations/expenses'
import { buildCityOptions, type CityOption } from '@/lib/utils/cityOptions'
import { cn } from '@/lib/utils'
import { CityInput } from '@/components/ui/CityInput'
import { parseCityCoordinates, normaliseMarkerPreset, hasGeoPoint, isVirtualCoordinates } from '@/lib/utils/cityCoordinates'
import { availableIcons } from '@/lib/utils/category-constants'

const NO_CATEGORY = 'NO_CATEGORY'

interface ExpenseEditModalProps {
  expense: ExpenseWithCategory
  categories: Category[]
  cities: City[]
  isOpen: boolean
  onClose: () => void
  onSuccess?: (updatedExpense: any) => void
}

export function ExpenseEditModal({
  expense,
  categories,
  cities,
  isOpen,
  onClose,
  onSuccess
}: ExpenseEditModalProps) {
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [timeError, setTimeError] = useState(false)
  const { showToast } = useToast()
  const cityInputRef = useRef<HTMLInputElement>(null)
  const cityDropdownTimeoutRef = useRef<number | null>(null)
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false)
  const [highlightedCityIndex, setHighlightedCityIndex] = useState(0)

  // Состояние формы
  const [formData, setFormData] = useState({
    amount: expense.amount,
    description: expense.description || '',
    notes: expense.notes || '',
    category_id: expense.category_id || '',
    expense_date: expense.expense_date,
    expense_time: expense.expense_time || '',
    cityInput: expense.city?.name || expense.raw_city_input || '',
    cityId: expense.city_id || '',
  })

  const { cityOptions, cityLookupBySynonym, cityLookupById } = useMemo(() => {
    const citySynonymRecords: CitySynonymOptionRecord[] = cities.map(city => {
      const parsedCoordinates = parseCityCoordinates(city.coordinates ?? null)
      return {
        id: 0, // Not used in buildCityOptions
        cityId: city.id,
        cityName: city.name,
        synonym: city.name,
        markerPreset: parsedCoordinates ? normaliseMarkerPreset(parsedCoordinates.markerPreset) : null,
        hasCoordinates: Boolean(parsedCoordinates && hasGeoPoint(parsedCoordinates) && !isVirtualCoordinates(parsedCoordinates)),
        isFavorite: city.is_favorite || false,
      }
    })
    return buildCityOptions(citySynonymRecords)
  }, [cities])

  const resolveCityByInput = useCallback((value: string): CityOption | null => {
    const normalized = value.trim().toLowerCase()
    if (!normalized) {
      return null
    }
    return cityLookupBySynonym.get(normalized) ?? null
  }, [cityLookupBySynonym])

  const resolvedCity = useMemo(() => {
    if (formData.cityId) {
      return cityLookupById.get(formData.cityId) ?? null
    }
    if (formData.cityInput) {
      return resolveCityByInput(formData.cityInput)
    }
    return null
  }, [cityLookupById, formData.cityId, formData.cityInput, resolveCityByInput])

  const filteredCityOptions = useMemo(() => {
    const query = formData.cityInput.trim().toLowerCase()

    if (!query) {
      const favorites = cityOptions.filter(option => option.isFavorite);
      if (favorites.length > 0) {
        return favorites.slice(0, 6);
      }
      return cityOptions.slice(0, 6);
    }

    if (resolvedCity && query === resolvedCity.cityName.toLowerCase()) {
      const favorites = cityOptions.filter(option => option.isFavorite);
      return favorites.length > 0 ? favorites : [resolvedCity];
    }

    const base = cityOptions.filter((option) =>
      option.cityName.toLowerCase().includes(query) ||
      option.synonyms.some((synonym) => synonym.toLowerCase().includes(query))
    )

    return base.slice(0, 6)
  }, [cityOptions, formData.cityInput, resolvedCity])

  // Валидация поля
  const validateField = (name: string, value: any) => {
    const newErrors = { ...errors }

    switch (name) {
      case 'amount':
        if (!value || value <= 0) {
          newErrors.amount = 'Сумма должна быть больше 0'
        } else if (value > 999999.99) {
          newErrors.amount = 'Сумма не должна превышать 999,999.99'
        } else {
          delete newErrors.amount
        }
        break

      case 'description':
        if (value && value.length > 500) {
          newErrors.description = 'Описание не должно превышать 500 символов'
        } else {
          delete newErrors.description
        }
        break

      case 'notes':
        if (value && value.length > 1000) {
          newErrors.notes = 'Примечание не должно превышать 1000 символов'
        } else {
          delete newErrors.notes
        }
        break

      case 'expense_time':
        if (value && value.trim()) {
          const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
          if (!timeRegex.test(value.trim())) {
            newErrors.expense_time = 'Время должно быть в формате ЧЧ:ММ (например, 14:30)'
          } else {
            delete newErrors.expense_time
          }
        } else {
          delete newErrors.expense_time
        }
        break

      case 'expense_date':
        if (!value) {
          newErrors.expense_date = 'Дата обязательна'
        } else {
          const date = new Date(value)
          const now = new Date()
          const maxDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())

          if (isNaN(date.getTime())) {
            newErrors.expense_date = 'Неверный формат даты'
          } else if (date > maxDate) {
            newErrors.expense_date = 'Дата не может быть в будущем более чем на год'
          } else {
            delete newErrors.expense_date
          }
        }
        break
    }

    setErrors(newErrors)
  }

  // Обработка изменений полей
  const handleFieldChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }))
    validateField(name, value)
  }

  const handleCityInputChange = (value: string) => {
    const match = resolveCityByInput(value)
    setFormData(prev => ({
      ...prev,
      cityInput: value,
      cityId: match?.cityId ?? ''
    }))
    setIsCityDropdownOpen(Boolean(value))
    setHighlightedCityIndex(0)
  }

  const handleCitySelect = (option: CityOption) => {
    setFormData(prev => ({
      ...prev,
      cityInput: option.cityName,
      cityId: option.cityId
    }))
    setIsCityDropdownOpen(false)
    if (cityInputRef.current) {
      cityInputRef.current.blur()
    }
  }

  const handleCityInputFocus = () => {
    if (cityDropdownTimeoutRef.current) {
      window.clearTimeout(cityDropdownTimeoutRef.current)
      cityDropdownTimeoutRef.current = null
    }
    if (filteredCityOptions.length > 0) {
      setIsCityDropdownOpen(true)
    }
  }

  const handleCityInputBlur = () => {
    cityDropdownTimeoutRef.current = window.setTimeout(() => {
      setIsCityDropdownOpen(false)
    }, 120)
  }

  const handleCityKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!isCityDropdownOpen) {
        setIsCityDropdownOpen(true)
        setHighlightedCityIndex(0)
        return
      }
      if (filteredCityOptions.length > 0) {
        setHighlightedCityIndex(prev => (prev + 1) % filteredCityOptions.length)
      }
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isCityDropdownOpen) {
        setIsCityDropdownOpen(true)
        setHighlightedCityIndex(filteredCityOptions.length > 0 ? filteredCityOptions.length - 1 : 0)
        return
      }
      if (filteredCityOptions.length > 0) {
        setHighlightedCityIndex(prev => (prev - 1 + filteredCityOptions.length) % filteredCityOptions.length)
      }
      return
    }

    if (event.key === 'Enter') {
      if (isCityDropdownOpen && filteredCityOptions[highlightedCityIndex]) {
        event.preventDefault()
        handleCitySelect(filteredCityOptions[highlightedCityIndex])
        return
      }
      return
    }

    if (event.key === 'Escape') {
      setIsCityDropdownOpen(false)
    }
  }

  // Сброс формы при открытии модала
  useEffect(() => {
    if (isOpen) {
      setFormData({
        amount: expense.amount,
        description: expense.description || '',
        notes: expense.notes || '',
        category_id: expense.category_id || NO_CATEGORY,
        expense_date: expense.expense_date,
        expense_time: expense.expense_time || '',
        cityInput: expense.city?.name || expense.raw_city_input || '',
        cityId: expense.city_id || '',
      })
      setErrors({})
    }
  }, [isOpen, expense])

  // Отправка формы
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Валидируем все поля
    Object.keys(formData).forEach(key => {
      validateField(key, formData[key as keyof typeof formData])
    })

    // Проверяем наличие ошибок
    if (Object.keys(errors).length > 0) {
      showToast('Исправьте ошибки в форме', 'error')
      return
    }

    startTransition(async () => {
      try {
        // Подготавливаем данные для обновления (только измененные поля)
        const updateData: UpdateExpenseData = {}

        if (formData.amount !== expense.amount) {
          updateData.amount = formData.amount
        }

        if (formData.description !== (expense.description || '')) {
          updateData.description = formData.description || undefined
        }

        if (formData.notes !== (expense.notes || '')) {
          updateData.notes = formData.notes || undefined
        }

        if (formData.category_id !== (expense.category_id || NO_CATEGORY)) {
          updateData.category_id = formData.category_id === NO_CATEGORY ? null : formData.category_id
        }

        if (formData.expense_date !== expense.expense_date) {
          updateData.expense_date = formData.expense_date
        }

        if (formData.expense_time !== (expense.expense_time || '')) {
          updateData.expense_time = formData.expense_time || undefined
        }

        if (formData.cityInput !== (expense.city?.name || expense.raw_city_input || '')) {
          updateData.city_id = resolvedCity?.cityId
          updateData.city_input = formData.cityInput
        }

        // Если нет изменений, просто закрываем модал
        if (Object.keys(updateData).length === 0) {
          onClose()
          return
        }

        const result = await updateExpense(expense.id, updateData)

        if (result.error) {
          showToast(result.error, 'error')
          return
        }

        showToast('Расход обновлен', 'success')

        // Вызываем callback
        if (onSuccess) {
          onSuccess(result.data)
        }

        onClose()
      } catch (error) {
        console.error('Ошибка обновления расхода:', error)
        showToast('Произошла ошибка при обновлении', 'error')
      }
    })
  }

  // Опции категорий для селекта с иконками и цветами
  const categoryOptions = [
    { 
      value: '', 
      label: 'Без категории',
      icon: <span className="text-gray-400">📦</span>
    },
    ...categories.map(category => {
      const iconData = availableIcons.find(icon => icon.key === category.icon)
      return {
        value: category.id,
        label: category.name,
        color: category.color,
        icon: iconData ? <span>{iconData.emoji}</span> : <span className="text-gray-400">📦</span>
      }
    })
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Редактировать расход"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Сумма */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
              Сумма
            </label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              max="999999.99"
              value={formData.amount || ''}
              onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value) || 0)}
              className={errors.amount ? 'border-red-500' : ''}
              disabled={isPending}
              placeholder="0"
            />
            {errors.amount && <ErrorMessage error={errors.amount} />}
          </div>

          {/* Дата */}
          <div>
            <label htmlFor="expense_date" className="block text-sm font-medium text-gray-700 mb-1">
              Дата
            </label>
            <DatePicker
              value={formData.expense_date}
              onChange={(value) => handleFieldChange('expense_date', value)}
              className={errors.expense_date ? 'border-red-500' : ''}
              disabled={isPending}
              placeholder="Выберите дату"
            />
            {errors.expense_date && <ErrorMessage error={errors.expense_date} />}
          </div>

          {/* Время */}
          <div>
            <label htmlFor="expense_time" className="block text-sm font-medium text-gray-700 mb-1">
              Время
            </label>
            <TimeInput
              value={formData.expense_time}
              onChange={(value) => handleFieldChange('expense_time', value)}
              onError={setTimeError}
              disabled={isPending}
              className={errors.expense_time ? 'ring-red-500' : ''}
            />
            {errors.expense_time && <ErrorMessage error={errors.expense_time} />}
          </div>
        </div>

        {/* Описание и Город на одной строке */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Описание */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Описание
            </label>
            <Input
              id="description"
              type="text"
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="Описание расхода..."
              maxLength={500}
              className={errors.description ? 'border-red-500' : ''}
              disabled={isPending}
            />
            {errors.description && <ErrorMessage error={errors.description} />}

          </div>

          {/* Город */}
          <div>
            <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
              Город
            </label>
            <CityInput
              value={formData.cityInput}
              onChange={(value) => handleCityInputChange(value)}
              onCitySelect={(cityId) => setFormData(prev => ({ ...prev, cityId }))}
              cityOptions={filteredCityOptions}
              resolvedCity={resolvedCity}
              disabled={isPending}
              placeholder="Введите город..."
            />
          </div>
        </div>

        {/* Категория */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Категория
          </label>
          <SearchableSelect
            options={categoryOptions}
            value={formData.category_id}
            onChange={(value) => handleFieldChange('category_id', value)}
            placeholder="Выберите категорию..."
            disabled={isPending}
          />
        </div>

        {/* Примечание */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Примечание
          </label>
          <textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => handleFieldChange('notes', e.target.value)}
            placeholder="Дополнительные заметки о расходе..."
            maxLength={1000}
            rows={3}
            className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none ${errors.notes ? 'border-red-500' : ''}`}
            disabled={isPending}
          />
          {errors.notes && <ErrorMessage error={errors.notes} />}
          {formData.notes && (
            <div className="text-xs text-gray-500 mt-1">
              {formData.notes.length}/1000 символов
            </div>
          )}
        </div>

        {/* Источник файла */}
        {expense.bank_statements?.filename && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Источник
            </label>
            <div className="flex items-center gap-2 mt-1 w-full px-3 py-2 border border-gray-200 bg-gray-50 text-gray-500 rounded-md shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="w-4 h-4 flex-shrink-0" viewBox="0 0 16 16">
                <path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0V3z"/>
              </svg>
              <span className="truncate">{expense.bank_statements.filename}</span>
            </div>
          </div>
        )}

        {/* Кнопки */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={isPending || Object.keys(errors).length > 0 || timeError}
            className="flex-1"
          >
            {isPending ? 'Сохранение...' : 'Сохранить изменения'}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            Отмена
          </Button>
        </div>
      </form>
    </Modal>
  )
}