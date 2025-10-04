'use client'

import { useState, useRef, useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { CityMarkerIcon } from '@/components/cities/CityMarkerIcon'
import { normaliseMarkerPreset } from '@/lib/utils/cityCoordinates'
import type { CityOption } from '@/lib/utils/cityOptions'

interface CityInputProps {
  value: string
  onChange: (value: string) => void
  onCitySelect?: (cityId: string) => void
  cityOptions: CityOption[]
  resolvedCity?: CityOption | null
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function CityInput({
  value,
  onChange,
  onCitySelect,
  cityOptions,
  resolvedCity,
  disabled = false,
  placeholder = "Введите город...",
  className
}: CityInputProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownTimeoutRef = useRef<number | null>(null)

  const filteredOptions = cityOptions.filter(option =>
    option.cityName.toLowerCase().includes(value.toLowerCase()) ||
    option.synonyms.some(synonym => synonym.toLowerCase().includes(value.toLowerCase()))
  ).slice(0, 6)

  const handleCitySelect = useCallback((option: CityOption) => {
    onChange(option.cityName)
    onCitySelect?.(option.cityId)
    setIsDropdownOpen(false)
    inputRef.current?.blur()
  }, [onChange, onCitySelect])

  const handleInputFocus = () => {
    if (dropdownTimeoutRef.current) {
      window.clearTimeout(dropdownTimeoutRef.current)
      dropdownTimeoutRef.current = null
    }
    if (filteredOptions.length > 0) {
      setIsDropdownOpen(true)
    }
  }

  const handleInputBlur = () => {
    dropdownTimeoutRef.current = window.setTimeout(() => {
      setIsDropdownOpen(false)
    }, 120)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!isDropdownOpen) {
        setIsDropdownOpen(true)
        setHighlightedIndex(0)
        return
      }
      if (filteredOptions.length > 0) {
        setHighlightedIndex(prev => (prev + 1) % filteredOptions.length)
      }
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isDropdownOpen) {
        setIsDropdownOpen(true)
        setHighlightedIndex(filteredOptions.length > 0 ? filteredOptions.length - 1 : 0)
        return
      }
      if (filteredOptions.length > 0) {
        setHighlightedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length)
      }
      return
    }

    if (event.key === 'Enter') {
      if (isDropdownOpen && filteredOptions[highlightedIndex]) {
        event.preventDefault()
        handleCitySelect(filteredOptions[highlightedIndex])
        return
      }
      return
    }

    if (event.key === 'Escape') {
      setIsDropdownOpen(false)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setIsDropdownOpen(Boolean(e.target.value))
          setHighlightedIndex(0)
        }}
        onKeyDown={handleKeyDown}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={resolvedCity?.isFavorite ? 'pl-14' : 'pl-10'}
      />
      
      <div className="pointer-events-none absolute left-3 inset-y-0 flex items-center gap-2">
        <CityMarkerIcon
          preset={resolvedCity ? normaliseMarkerPreset(resolvedCity.markerPreset) : undefined}
          active={resolvedCity ? resolvedCity.hasCoordinates : false}
        />
        {resolvedCity?.isFavorite && (
          <span className="text-amber-400">★</span>
        )}
      </div>

      {isDropdownOpen && filteredOptions.length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          <ul
            className="max-h-48 overflow-auto py-1"
            onMouseDown={(event) => event.preventDefault()}
          >
            {filteredOptions.map((option, index) => {
              const preset = option.markerPreset ? normaliseMarkerPreset(option.markerPreset) : undefined
              const secondaryLabels = option.synonyms
                .filter((synonym) => synonym !== option.cityName)
                .slice(0, 2)

              return (
                <li key={option.cityId}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition',
                      highlightedIndex === index
                        ? 'bg-sky-50 text-sky-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    )}
                    onClick={() => handleCitySelect(option)}
                  >
                    <CityMarkerIcon preset={preset} active={option.hasCoordinates} />
                    {option.isFavorite && (
                      <span className="text-amber-400">★</span>
                    )}
                    <span className="flex-1 truncate">{option.cityName}</span>
                    {secondaryLabels.length > 0 && (
                      <span className="max-w-[140px] truncate text-[11px] text-slate-400">
                        {secondaryLabels.join(', ')}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}