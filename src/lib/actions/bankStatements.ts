'use server'

import { createServerClient } from '@/lib/supabase/server'
// Используем безопасный клиент вместо db helpers

export async function createBankStatement(data: {
  id: string;
  filename: string;
  file_type: string;
  total_records: number;
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'User not authenticated' }
  }

  const { error } = await (supabase as any)
    .from('bank_statements')
    .insert({
      id: data.id,
      filename: data.filename,
    file_type: data.file_type,
    total_records: data.total_records,
    user_id: user.id,
    status: 'processing',
    upload_date: new Date().toISOString(),
  })

  if (error) {
    console.error('Error creating bank statement record:', error)
    return { error: 'Failed to create bank statement record' }
  }

  return { success: true, id: data.id }
}
