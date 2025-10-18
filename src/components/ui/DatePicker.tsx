'use client'

import { useState, useRef, useEffect, forwardRef } from 'react'
import { Input } from './Input'
import { MONTH_NAMES_RU, WEEK_DAYS_RU, formatDateRu, parseDateRu } from '@/lib/utils/dateUtils'

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  placeholder?: string
  onKeyPress?: (e: React.KeyboardEvent) => void
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(function DatePicker({ 
  value, 
  onChange, 
  disabled = false, 
  className = '',
  placeholder = 'Выберите дату',
  onKeyPress
}, ref) {
  const [isOpen, setIsOpen] = useState(false)
  const [displayValue, setDisplayValue] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Форматируем дату для отображения (ДД.ММ.ГГГГ)
  useEffect(() => {
    if (value) {
      setDisplayValue(formatDateRu(value))
    } else {
      setDisplayValue('')
    }
  }, [value])

  // Закрываем календарь при клике вне
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Генерируем календарь
  const generateCalendar = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    
    // Понедельник = 1, Воскресенье = 0, поэтому корректируем
    let startDay = firstDay.getDay()
    startDay = startDay === 0 ? 6 : startDay - 1 // Делаем понедельник первым днем (0)

    const days = []
    
    // Пустые ячейки для дней предыдущего месяца
    for (let i = 0; i < startDay; i++) {
      days.push(null)
    }
    
    // Дни текущего месяца
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day)
    }
    
    return days
  }

  const currentDate = value ? new Date(value) : new Date()
  const [viewYear, setViewYear] = useState(currentDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(currentDate.getMonth())

  const monthNames = MONTH_NAMES_RU
  const weekDays = WEEK_DAYS_RU

  const handleDateSelect = (day: number) => {
    const selectedDate = new Date(viewYear, viewMonth, day)
    const isoString = selectedDate.toISOString().split('T')[0]
    onChange(isoString)
    setIsOpen(false)
  }

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(viewYear - 1)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(viewYear + 1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    setDisplayValue(inputValue)

    // Пытаемся парсить дату в русском формате ДД.ММ.ГГГГ
    if (inputValue.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
      const isoString = parseDateRu(inputValue)
      onChange(isoString)
    }
  }

  const days = generateCalendar(viewYear, viewMonth)
  const today = new Date()
  const selectedDate = value ? new Date(value) : null

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={ref}
        type="text"
        value={displayValue}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onKeyPress={onKeyPress}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-4 min-w-[280px]">
          {/* Заголовок с навигацией */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div className="font-medium">
              {monthNames[viewMonth]} {viewYear}
            </div>
            
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Дни недели */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 p-2">
                {day}
              </div>
            ))}
          </div>

          {/* Календарь */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (day === null) {
                return <div key={index} className="p-2"></div>
              }

              const isToday = today.getDate() === day && 
                            today.getMonth() === viewMonth && 
                            today.getFullYear() === viewYear

              const isSelected = selectedDate && 
                               selectedDate.getDate() === day && 
                               selectedDate.getMonth() === viewMonth && 
                               selectedDate.getFullYear() === viewYear

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleDateSelect(day)}
                  className={`
                    p-2 text-sm rounded hover:bg-blue-100 transition-colors
                    ${isSelected ? 'bg-blue-500 text-white hover:bg-blue-600' : ''}
                    ${isToday && !isSelected ? 'bg-blue-50 text-blue-600 font-medium' : ''}
                  `}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Быстрые действия */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                const today = new Date()
                const isoString = today.toISOString().split('T')[0]
                onChange(isoString)
                setIsOpen(false)
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Сегодня
            </button>
          </div>
        </div>
      )}
    </div>
  )
})