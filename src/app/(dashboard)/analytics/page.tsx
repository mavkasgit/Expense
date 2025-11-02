import { StickyPageHeaderWrapper } from '@/components/layout/StickyPageHeaderWrapper'
import { AnalyticsContent } from '@/components/analytics/AnalyticsContent'

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <StickyPageHeaderWrapper
        title="Аналитика"
        description="Подробная статистика и визуализация ваших расходов"
      />
      
      <div className="container mx-auto px-4 py-8">
        <AnalyticsContent />
      </div>
    </div>
  )
}
