'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { UnrecognizedKeywordsSection } from './UnrecognizedKeywordsSection'
import { ExpenseEditModal } from './ExpenseEditModal'
import { InlineNotesEditor } from './InlineNotesEditor'
import { formatAmount } from '@/lib/utils/formatNumber'
import { formatDateLocaleRu } from '@/lib/utils/dateUtils'
import { useToast } from '@/hooks/useToast'
import type { Category, ExpenseWithCategory } from '@/types'
import Link from 'next/link'
import { CityMarkerIcon } from '@/components/cities/CityMarkerIcon'
import { hasGeoPoint, normaliseMarkerPreset, parseCityCoordinates } from '@/lib/utils/cityCoordinates'
import type { City } from '@/types'

interface ExpensesPageContentProps {
  initialExpenses: ExpenseWithCategory[]
  categories: Category[]
  cities: City[]
  error?: string
}

export function ExpensesPageContent({ 
  initialExpenses, 
  categories, 
  cities,
  error 
}: ExpensesPageContentProps) {
  const [showUnrecognizedKeywords, setShowUnrecognizedKeywords] = useState(true)
  const [hideUncategorized, setHideUncategorized] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseWithCategory | null>(null)
  const [expenses, setExpenses] = useState(initialExpenses)
  const { showToast } = useToast()

  if (error) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Ошибка загрузки</h1>
        <p className="text-gray-600 mb-6">{error}</p>
        <Link href="/dashboard">
          <Button>Вернуться на главную</Button>
        </Link>
      </div>
    )
  }

  // Фильтруем расходы в зависимости от настроек
  const filteredExpenses = hideUncategorized 
    ? expenses.filter(expense => expense.status !== 'uncategorized')
    : expenses

  const uncategorizedCount = expenses.filter(expense => expense.status === 'uncategorized').length

  // Обработка успешного обновления расхода
  const handleExpenseUpdate = (updatedExpense: ExpenseWithCategory) => {
    setExpenses(prev => prev.map(expense => 
      expense.id === updatedExpense.id ? updatedExpense : expense
    ))
  }

  if (expenses.length === 0) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Нет расходов
        </h2>
        <p className="text-gray-600 mb-6">
          Начните отслеживать свои расходы, добавив первую запись.
        </p>
        <div className="space-y-3">
          <Link href="/dashboard">
            <Button className="w-full">
              Добавить первый расход
            </Button>
          </Link>
          <Link href="/expenses/bulk">
            <Button variant="outline" className="w-full">
              Массовый ввод расходов
            </Button>
          </Link>

          {categories.length === 0 && (
            <Link href="/categories">
              <Button variant="outline" className="w-full">
                Сначала создать категории
              </Button>
            </Link>
          )}
        </div>
      </Card>
    )
  }

  return (
    <>
      {/* Секция неопознанных ключевых слов */}
      <UnrecognizedKeywordsSection
        categories={categories}
        isVisible={showUnrecognizedKeywords}
        onToggleVisibility={() => setShowUnrecognizedKeywords(!showUnrecognizedKeywords)}
      />

      {/* Фильтры и действия */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Все расходы ({filteredExpenses.length})
          </h2>
          {uncategorizedCount > 0 && (
            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={hideUncategorized}
                  onChange={(e) => setHideUncategorized(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">
                  Скрыть неопознанные ({uncategorizedCount})
                </span>
              </label>
            </div>
          )}
        </div>
        
        <div className="flex space-x-2">
          <Link href="/dashboard">
            <Button>Добавить расход</Button>
          </Link>
          <Link href="/expenses/bulk">
            <Button variant="outline">Массовый ввод</Button>
          </Link>
        </div>
      </div>

      {/* Список расходов */}
      <div className="space-y-2">
        {filteredExpenses.map((expense) => {
          const cityCoordinates = expense.city ? parseCityCoordinates(expense.city.coordinates ?? null) : null
          const markerPreset = cityCoordinates ? normaliseMarkerPreset(cityCoordinates.markerPreset) : undefined
          const hasCityPoint = cityCoordinates ? hasGeoPoint(cityCoordinates) : false
          const cityLabel = expense.city?.name ?? expense.raw_city_input ?? null

          return (
            <Card key={expense.id} className="p-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Сумма */}
              <div className="text-lg font-semibold text-gray-900 flex-shrink-0">
                {formatAmount(expense.amount)}
              </div>
              
              {/* Категория */}
              <div className="flex-shrink-0">
                {expense.category ? (
                  <div 
                    className="px-2 py-1 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: expense.category.color || '#6366f1' }}
                  >
                    {expense.category.name}
                  </div>
                ) : (
                  <div className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    Неопознанный
                  </div>
                )}
              </div>

              {/* Ключевые слова */}
              <div className="flex-shrink-0">
                {expense.matched_keywords && expense.matched_keywords.length > 0 ? (
                  <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                    {expense.matched_keywords.join(', ')}
                  </div>
                ) : expense.auto_categorized ? (
                  <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Авто
                  </div>
                ) : null}
              </div>

              {/* Город */}
              <div className="flex-shrink-0">
                {cityLabel && (
                  <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                    <CityMarkerIcon preset={markerPreset} active={hasCityPoint} />
                    <span className="max-w-[140px] truncate">{cityLabel}</span>
                  </div>
                )}
              </div>

              {/* Примечание - редактируемое поле */}
              <InlineNotesEditor
                expense={expense}
                onUpdate={handleExpenseUpdate}
              />

              {/* Дата и время */}
              <div className="text-sm text-gray-500 flex-shrink-0">
                {formatDateLocaleRu(expense.expense_date)}
                {expense.expense_time && (
                  <span className="ml-1 text-xs text-gray-400">
                    {expense.expense_time.slice(0, 5)}
                  </span>
                )}
              </div>

              {/* Кнопка изменения */}
              <div className="flex-shrink-0">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setEditingExpense(expense)}
                  className="text-xs px-2 py-1"
                >
                  ⚙️
                </Button>
              </div>
            </div>

            {/* Описание под основной строкой, если есть */}
            {expense.description && (
              <div className="text-sm text-gray-600 mt-2 pl-2 border-l-2 border-gray-200">
                {expense.description}
              </div>
            )}
            </Card>
          )
        })}
        
        {filteredExpenses.length === 0 && hideUncategorized && (
          <Card className="p-8 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Все расходы скрыты
            </h3>
            <p className="text-gray-600 mb-4">
              Все ваши расходы являются неопознанными. Снимите фильтр или назначьте категории ключевым словам выше.
            </p>
            <Button 
              variant="outline" 
              onClick={() => setHideUncategorized(false)}
            >
              Показать все расходы
            </Button>
          </Card>
        )}
        
        {filteredExpenses.length >= 50 && (
          <div className="text-center pt-4">
            <Button variant="outline">
              Загрузить еще
            </Button>
          </div>
        )}
      </div>

      {/* Модал редактирования расхода */}
      {editingExpense && (
        <ExpenseEditModal
          expense={editingExpense}
          categories={categories}
          cities={cities}
          isOpen={!!editingExpense}
          onClose={() => setEditingExpense(null)}
          onSuccess={handleExpenseUpdate}
        />
      )}
    </>
  )
}
