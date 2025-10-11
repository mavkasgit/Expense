// Временное решение для обхода проблем с типизацией Supabase
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types'

// Типизированные обертки для операций с базой данных
export function createTypedClient(supabase: SupabaseClient<Database>) {
  return {
    // Обертка для insert операций
    insert: <T extends keyof Database['public']['Tables']>(
      table: T,
      data: Database['public']['Tables'][T]['Insert'] | Database['public']['Tables'][T]['Insert'][]
    ) => {
      return (supabase.from(table) as any).insert(data)
    },

    // Обертка для update операций  
    update: <T extends keyof Database['public']['Tables']>(
      table: T,
      data: Database['public']['Tables'][T]['Update']
    ) => {
      return (supabase.from(table) as any).update(data)
    },

    // Обертка для select операций
    select: <T extends keyof Database['public']['Tables']>(
      table: T,
      columns?: string
    ) => {
      return supabase.from(table).select(columns || '*')
    },

    // Обертка для delete операций
    delete: <T extends keyof Database['public']['Tables']>(table: T) => {
      return supabase.from(table).delete()
    },

    // Обертка для upsert операций
    upsert: <T extends keyof Database['public']['Tables']>(
      table: T,
      data: Database['public']['Tables'][T]['Insert'] | Database['public']['Tables'][T]['Insert'][],
      options?: any
    ) => {
      return (supabase.from(table) as any).upsert(data, options)
    }
  }
}