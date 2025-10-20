import { Suspense } from 'react'
import { getExpenses } from '@/lib/actions/expenses'
import { getCategories } from '@/lib/actions/categories'
import { getCities } from '@/lib/actions/cities'
import { StickyPageHeaderWrapper } from '@/components/layout/StickyPageHeaderWrapper'
import { ExpensesPageContent } from '@/components/expenses/ExpensesPageContent'

async function ExpensesPage() {
  const [expensesResult, categoriesResult, citiesResult] = await Promise.all([
    getExpenses({ limit: 50 }),
    getCategories(),
    getCities(),
  ])

  const expenses = expensesResult.data || []
  const categories = categoriesResult.data || []
  const cities = citiesResult.data || []

  return (
    <div className="min-h-screen bg-gray-50">
      <StickyPageHeaderWrapper 
        title="Расходы"
        description="Просмотр и управление вашими расходами"
      />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <ExpensesPageContent 
            initialExpenses={expenses}
            categories={categories}
            cities={cities}
            error={expensesResult.error}
          />
        </div>
      </div>
    </div>
  )
}

export default function ExpensesPageWithSuspense() {
  return (
    <Suspense fallback={null}>
      <ExpensesPage />
    </Suspense>
  )
}