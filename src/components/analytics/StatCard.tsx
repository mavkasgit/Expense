import { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'

type StatCardProps = {
  title: string
  value: string | number
  icon?: ReactNode
  subtitle?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  color?: string
}

export function StatCard({ title, value, icon, subtitle, trend, color = 'blue' }: StatCardProps) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-100',
    green: 'text-green-600 bg-green-100',
    purple: 'text-purple-600 bg-purple-100',
    orange: 'text-orange-600 bg-orange-100',
    red: 'text-red-600 bg-red-100',
    indigo: 'text-indigo-600 bg-indigo-100'
  }

  const colorClass = colorClasses[color as keyof typeof colorClasses] || colorClasses.blue

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className={`text-3xl font-bold ${colorClass.split(' ')[0]}`}>{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center mt-2 text-sm ${trend.isPositive ? 'text-red-600' : 'text-green-600'}`}>
              <span className="font-medium">
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%
              </span>
              <span className="ml-1 text-gray-500">vs прошлый период</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`p-3 rounded-lg ${colorClass}`}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}
