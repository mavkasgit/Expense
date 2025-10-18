'use client'

import { useState, useCallback, useRef, useMemo, useEffect, memo } from 'react'
import type { CityOption } from '@/lib/utils/cityOptions'
import { CityMarkerIcon } from '@/components/cities/CityMarkerIcon'
import { normaliseMarkerPreset } from '@/lib/utils/cityCoordinates'

interface CityCellProps {
  value: string
  cityId: string | null | undefined
  error?: string
  onValueChange: (value: string) => void
  onCityIdChange: (cityId: string | null) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  onFocus: () => void
  onBlur?: () => void
  cityOptions: CityOption[]
  cityLookupById: Map<string, CityOption>
  resolveCityByInput: (value: string) => CityOption | null
}

function CityCellComponent({
  value,
  cityId,
  error,
  onValueChange,
  onCityIdChange,
  onKeyDown,
  onFocus,
  onBlur,
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

    if (!query) {
      const favorites = cityOptions.filter(option => option.isFavorite)
      if (favorites.length > 0) {
        return favorites.slice(0, 6)
      }
      return cityOptions.slice(0, 6)
    }

    if (resolvedCity && query === resolvedCity.cityName.toLowerCase()) {
      const favorites = cityOptions.filter(option => option.isFavorite)
      return favorites.length > 0 ? favorites : (resolvedCity ? [resolvedCity] : [])
    }

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

  const handleChange = useCallback((nextValue: string) => {
    const match = resolveCityByInput(nextValue)
    onValueChange(nextValue)
    onCityIdChange(match?.cityId ?? null)
    setIsOpen(Boolean(nextValue))
    setHighlightedIndex(0)
  }, [resolveCityByInput, onValueChange, onCityIdChange])

  const handleSelect = useCallback((option: CityOption) => {
    onValueChange(option.cityName)
    onCityIdChange(option.cityId)
    setIsOpen(false)
  }, [onValueChange, onCityIdChange])

  const handleFocus = useCallback(() => {
    if (dropdownTimeoutRef.current) {
      window.clearTimeout(dropdownTimeoutRef.current)
      dropdownTimeoutRef.current = null
    }
    onFocus()
    setIsOpen(true)
  }, [onFocus])

  const handleBlur = useCallback(() => {
    dropdownTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false)
      if (onBlur) {
        onBlur()
      }
    }, 120)
  }, [onBlur])

  const handleInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
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
        setHighlightedIndex(filteredCityOptions.length - 1)
        return
      }
      if (filteredCityOptions.length > 0) {
        setHighlightedIndex((prev) => (prev - 1 + filteredCityOptions.length) % filteredCityOptions.length)
      }
      return
    }

    if (event.key === 'Enter') {
      if (isOpen && filteredCityOptions.length > 0 && filteredCityOptions[highlightedIndex]) {
        event.preventDefault()
        handleSelect(filteredCityOptions[highlightedIndex])
        return
      }
      onKeyDown(event)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setIsOpen(false)
      return
    }

    onKeyDown(event)
  }, [isOpen, filteredCityOptions, highlightedIndex, handleSelect, onKeyDown])

  const displayValue = useMemo(() => {
    if (resolvedCity) {
      return resolvedCity.cityName
    }
    return value
  }, [resolvedCity, value])

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleInputKeyDown}
        className={`w-full rounded-md border py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
          error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
        } ${resolvedCity?.isFavorite ? 'pl-14' : 'pl-10'} pr-3`}
        placeholder="Начните вводить город..."
        autoComplete="off"
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

      {isOpen && filteredCityOptions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {filteredCityOptions.map((option, index) => {
            const preset = option.markerPreset ? normaliseMarkerPreset(option.markerPreset) : undefined
            
            return (
              <button
                key={option.cityId}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(option)
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                  index === highlightedIndex
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <CityMarkerIcon
                  preset={preset}
                  active={option.hasCoordinates}
                  size="sm"
                />
                <span className="flex-1">{option.cityName}</span>
                {option.isFavorite && (
                  <span className="text-xs text-yellow-500" title="Избранное">
                    ⭐
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}

// Мемоизация: ререндерим только при изменении value, cityId или error
export const CityCellMemo = memo(CityCellComponent)

CityCellMemo.displayName = 'CityCellMemo'
