'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { formatAmount } from '@/lib/utils/formatNumber'

type CategoryBarChartProps = {
  data: Array<{
    name: string
    color: string
    amount: number
    count: number
  }>
  dataKey?: 'amount' | 'count'
}

export function CategoryBarChart({ data, dataKey = 'amount' }: CategoryBarChartProps) {
  const formatYAxis = (value: number) => {
    if (dataKey === 'amount') {
      return value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()
    }
    return value.toString()
  }

  const formatTooltipValue = (value: number) => {
    if (dataKey === 'amount') {
      return formatAmount(value)
    }
    return value
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis
            dataKey="name"
            className="text-sm text-gray-600"
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tickFormatter={formatYAxis}
            className="text-sm text-gray-600"
          />
          <Tooltip
            formatter={formatTooltipValue}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px 12px'
            }}
          />
          <Bar dataKey={dataKey} radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
