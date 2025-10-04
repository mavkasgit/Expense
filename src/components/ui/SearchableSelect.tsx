'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface Option {
  value: string | null
  label: string
  color?: string
  icon?: React.ReactNode
}

interface SearchableSelectProps {
  options: Option[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  className?: string
  required?: boolean
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  maxVisibleOptions?: number
  defaultOpen?: boolean
  forceOpen?: boolean
}

const optionHeightMap: Record<NonNullable<SearchableSelectProps['size']>, number> = {
  sm: 32,
  md: 40,
  lg: 48
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Выберите опцию',
  className,
  required = false,
  disabled = false,
  size = 'md',
  maxVisibleOptions,
  defaultOpen = false,
  forceOpen = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(forceOpen || defaultOpen)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [showAll, setShowAll] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true)
    }
  }, [forceOpen])

  useEffect(() => {
    setShowAll(false)
  }, [searchTerm])

  const filteredOptions = options.filter(option => option.label.toLowerCase().includes(searchTerm.toLowerCase()))

  const selectedOption = options.find(option => option.value === value)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (forceOpen) {
        return
      }
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
        setHighlightedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [forceOpen])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].value)
        }
        break
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1))
        break
      case 'Escape':
        if (!forceOpen) {
          setIsOpen(false)
        }
        setSearchTerm('')
        setHighlightedIndex(-1)
        break
    }
  }

  const handleSelect = (optionValue: string | null) => {
    onChange(optionValue)
    if (!forceOpen) {
      setIsOpen(false)
    }
    setSearchTerm('')
    setHighlightedIndex(-1)
  }

  const handleInputClick = () => {
    if (disabled) return
    if (!forceOpen) {
      setIsOpen(true)
    }
    inputRef.current?.focus()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    setHighlightedIndex(-1)
    if (!isOpen && !forceOpen) setIsOpen(true)
  }

  const visibleOptions = showAll || !maxVisibleOptions ? filteredOptions : filteredOptions.slice(0, maxVisibleOptions)
  const canToggle = Boolean(maxVisibleOptions && filteredOptions.length > maxVisibleOptions)
  const optionHeight = optionHeightMap[size]
  const maxHeight = showAll || !maxVisibleOptions ? 240 : Math.max(120, maxVisibleOptions * optionHeight)
  const dropdownStyle = { maxHeight }
  const shouldRenderDropdown = forceOpen || isOpen

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div
        className={cn('relative w-full cursor-pointer', disabled && 'cursor-not-allowed opacity-50')}
        onClick={handleInputClick}
      >
        <input
          ref={inputRef}
          type="text"
          value={shouldRenderDropdown ? searchTerm : selectedOption?.label || ''}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'w-full rounded-md border border-gray-300 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'bg-white text-gray-900',
            size === 'sm' && 'px-2 py-1 text-sm',
            size === 'md' && 'px-3 py-2',
            size === 'lg' && 'px-4 py-3 text-lg',
            disabled && 'bg-gray-100 cursor-not-allowed'
          )}
          required={required}
          disabled={disabled}
          autoComplete="new-password"
        />

        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <svg
            className={cn(
              'h-4 w-4 text-gray-400 transition-transform duration-200',
              shouldRenderDropdown && !forceOpen && 'rotate-180'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {shouldRenderDropdown && (
        <div
          className={cn(
            'mt-1 w-full overflow-auto rounded-md border border-gray-300 bg-white',
            forceOpen ? 'relative z-0 shadow-sm' : 'absolute z-50 shadow-lg'
          )}
          style={dropdownStyle}
        >
          {visibleOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">Ничего не найдено</div>
          ) : (
            <>
              {visibleOptions.map((option, index) => (
                <div
                  key={option.value ?? `option-${index}`}
                  className={cn(
                    'flex cursor-pointer items-center space-x-2 px-3 py-2 text-sm',
                    'hover:bg-gray-100',
                    highlightedIndex === index && 'bg-gray-100',
                    value === option.value && 'bg-blue-50 text-blue-700'
                  )}
                  onClick={() => handleSelect(option.value)}
                >
                  <div className="flex items-center">
                    {option.icon && (
                      <span className="flex-shrink-0">{option.icon}</span>
                    )}
                    {option.color && (
                      <div className="h-3 w-3 flex-shrink-0 rounded-full mr-2" style={{ backgroundColor: option.color }} />
                    )}
                    <span className="text-gray-900">{option.label}</span>
                  </div>
                </div>
              ))}
              {canToggle && (
                <button
                  type="button"
                  onClick={() => setShowAll(prev => !prev)}
                  className="block w-full px-3 py-2 text-left text-sm font-medium text-sky-600 transition hover:bg-sky-50"
                >
                  {showAll ? 'Показать меньше' : `Показать все (${filteredOptions.length})`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
