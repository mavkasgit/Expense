import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getCategories } from '@/lib/actions/categories'
import { BulkExpenseInput } from '@/components/expense-input/bulk-input'
import { StickyPageHeaderWrapper } from '@/components/layout/StickyPageHeaderWrapper'
import { StickyPageHeader } from '@/components/layout/StickyPageHeader'

async function BulkExpensePage() {
  const supabase = await createServerClient()
  
  // Проверяем аутентификацию
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/login')
  }

  // Получаем категории пользователя
  const categoriesResult = await getCategories()
  
  if (categoriesResult.error) {
    throw new Error(categoriesResult.error)
  }

  const categories = categoriesResult.data || []

  return (
    <div className="min-h-screen bg-gray-50">
      <StickyPageHeaderWrapper
        title="Массовый ввод и банковские выписки"
        description="Добавьте несколько расходов одновременно или загрузите банковскую выписку"
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BulkExpenseInput 
          categories={categories}
        />
      </main>
      

    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50">
      <StickyPageHeader
        title="Массовый ввод и банковские выписки"
        description="Загрузка..."
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <BulkExpensePage />
    </Suspense>
  )
}