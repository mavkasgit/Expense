import { createServerClient } from '@/lib/supabase/server'
import { StickyPageHeaderWrapper } from '@/components/layout/StickyPageHeaderWrapper'
import { getExpenseStats } from '@/lib/actions/expenses'
import { QuickExpenseForm } from '@/components/expense-input/QuickExpenseForm'
import { Card } from '@/components/ui/Card'
import { formatAmount } from '@/lib/utils/formatNumber'
import Link from 'next/link'

export default async function MainPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Загружаем статистику
  const statsResult = await getExpenseStats()
  const stats = statsResult.data

  return (
    <div className="min-h-screen bg-gray-50">
      <StickyPageHeaderWrapper
        title="Expense Tracker"
        description="Управление личными расходами"
      />
      
      <div className="container mx-auto px-4 py-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Быстрый ввод расхода */}
          <div className="lg:col-span-1 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Быстрый ввод
              </h2>
              <QuickExpenseForm />
            </div>
            <div>
              <Link
                href="/bulk-import"
                className="group bg-white rounded-lg shadow-md p-4 hover:shadow-xl transition-all duration-300 cursor-pointer hover:bg-gradient-to-br hover:from-orange-50 hover:to-orange-100 flex items-center w-full"
              >
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-orange-200 transition-colors">
                  <span className="text-2xl">📦</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 group-hover:text-orange-800 transition-colors">Массовый ввод</h2>
                  <p className="text-sm text-gray-600 group-hover:text-orange-700 transition-colors">Загрузка из файла или банковских выписок</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Статистика */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Статистика
            </h2>
            {stats ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatAmount(stats.totalAmount)}
                  </div>
                  <div className="text-sm text-gray-600">Всего потрачено</div>
                </Card>
                
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.totalCount}
                  </div>
                  <div className="text-sm text-gray-600">Всего расходов</div>
                </Card>
                
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {stats.categorizedCount}
                  </div>
                  <div className="text-sm text-gray-600">Категоризировано</div>
                </Card>
                
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {stats.uncategorizedCount}
                  </div>
                  <div className="text-sm text-gray-600">Без категории</div>
                </Card>
              </div>
            ) : (
              <Card className="p-6 text-center">
                <p className="text-gray-600">Нет данных для отображения</p>
              </Card>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}