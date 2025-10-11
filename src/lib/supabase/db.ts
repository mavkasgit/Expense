// Простая обертка для операций с базой данных, обходящая проблемы с типизацией

// Создаем простые функции для операций с БД
export function dbInsert(supabase: any, table: string, data: any) {
  return (supabase.from(table) as any).insert(data)
}

export function dbUpdate(supabase: any, table: string, data: any) {
  return (supabase.from(table) as any).update(data)
}

export function dbUpsert(supabase: any, table: string, data: any, options?: any) {
  return (supabase.from(table) as any).upsert(data, options)
}

export function dbSelect(supabase: any, table: string, columns?: string) {
  return supabase.from(table).select(columns || '*')
}

export function dbDelete(supabase: any, table: string) {
  return supabase.from(table).delete()
}