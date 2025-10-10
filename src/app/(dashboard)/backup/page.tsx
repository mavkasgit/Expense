import { createServerClient } from '@/lib/supabase/server'
import { StickyPageHeaderWrapper } from '@/components/layout/StickyPageHeaderWrapper'
import { BackupPageContent } from '@/components/backup/BackupPageContent'

export default async function BackupPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-gray-50">
      <StickyPageHeaderWrapper
        title="Резервное копирование и восстановление данных"
        description="Создавайте резервные копии ваших данных и восстанавливайте их при необходимости"
      />
      <BackupPageContent />
    </div>
  )
}