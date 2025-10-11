// Обертка для Supabase клиента, обходящая проблемы с типизацией
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types'

// Создаем обертку для клиента, которая обходит проблемы с типами
export function createSafeSupabaseClient(supabase: SupabaseClient<Database, "public", any>) {
  return {
    // Оригинальный клиент для операций select (они работают нормально)
    from: (table: keyof Database['public']['Tables']) => ({
      select: (columns?: string) => supabase.from(table).select(columns || '*'),
      delete: () => supabase.from(table).delete(),
      eq: (column: string, value: any) => (supabase.from(table) as any).eq(column, value),
      // Безопасные операции с обходом типизации
      insert: (data: any) => (supabase.from(table) as any).insert(data),
      update: (data: any) => (supabase.from(table) as any).update(data),
      upsert: (data: any, options?: any) => (supabase.from(table) as any).upsert(data, options),
    }),
    
    // Остальные методы клиента
    auth: supabase.auth,
    storage: supabase.storage,
    rpc: supabase.rpc,
  }
}