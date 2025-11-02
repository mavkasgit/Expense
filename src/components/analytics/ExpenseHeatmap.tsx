'use client'

import { useMemo } from 'react'

type ExpenseHeatmapProps = {
  data: Array<{
    date: string
    amount: number
    count: number
  }>
  year?: number
}

export function ExpenseHeatmap({ data, year = new Date().getFullYear() }: ExpenseHeatmapProps) {
  const { monthsData, maxAmount } = useMemo(() => {
    const dataMap = new Map(data.map(d => [d.date, d]))
    const months: Array<Array<{ date: string; amount: number; count: number; dayOfWeek: number }>> = []
    
    let max = 0
    for (let month = 0; month < 12; month++) {
      const monthData: Array<{ date: string; amount: number; count: number; dayOfWeek: number }> = []
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const dayData = dataMap.get(date) || { date, amount: 0, count: 0 }
        const dayOfWeek = new Date(year, month, day).getDay()
        
        monthData.push({ ...dayData, dayOfWeek })
        
        if (dayData.amount > max) {
          max = dayData.amount
        }
      }
      
      months.push(monthData)
    }
    
    return { monthsData: months, maxAmount: max }
  }, [data, year])

  const getColor = (amount: number) => {
    if (amount === 0) return 'bg-gray-100'
    const intensity = Math.min(amount / maxAmount, 1)
    
    if (intensity < 0.2) return 'bg-blue-200'
    if (intensity < 0.4) return 'bg-blue-300'
    if (intensity < 0.6) return 'bg-blue-400'
    if (intensity < 0.8) return 'bg-blue-500'
    return 'bg-blue-600'
  }

  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-max">
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Календарь расходов {year}</h3>
        </div>
        <div className="grid grid-cols-12 gap-2">
          {monthsData.map((monthData, monthIndex) => (
            <div key={monthIndex} className="flex flex-col">
              <div className="text-xs font-medium text-gray-600 mb-1 text-center">
                {monthNames[monthIndex]}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: monthData[0].dayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="w-3 h-3" />
                ))}
                {monthData.map((day, dayIndex) => (
                  <div
                    key={dayIndex}
                    className={`w-3 h-3 rounded-sm ${getColor(day.amount)} cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all`}
                    title={`${day.date}: ${day.amount}₽ (${day.count} расходов)`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-600">
          <span>Меньше</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-gray-100 rounded-sm" />
            <div className="w-3 h-3 bg-blue-200 rounded-sm" />
            <div className="w-3 h-3 bg-blue-300 rounded-sm" />
            <div className="w-3 h-3 bg-blue-400 rounded-sm" />
            <div className="w-3 h-3 bg-blue-500 rounded-sm" />
            <div className="w-3 h-3 bg-blue-600 rounded-sm" />
          </div>
          <span>Больше</span>
        </div>
      </div>
    </div>
  )
}
