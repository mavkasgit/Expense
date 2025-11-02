import { Card } from '@/components/ui/Card'
import { formatAmount } from '@/lib/utils/formatNumber'

type PeriodComparisonCardProps = {
  current: {
    amount: number
    count: number
  }
  previous: {
    amount: number
    count: number
  }
  change: {
    amount: number
    amountPercent: number
    count: number
    countPercent: number
  }
  currentLabel?: string
  previousLabel?: string
}

export function PeriodComparisonCard({
  current,
  previous,
  change,
  currentLabel = 'Текущий период',
  previousLabel = 'Прошлый период'
}: PeriodComparisonCardProps) {
  const isAmountIncreased = change.amount > 0
  const isCountIncreased = change.count > 0

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Сравнение периодов</h3>
      
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <p className="text-sm text-gray-600 mb-2">{currentLabel}</p>
          <p className="text-2xl font-bold text-gray-900">{formatAmount(current.amount)}</p>
          <p className="text-sm text-gray-500">{current.count} расходов</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 mb-2">{previousLabel}</p>
          <p className="text-2xl font-bold text-gray-400">{formatAmount(previous.amount)}</p>
          <p className="text-sm text-gray-400">{previous.count} расходов</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <span className="text-sm font-medium text-gray-700">Изменение суммы</span>
          <div className="text-right">
            <p className={`text-lg font-semibold ${isAmountIncreased ? 'text-red-600' : 'text-green-600'}`}>
              {isAmountIncreased ? '+' : ''}{formatAmount(change.amount)}
            </p>
            <p className={`text-sm ${isAmountIncreased ? 'text-red-600' : 'text-green-600'}`}>
              {isAmountIncreased ? '↑' : '↓'} {Math.abs(change.amountPercent).toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <span className="text-sm font-medium text-gray-700">Изменение количества</span>
          <div className="text-right">
            <p className={`text-lg font-semibold ${isCountIncreased ? 'text-blue-600' : 'text-gray-600'}`}>
              {isCountIncreased ? '+' : ''}{change.count}
            </p>
            <p className={`text-sm ${isCountIncreased ? 'text-blue-600' : 'text-gray-600'}`}>
              {isCountIncreased ? '↑' : '↓'} {Math.abs(change.countPercent).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
