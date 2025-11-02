'use client'

import { useState, useEffect } from 'react'
import { TimeSeriesChart } from './TimeSeriesChart'
import { CategoryPieChart } from './CategoryPieChart'
import { CategoryBarChart } from './CategoryBarChart'
import { ExpenseHeatmap } from './ExpenseHeatmap'
import { StatCard } from './StatCard'
import { TopList } from './TopList'
import { PeriodComparisonCard } from './PeriodComparisonCard'
import { Card } from '@/components/ui/Card'
import { formatAmount } from '@/lib/utils/formatNumber'
import {
  getTimeSeriesData,
  getCategoryAnalytics,
  getCityAnalytics,
  getPeriodComparison,
  getExpenseHeatmap,
  type TimeSeriesData,
  type CategoryAnalytics,
  type CityAnalytics,
  type PeriodComparison
} from '@/lib/actions/analytics'
import { getExpenseStats } from '@/lib/actions/expenses'

type PeriodFilter = '7d' | '30d' | '90d' | '1y' | 'all'

export function AnalyticsContent() {
  const [period, setPeriod] = useState<PeriodFilter>('30d')
  const [loading, setLoading] = useState(true)
  
  const [stats, setStats] = useState<any>(null)
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([])
  const [categoryData, setCategoryData] = useState<CategoryAnalytics[]>([])
  const [cityData, setCityData] = useState<CityAnalytics[]>([])
  const [comparison, setComparison] = useState<PeriodComparison | null>(null)
  const [heatmapData, setHeatmapData] = useState<Array<{ date: string; amount: number; count: number }>>([])

  const [viewMode, setViewMode] = useState<'overview' | 'categories' | 'cities' | 'trends'>('overview')

  const getDateRange = (period: PeriodFilter) => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    
    let dateFrom = ''
    
    switch (period) {
      case '7d':
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        break
      case '30d':
        dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        break
      case '90d':
        dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        break
      case '1y':
        dateFrom = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        break
      case 'all':
        return { dateFrom: undefined, dateTo: undefined }
    }
    
    return { dateFrom, dateTo: today }
  }

  const loadData = async () => {
    setLoading(true)
    const { dateFrom, dateTo } = getDateRange(period)

    try {
      const [statsRes, timeSeriesRes, categoryRes, cityRes, heatmapRes] = await Promise.all([
        getExpenseStats({ date_from: dateFrom, date_to: dateTo }),
        getTimeSeriesData({ dateFrom, dateTo, groupBy: period === '7d' ? 'day' : period === '30d' ? 'day' : 'week' }),
        getCategoryAnalytics({ dateFrom, dateTo, limit: 10 }),
        getCityAnalytics({ dateFrom, dateTo, limit: 10 }),
        getExpenseHeatmap({ dateFrom: period === '1y' ? dateFrom : undefined, dateTo })
      ])

      if ('data' in statsRes) setStats(statsRes.data)
      if ('data' in timeSeriesRes) setTimeSeriesData(timeSeriesRes.data)
      if ('data' in categoryRes) setCategoryData(categoryRes.data)
      if ('data' in cityRes) setCityData(cityRes.data)
      if ('data' in heatmapRes) setHeatmapData(heatmapRes.data)

      if (period !== 'all') {
        const now = new Date()
        const currentFrom = dateFrom!
        const currentTo = dateTo!
        
        const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365
        const previousTo = new Date(new Date(currentFrom).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const previousFrom = new Date(new Date(currentFrom).getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        
        const comparisonRes = await getPeriodComparison(currentFrom, currentTo, previousFrom, previousTo)
        if ('data' in comparisonRes) setComparison(comparisonRes.data)
      }
    } catch (error) {
      console.error('Ошибка загрузки аналитики:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Загрузка аналитики...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {(['7d', '30d', '90d', '1y', 'all'] as PeriodFilter[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {p === '7d' && 'Неделя'}
              {p === '30d' && 'Месяц'}
              {p === '90d' && '3 месяца'}
              {p === '1y' && 'Год'}
              {p === 'all' && 'Все время'}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {(['overview', 'categories', 'cities', 'trends'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {mode === 'overview' && 'Обзор'}
              {mode === 'categories' && 'Категории'}
              {mode === 'cities' && 'Города'}
              {mode === 'trends' && 'Тренды'}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Всего потрачено"
              value={formatAmount(stats?.totalAmount || 0)}
              color="blue"
              icon={<span className="text-2xl">💰</span>}
              trend={comparison ? {
                value: comparison.change.amountPercent,
                isPositive: comparison.change.amount > 0
              } : undefined}
            />
            <StatCard
              title="Всего расходов"
              value={stats?.totalCount || 0}
              color="green"
              icon={<span className="text-2xl">📊</span>}
              trend={comparison ? {
                value: comparison.change.countPercent,
                isPositive: comparison.change.count > 0
              } : undefined}
            />
            <StatCard
              title="Категоризировано"
              value={stats?.categorizedCount || 0}
              color="purple"
              icon={<span className="text-2xl">✅</span>}
              subtitle={`${((stats?.categorizedCount || 0) / (stats?.totalCount || 1) * 100).toFixed(1)}%`}
            />
            <StatCard
              title="Без категории"
              value={stats?.uncategorizedCount || 0}
              color="orange"
              icon={<span className="text-2xl">❓</span>}
              subtitle={`${((stats?.uncategorizedCount || 0) / (stats?.totalCount || 1) * 100).toFixed(1)}%`}
            />
          </div>

          {comparison && (
            <PeriodComparisonCard
              current={comparison.current}
              previous={comparison.previous}
              change={comparison.change}
              currentLabel={period === '7d' ? 'Эта неделя' : period === '30d' ? 'Этот месяц' : 'Текущий период'}
              previousLabel={period === '7d' ? 'Прошлая неделя' : period === '30d' ? 'Прошлый месяц' : 'Прошлый период'}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopList
              title="🏆 Топ категорий"
              data={categoryData}
              limit={5}
            />
            <TopList
              title="🌍 Топ городов"
              data={cityData}
              limit={5}
            />
          </div>
        </>
      )}

      {viewMode === 'categories' && (
        <>
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Распределение по категориям (Pie)</h3>
            {categoryData.length > 0 ? (
              <CategoryPieChart data={categoryData} />
            ) : (
              <p className="text-gray-500 text-center py-8">Нет данных для отображения</p>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Расходы по категориям (Bar)</h3>
            {categoryData.length > 0 ? (
              <CategoryBarChart data={categoryData} dataKey="amount" />
            ) : (
              <p className="text-gray-500 text-center py-8">Нет данных для отображения</p>
            )}
          </Card>

          <TopList
            title="📋 Полный список категорий"
            data={categoryData}
            limit={20}
          />
        </>
      )}

      {viewMode === 'cities' && (
        <>
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Расходы по городам</h3>
            {cityData.length > 0 ? (
              <CategoryBarChart
                data={cityData.map(c => ({ ...c, color: '#6366f1' }))}
                dataKey="amount"
              />
            ) : (
              <p className="text-gray-500 text-center py-8">Нет данных для отображения</p>
            )}
          </Card>

          <TopList
            title="📍 Полный список городов"
            data={cityData.map(c => ({ ...c, color: '#6366f1' }))}
            limit={20}
          />
        </>
      )}

      {viewMode === 'trends' && (
        <>
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Динамика расходов во времени</h3>
            {timeSeriesData.length > 0 ? (
              <TimeSeriesChart data={timeSeriesData} showCount={false} />
            ) : (
              <p className="text-gray-500 text-center py-8">Нет данных для отображения</p>
            )}
          </Card>

          {period === '1y' && heatmapData.length > 0 && (
            <Card className="p-6">
              <ExpenseHeatmap data={heatmapData} year={new Date().getFullYear()} />
            </Card>
          )}
        </>
      )}
    </div>
  )
}
