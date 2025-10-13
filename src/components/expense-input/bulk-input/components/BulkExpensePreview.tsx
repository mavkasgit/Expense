'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { batchExtractCities } from '@/lib/utils/cityParser'
import type { Category } from '@/types'
import type { BulkExpenseRowData } from '@/lib/validations/expenses'

interface BulkExpensePreviewProps {
  expenses: BulkExpenseRowData[]
  categories: Category[]
  onSave: () => void
  onCancel: () => void
  isSubmitting: boolean
}

export function BulkExpensePreview({
  expenses,
  categories,
  onSave,
  onCancel,
  isSubmitting
}: BulkExpensePreviewProps) {
  // Создаем карту категорий для быстрого поиска
  const categoryMap = useMemo(() => {
    return categories.reduce((map, category) => {
      map[category.id] = category
      return map
    }, {} as Record<string, Category>)
  }, [categories])

  // Вычисляем статистику
  const stats = useMemo(() => {
    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0)
    const categorizedCount = expenses.filter(expense => expense.category_id).length
    const uncategorizedCount = expenses.length - categorizedCount

    // Группировка по категориям
    const categoryStats = expenses.reduce((acc, expense) => {
      const categoryId = expense.category_id || 'uncategorized'
      const categoryName = expense.category_id
        ? categoryMap[expense.category_id]?.name || 'Неизвестная категория'
        : 'Автоопределение'

      if (!acc[categoryId]) {
        acc[categoryId] = {
          name: categoryName,
          count: 0,
          amount: 0,
          color: expense.category_id ? (categoryMap[expense.category_id]?.color || '#6b7280') : '#6b7280'
        }
      }

      acc[categoryId].count += 1
      acc[categoryId].amount += expense.amount

      return acc
    }, {} as Record<string, { name: string; count: number; amount: number; color?: string }>)

    // Статистика по городам (учитываем явное поле города и распознавание из описания)
    const cityStats = (() => {
      const statsMap = new Map<string, { display: string; count: number }>()

      const addCity = (key: string, display: string) => {
        const existing = statsMap.get(key)
        if (existing) {
          existing.count += 1
        } else {
          statsMap.set(key, { display, count: 1 })
        }
      }

      expenses.forEach(expense => {
        const cityValue = expense.city?.trim()
        if (cityValue) {
          addCity(cityValue.toUpperCase(), cityValue)
        }
      })

      const descriptionsToParse = expenses
        .filter(expense => !expense.city?.trim() && expense.description)
        .map(expense => expense.description || '')

      if (descriptionsToParse.length > 0) {
        const parsed = batchExtractCities(descriptionsToParse)
        parsed.forEach(result => {
          if (result.city && result.confidence > 0.5) {
            const display = result.displayCity || result.city
            addCity(result.city.toUpperCase(), display)
          }
        })
      }

      const result: Record<string, number> = {}
      statsMap.forEach(({ display, count }) => {
        result[display] = count
      })

      return result
    })()

    return {
      totalAmount,
      totalCount: expenses.length,
      categorizedCount,
      uncategorizedCount,
      categoryStats: Object.values(categoryStats),
      cityStats
    }
  }, [expenses, categoryMap])

  // Форматирование суммы
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  // Форматирование даты
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU')
  }

  return (
    <div className="space-y-6">
      {/* Общая статистика */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Сводка</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalCount}</div>
            <div className="text-sm text-gray-600">Всего расходов</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{formatAmount(stats.totalAmount)}</div>
            <div className="text-sm text-gray-600">Общая сумма</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.categorizedCount}</div>
            <div className="text-sm text-gray-600">С категорией</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.uncategorizedCount}</div>
            <div className="text-sm text-gray-600">Автоопределение</div>
          </div>
        </div>

        {/* Статистика по городам */}
        {Object.keys(stats.cityStats).length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Обнаруженные города:</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.cityStats)
                .sort(([,a], [,b]) => b - a)
                .map(([city, count]) => (
                  <div key={city} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                    📍 {city}: {count}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Разбивка по категориям */}
      {stats.categoryStats.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Разбивка по категориям</h3>
          <div className="space-y-2">
            {stats.categoryStats
              .sort((a, b) => b.amount - a.amount)
              .map((category, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: category.color || '#6b7280' }}
                    />
                    <span className="font-medium text-gray-900">{category.name}</span>
                    <span className="text-sm text-gray-500">({category.count} шт.)</span>
                  </div>
                  <div className="font-semibold text-gray-900">
                    {formatAmount(category.amount)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Предупреждения */}
      {stats.uncategorizedCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="text-yellow-600 text-xl">⚠️</div>
            <div>
              <h4 className="font-medium text-yellow-800">Внимание</h4>
              <p className="text-sm text-yellow-700 mt-1">
                {stats.uncategorizedCount} расходов будут обработаны системой автоопределения категорий.
                Система попытается определить категории по описанию, используя ключевые слова.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Список расходов для проверки */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Список расходов</h3>
        <div className="max-h-64 overflow-y-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Дата</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Время</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Описание</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Город</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Категория</th>
                <th className="px-3 py-2 text-right font-medium text-gray-700">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense, index) => {
                const category = expense.category_id ? categoryMap[expense.category_id] : null

                return (
                  <tr key={expense.tempId || index} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-600">
                      {formatDate(expense.expense_date)}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-sm">
                      {expense.expense_time ? expense.expense_time.slice(0, 5) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">{expense.description}</div>
                      {expense.notes && (
                        <div className="text-xs text-gray-500 mt-1">{expense.notes}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {expense.city?.trim() || '—'}
                    </td>
                    <td className="px-3 py-2">
                      {category ? (
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: category.color || '#6b7280' }}
                          />
                          <span className="text-gray-900">{category.name}</span>
                        </div>
                      ) : (
                        <span className="text-orange-600 text-sm">Автоопределение</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      {formatAmount(expense.amount)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Кнопки действий */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Отмена
        </Button>
        <Button
          variant="primary"
          onClick={onSave}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Сохранение...' : `Сохранить ${stats.totalCount} расходов`}
        </Button>
      </div>
    </div>
  )
}