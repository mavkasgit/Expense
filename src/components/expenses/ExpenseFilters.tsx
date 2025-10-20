'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DatePicker } from '@/components/ui/DatePicker'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { DateRangeSlider } from '@/components/ui/DateRangeSlider'
import { formatDateLocaleRu } from '@/lib/utils/dateUtils'
import type { Category } from '@/types'
import { cn } from '@/lib/utils'
import { availableIcons } from '@/lib/utils/category-constants'
import { CityMarkerIcon } from '@/components/cities/CityMarkerIcon'
import { normaliseMarkerPreset } from '@/lib/utils/cityCoordinates'
import type { CityOption } from '@/lib/utils/cityOptions'

interface Filters {
  search: string
  categoryId: string
  cityId: string
  dateFrom: string
  dateTo: string
  sortBy: string
}

interface ExpenseFiltersProps {
  filters: Filters
  onFilterChange: (filters: Partial<Filters>) => void
  onApply: () => void
  onReset: () => void
  categories: Category[]
  cities: CityOption[]
  expenseCount: number
  uncategorizedCount: number
  hideUncategorized: boolean
  onHideUncategorizedChange: (checked: boolean) => void
  isLoading: boolean
  dateRangeBounds: {min: string, max: string} | null
}

export function ExpenseFilters({ 
  filters, 
  onFilterChange, 
  onApply, 
  onReset, 
  categories, 
  cities,
  expenseCount,
  uncategorizedCount,
  hideUncategorized,
  onHideUncategorizedChange,
  isLoading,
  dateRangeBounds
}: ExpenseFiltersProps) {

  const sortOptions = [
    { value: 'date_desc', label: 'Сначала новые' },
    { value: 'date_asc', label: 'Сначала старые' },
    { value: 'amount_desc', label: 'Сначала дорогие' },
    { value: 'amount_asc', label: 'Сначала дешевые' },
  ]

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onApply()
    }
  }

  const handleSliderChange = (value: [number, number]) => {
    const [from, to] = value
    onFilterChange({
      dateFrom: new Date(from).toISOString().split('T')[0],
      dateTo: new Date(to).toISOString().split('T')[0],
    })
  }

  const sliderValue: [number, number] | undefined = dateRangeBounds
    ? [
        filters.dateFrom ? new Date(filters.dateFrom).getTime() : new Date(dateRangeBounds.min).getTime(),
        filters.dateTo ? new Date(filters.dateTo).getTime() : new Date(dateRangeBounds.max).getTime(),
      ]
    : undefined

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm mb-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Все расходы ({expenseCount})
        </h2>
        <div className="flex space-x-2">
          <Link href="/dashboard">
            <Button>Добавить расход</Button>
          </Link>
          <Link href="/bulk-import">
            <Button variant="outline">Массовый ввод</Button>
          </Link>
        </div>
      </div>

      {/* Сетка фильтров */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start border-t pt-4" onKeyDown={handleKeyDown}>
        {/* Column 1: Search & Filters */}
        <div className="space-y-4">
          <Input
            placeholder="Поиск по описанию..."
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            disabled={isLoading}
          />
          <SearchableSelect<Category>
            placeholder="Все категории"
            options={categories}
            value={filters.categoryId}
            onChange={(value) => onFilterChange({ categoryId: value || '' })}
            getOptionValue={(c) => c.id}
            getOptionLabel={(c) => c.name}
            getOptionColor={(c) => c.color}
            getOptionIcon={(c) => {
              const iconEmoji = availableIcons.find(i => i.key === c.icon)?.emoji || '📦'
              return <span className="mr-2 text-base">{iconEmoji}</span>
            }}
            allowClear
            disabled={isLoading}
          />
          <SearchableSelect<CityOption>
            placeholder="Все города"
            options={cities}
            value={filters.cityId}
            onChange={(value) => onFilterChange({ cityId: value || '' })}
            getOptionValue={(c) => c.cityId}
            getOptionLabel={(c) => c.cityName}
            allowClear
            disabled={isLoading}
            renderOption={(option) => {
              const preset = option.markerPreset ? normaliseMarkerPreset(option.markerPreset) : undefined
              const secondaryLabels = option.synonyms
                .filter((synonym) => synonym !== option.cityName)
                .slice(0, 2)

              return (
                <div className="flex w-full items-center gap-2 text-left">
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
                </div>
              )
            }}
          />
        </div>

        {/* Column 2: Sorting & Options */}
        <div className="space-y-4">
          <SearchableSelect<typeof sortOptions[0]>
            placeholder="Сортировка"
            options={sortOptions}
            value={filters.sortBy}
            onChange={(value) => onFilterChange({ sortBy: value || 'date_desc' })}
            getOptionValue={(o) => o.value}
            getOptionLabel={(o) => o.label}
            disabled={isLoading}
          />
          {uncategorizedCount > 0 && (
            <div className="flex items-center justify-center pt-2">
              <label className="flex items-center space-x-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideUncategorized}
                  onChange={(e) => onHideUncategorizedChange(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  disabled={isLoading}
                />
                <span className="text-gray-700">
                  Скрыть неопознанные ({uncategorizedCount})
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Column 3: Dates & Actions */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <DatePicker
              value={filters.dateFrom}
              onChange={(value) => onFilterChange({ dateFrom: value })}
              placeholder="Дата от"
              disabled={isLoading}
            />
            <DatePicker
              value={filters.dateTo}
              onChange={(value) => onFilterChange({ dateTo: value })}
              placeholder="Дата до"
              disabled={isLoading}
            />
          </div>
          {dateRangeBounds && sliderValue && (
            <div className="pt-2 px-1">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{formatDateLocaleRu(new Date(sliderValue[0]))}</span>
                <span>{formatDateLocaleRu(new Date(sliderValue[1]))}</span>
              </div>
              <DateRangeSlider
                value={sliderValue}
                min={new Date(dateRangeBounds.min).getTime()}
                max={new Date(dateRangeBounds.max).getTime()}
                onValueCommit={handleSliderChange}
                disabled={isLoading}
              />
            </div>
          )}
          <div className="flex items-center space-x-2 pt-2">
            <Button variant="outline" onClick={onReset} disabled={isLoading} className="w-full">Сбросить</Button>
            <Button onClick={onApply} isLoading={isLoading} className="w-full">Применить</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
