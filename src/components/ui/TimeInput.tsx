'use client'

import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface TimeInputProps {
  value?: string
  onChange?: (value: string) => void
  onKeyPress?: (e: React.KeyboardEvent) => void
  onFocus?: () => void
  onError?: (hasError: boolean) => void
  disabled?: boolean
  className?: string
  placeholder?: string
  title?: string
}

export interface TimeInputRef {
  focus: () => void
}

export const TimeInput = forwardRef<TimeInputRef, TimeInputProps>(function TimeInput({
  value = '',
  onChange,
  onKeyPress,
  onFocus,
  onError,
  disabled = false,
  className = '',
  placeholder = 'ЧЧММ',
  title = 'Время'
}, ref) {
  const [inputValue, setInputValue] = useState('')
  const [isInvalid, setIsInvalid] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Предоставляем методы для родительского компонента
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus()
    }
  }))

  // Парсим входящее значение HH:MM в HHMM
  useEffect(() => {
    if (value && value.includes(':')) {
      const [h, m] = value.split(':')
      setInputValue((h || '') + (m || ''))
    } else if (!value) {
      setInputValue('')
    }
  }, [value])

  // Форматируем 4-значное число в HH:MM
  const formatTimeValue = (rawValue: string) => {
    if (!rawValue) return ''
    
    const digits = rawValue.padStart(4, '0')
    const hours = digits.slice(0, 2)
    const minutes = digits.slice(2, 4)
    
    // Валидация
    const h = parseInt(hours)
    const m = parseInt(minutes)
    
    if (h > 23 || m > 59) {
      return '' // Невалидное время
    }
    
    return `${hours}:${minutes}`
  }

  // Отображаемое значение с двоеточием
  const displayValue = () => {
    if (!inputValue) return ''
    
    if (inputValue.length <= 2) {
      return inputValue
    } else {
      // Всегда берем первые 2 символа как часы
      const hours = inputValue.slice(0, 2)
      const minutes = inputValue.slice(2)
      return minutes ? `${hours}:${minutes}` : hours
    }
  }

  // Обработка изменения
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value.replace(/\D/g, '') // Только цифры
    
    // Ограничиваем до 4 цифр
    if (newValue.length > 4) {
      newValue = newValue.slice(0, 4)
    }
    
    // Проверяем валидность
    let invalid = false
    if (newValue.length >= 2) {
      const hours = parseInt(newValue.slice(0, 2))
      if (hours > 23) {
        invalid = true
      }
    }
    
    if (newValue.length === 4) {
      const minutes = parseInt(newValue.slice(2, 4))
      if (minutes > 59) {
        invalid = true
      }
    }
    
    setInputValue(newValue)
    setIsInvalid(invalid)
    onError?.(invalid)
    
    // Форматируем только при валидных 4 цифрах
    if (newValue.length === 4 && !invalid) {
      const formatted = formatTimeValue(newValue)
      if (formatted) {
        onChange?.(formatted)
      }
    } else if (newValue.length === 0) {
      setIsInvalid(false)
      onError?.(false)
      onChange?.('')
    }
  }

  // Обработка фокуса с выделением всего текста
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select()
    onFocus?.()
  }

  // Обработка клавиш
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onKeyPress?.(e)
      return
    }
    
    // Разрешаем навигационные клавиши
    if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
      return
    }
    
    // Разрешаем только цифры
    if (!/\d/.test(e.key)) {
      e.preventDefault()
    }
  }

  return (
    <div className={cn('relative', className)} title={title}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayValue()}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          'w-full px-3 py-2 border rounded-md',
          'focus:outline-none focus:ring-2 focus:border-transparent',
          'bg-white text-gray-900 placeholder:text-gray-400',
          isInvalid 
            ? 'border-red-500 focus:ring-red-500' 
            : 'border-gray-300 focus:ring-indigo-600',
          disabled && 'bg-gray-50 text-gray-500 cursor-not-allowed'
        )}
        maxLength={5} // ЧЧММ + двоеточие
      />
    </div>
  )
})