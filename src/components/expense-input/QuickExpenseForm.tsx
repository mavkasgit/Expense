'use client'

import {
  useState,
  useTransition,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { DatePicker } from '@/components/ui/DatePicker'
import { TimeInput } from '@/components/ui/TimeInput'
import { createExpense } from '@/lib/actions/expenses'
import { getCurrentDateISO, getCurrentTimeHHMM } from '@/lib/utils/dateUtils'
import type { CreateExpenseData } from '@/types'
import { useToast } from '@/hooks/useToast'
import { getUserSettings, UserSettings } from '@/lib/actions/settings'
import { useCitySynonyms } from '@/hooks/useCitySynonyms'
import { CityInput } from '@/components/ui/CityInput'
import { normaliseMarkerPreset } from '@/lib/utils/cityCoordinates'
import { buildCityOptions, type CityOption } from '@/lib/utils/cityOptions'
import { cn } from '@/lib/utils'

interface QuickExpenseFormProps {
  onSuccess?: (expense: any) => void
  className?: string
}

export function QuickExpenseForm({
  onSuccess,
  className = '' 
}: QuickExpenseFormProps) {
  const [isPending, startTransition] = useTransition()
  const { showToast } = useToast()
  const amountInputRef = useRef<HTMLInputElement>(null)
  const cityInputRef = useRef<HTMLInputElement>(null)
  const cityDropdownTimeoutRef = useRef<number | null>(null)

  const [formData, setFormData] = useState({
    amount: 0,
    description: '',
    notes: '',
    expense_date: getCurrentDateISO(),
    expense_time: getCurrentTimeHHMM(),
    cityId: '',
    cityInput: '',
    input_method: 'single' as const
  })

  const [userSettings, setUserSettings] = useState<UserSettings>({})
  const { synonyms: citySynonyms } = useCitySynonyms()

  const { cityOptions, cityLookupBySynonym, cityLookupById } = useMemo(
    () => buildCityOptions(citySynonyms),
    [citySynonyms]
  )

  const resolveCityByInput = useCallback((value: string): CityOption | null => {
    const normalized = value.trim().toLowerCase()
    if (!normalized) {
      return null
    }
    return cityLookupBySynonym.get(normalized) ?? null
  }, [cityLookupBySynonym])

  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false)
  const [highlightedCityIndex, setHighlightedCityIndex] = useState(0)
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
      return favorites.length > 0 ? favorites : [resolvedCity];
    }
    
    // Otherwise, filter based on the query.
    const base = cityOptions.filter((option) =>
        option.cityName.toLowerCase().includes(query) ||
        option.synonyms.some((synonym) => synonym.toLowerCase().includes(query))
      )

    return base.slice(0, 6)
  }, [cityOptions, formData.cityInput, resolvedCity])

  const resolvedMarkerPreset = resolvedCity ? normaliseMarkerPreset(resolvedCity.markerPreset) : undefined

  useEffect(() => {
    setHighlightedCityIndex(0)
  }, [filteredCityOptions])

  useEffect(() => () => {
    if (cityDropdownTimeoutRef.current) {
      window.clearTimeout(cityDropdownTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const fetchSettings = async () => {
      const result = await getUserSettings();
      if (result.settings) {
        setUserSettings(result.settings);
      }
    };
    fetchSettings();
  }, []);

  // Обработка изменения описания
  const handleDescriptionChange = (value: string) => {
    setFormData(prev => ({ ...prev, description: value }))
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
      if (!isPending) {
        event.preventDefault()
        handleQuickSubmit()
      }
      return
    }

    if (event.key === 'Escape') {
      setIsCityDropdownOpen(false)
    }
  }

  // Быстрая отправка формы (Enter в любом поле)
  const handleQuickSubmit = async () => {
    // Базовая валидация
    if (!formData.amount || formData.amount <= 0) {
      showToast('Введите сумму расхода', 'error')
      amountInputRef.current?.focus()
      return
    }

    if (!formData.description || formData.description.trim().length === 0) {
      showToast('Введите описание для автоматической категоризации', 'error')
      return
    }

    startTransition(async () => {
      try {
        // Создаем расход без указания категории
        const trimmedCityInput = formData.cityInput.trim()

        const expenseData: CreateExpenseData = {
          amount: formData.amount,
          description: formData.description,
          notes: formData.notes || undefined,
          expense_date: formData.expense_date,
          expense_time: formData.expense_time || undefined,
          city_id: resolvedCity?.cityId || undefined,
          city_input: trimmedCityInput || undefined,
          input_method: formData.input_method
          // category_id не указываем - система автоматически определит
        }

        const result = await createExpense(expenseData)

        if ('error' in result) {
          showToast(result.error, 'error')
          return
        }

        // Показываем результат категоризации
        if (result.data?.auto_categorized) {
          showToast('Расход добавлен и категоризирован', 'success')
        } else {
          showToast('Расход добавлен в неопознанные', 'info')
        }
        
        // Сбрасываем форму, но оставляем дату и обновляем время
        setFormData(prev => ({
          amount: 0,
          description: '',
          notes: '',
          expense_date: prev.expense_date, // Оставляем дату
          expense_time: getCurrentTimeHHMM(), // Обновляем время на текущее
          cityId: '',
          cityInput: '',
          input_method: 'single'
        }))
        setIsCityDropdownOpen(false)

        // Фокус обратно на сумму для следующего ввода
        setTimeout(() => {
          amountInputRef.current?.focus()
        }, 100)

        // Вызываем callback
        if (onSuccess) {
          onSuccess(result.data)
        }
      } catch (error) {
        console.error('Ошибка создания расхода:', error)
        showToast('Произошла ошибка', 'error')
      }
    })
  }

  // Обработка Enter в полях
  const handleKeyPress = (e: ReactKeyboardEvent<Element>) => {
    if (e.key === 'Enter' && !isPending) {
      e.preventDefault()
      handleQuickSubmit()
    }
  }

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-3">
        <div className="text-sm font-medium text-gray-700 mb-3">
          Быстрый ввод расхода
        </div>

        {/* Сумма и описание в одной строке */}
        <div className="grid grid-cols-2 gap-3">
          {/* Сумма */}
          <div>
            <Input
              ref={amountInputRef}
              type="number"
              step="0.01"
              min="0"
              value={formData.amount || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                amount: parseFloat(e.target.value) || 0
              }))}
              onKeyPress={handleKeyPress}
              placeholder="Сумма"
              disabled={isPending}
              className="text-lg"
            />
          </div>

          {/* Описание */}
          <div>
            <Input
              type="text"
              value={formData.description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Описание для автокатегоризации"
              disabled={isPending}
            />
          </div>
        </div>

        {/* Город */}
        <div className="grid grid-cols-1 gap-2">
          <CityInput
            value={formData.cityInput}
            onChange={(value) => handleCityInputChange(value)}
            onCitySelect={(cityId) => setFormData(prev => ({ ...prev, cityId }))}
            cityOptions={filteredCityOptions}
            resolvedCity={resolvedCity}
            disabled={isPending}
            placeholder="Город"
          />
          <div className="min-h-[1rem] text-xs text-slate-500">
            {formData.cityInput
              ? resolvedCity
                ? `Определён город «${resolvedCity.cityName}»`
                : 'Новый город будет сохранён как непознанный'
              : 'Укажите город, чтобы привязать расход к карте'}
          </div>
        </div>

        {/* Примечание */}
        <div>
          <Input
            type="text"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              notes: e.target.value
            }))}
            onKeyPress={handleKeyPress}
            placeholder="Примечание (необязательно)"
            disabled={isPending}
            maxLength={1000}
          />
        </div>

        {/* Дата и время */}
        <div className="grid grid-cols-2 gap-3">
          {/* Дата */}
          <div>
            <DatePicker
              value={formData.expense_date}
              onChange={(value) => setFormData(prev => ({
                ...prev,
                expense_date: value
              }))}
              onKeyPress={handleKeyPress}
              disabled={isPending}
              placeholder="Дата"
            />
          </div>

          {/* Время */}
          <div>
            <TimeInput
              value={formData.expense_time}
              onChange={(value) => setFormData(prev => ({
                ...prev,
                expense_time: value
              }))}
              onKeyPress={handleKeyPress}
              disabled={isPending}
            />
          </div>
        </div>

        <Button
          onClick={handleQuickSubmit}
          disabled={isPending || !formData.amount || !formData.description.trim()}
          className="w-full"
          size="sm"
        >
          {isPending ? 'Добавление...' : 'Добавить'}
        </Button>
      </div>
    </Card>
  )
}