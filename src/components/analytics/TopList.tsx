import { formatAmount } from '@/lib/utils/formatNumber'
import { Card } from '@/components/ui/Card'

type TopListProps = {
  title: string
  data: Array<{
    name: string
    amount: number
    count: number
    percentage: number
    color?: string
  }>
  limit?: number
}

export function TopList({ title, data, limit = 5 }: TopListProps) {
  const displayData = data.slice(0, limit)

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-4">
        {displayData.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Нет данных</p>
        ) : (
          displayData.map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                  {item.color && (
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                  )}
                  <span className="text-sm font-medium text-gray-900">{item.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">
                    {formatAmount(item.amount)}
                  </div>
                  <div className="text-xs text-gray-500">{item.count} расходов</div>
                </div>
              </div>
              <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full rounded-full transition-all"
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: item.color || '#6366f1'
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
