'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { expenseSchema, updateExpenseSchema } from '@/lib/validations/expenses'
import { categorizeExpense } from '@/lib/actions/keywords'
import type { CreateExpenseData } from '@/types'
import type { UpdateExpenseData } from '@/lib/validations/expenses'

export async function createExpense(data: CreateExpenseData) {
  const supabase = await createServerClient()

  try {
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    // Проверяем данные
    const validatedData = expenseSchema.parse(data)

    const resolveCityByInput = async (value: string) => {
      const normalized = value.trim()
      if (!normalized) {
        return null
      }

      const { data: directCity } = await supabase
        .from('cities')
        .select('id, name')
        .eq('user_id', user.id)
        .ilike('name', normalized)
        .maybeSingle()

      if (directCity?.id) {
        return directCity
      }

      const { data: synonymMatch } = await supabase
        .from('city_synonyms')
        .select('city_id, city:cities(id, name)')
        .eq('user_id', user.id)
        .ilike('synonym', normalized)
        .maybeSingle()

      if (synonymMatch?.city) {
        return synonymMatch.city as { id: string; name: string }
      }

      return null
    }

    const rememberUnrecognizedCity = async (value: string) => {
      const normalized = value.trim()
      if (!normalized) {
        return
      }

      try {
        const { data: existing } = await supabase
          .from('unrecognized_cities')
          .select('id, frequency')
          .eq('user_id', user.id)
          .ilike('name', normalized)
          .maybeSingle()

        const now = new Date().toISOString()

        if (existing?.id) {
          await supabase
            .from('unrecognized_cities')
            .update({
              frequency: (existing.frequency ?? 0) + 1,
              last_seen: now
            })
            .eq('id', existing.id)
        } else {
          await supabase
            .from('unrecognized_cities')
            .insert({
              user_id: user.id,
              name: normalized,
              frequency: 1,
              first_seen: now,
              last_seen: now
            })
        }
      } catch (rememberError) {
        console.error('Не удалось сохранить непознанный город', rememberError)
      }
    }

    const trimmedCityInput = (validatedData.city_input ?? '').trim()
    let resolvedCityId: string | null = null

    if (validatedData.city_id) {
      const { data: existingCity } = await supabase
        .from('cities')
        .select('id')
        .eq('id', validatedData.city_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingCity?.id) {
        resolvedCityId = existingCity.id
      }
    }

    if (!resolvedCityId && trimmedCityInput) {
      const matchedCity = await resolveCityByInput(trimmedCityInput)
      if (matchedCity?.id) {
        resolvedCityId = matchedCity.id
      } else {
        await rememberUnrecognizedCity(trimmedCityInput)
      }
    }

    const rawCityInput = trimmedCityInput || null

    // Автоматическая категоризация по описанию
    let finalCategoryId: string | null = null
    let matchedKeywords: string[] = []
    let autoCategorized = false

    // Всегда пытаемся категоризировать по описанию
    const categorizationResult = await categorizeExpense(validatedData.description)
    if (categorizationResult.category_id) {
      finalCategoryId = categorizationResult.category_id
      matchedKeywords = categorizationResult.matched_keywords
      autoCategorized = categorizationResult.auto_categorized
    }

    // Определяем статус расхода
    const status = finalCategoryId ? 'categorized' : 'uncategorized'

    // Создаем расход
    const { data: expense, error } = await supabase
      .from('expenses')
      .insert({
        user_id: user.id,
        amount: validatedData.amount,
        description: validatedData.description || null,
        notes: validatedData.notes || null,
        category_id: finalCategoryId || null,
        expense_date: validatedData.expense_date,
        expense_time: validatedData.expense_time || null,
        input_method: validatedData.input_method,
        batch_id: validatedData.batch_id || null,
        status,
        matched_keywords: matchedKeywords.length > 0 ? matchedKeywords : null,
        auto_categorized: autoCategorized,
        city_id: resolvedCityId,
        raw_city_input: rawCityInput
      })
      .select(`
        *,
        category:categories(*),
        city:cities(id, name, coordinates)
      `)
      .single()

    if (error) {
      console.error('Ошибка создания расхода:', error)
      return { error: 'Не удалось создать расход' }
    }

    revalidatePath('/expenses')
    revalidatePath('/dashboard')
    return { success: true, data: expense }
  } catch (err) {
    console.error('Ошибка валидации расхода:', err)
    return { error: 'Неверные данные расхода' }
  }
}

export async function updateExpense(id: string, data: UpdateExpenseData) {
  const supabase = await createServerClient()

  try {
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    // Проверяем данные
    const validatedData = updateExpenseSchema.parse(data)

    // Получаем текущий расход для проверки прав доступа
    const { data: currentExpense, error: fetchError } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !currentExpense) {
      return { error: 'Расход не найден' }
    }

    // Если изменяется описание, пересчитываем категоризацию
    let updateData: any = {
      ...validatedData,
      updated_at: new Date().toISOString()
    }

    if (validatedData.description !== undefined && validatedData.description !== currentExpense.description) {
      if (validatedData.description && !validatedData.category_id) {
        const categorizationResult = await categorizeExpense(validatedData.description)
        if (categorizationResult.category_id) {
          updateData.category_id = categorizationResult.category_id
          updateData.matched_keywords = categorizationResult.matched_keywords
          updateData.auto_categorized = categorizationResult.auto_categorized
          updateData.status = 'categorized'
        } else {
          updateData.status = 'uncategorized'
          updateData.matched_keywords = null
          updateData.auto_categorized = false
        }
      }
    }

    // Если категория изменяется вручную, обновляем статус
    if (validatedData.category_id !== undefined) {
      if (validatedData.category_id === null) {
        updateData.status = 'uncategorized'
        updateData.category_id = null
        updateData.auto_categorized = false
        updateData.matched_keywords = null
      } else {
        updateData.status = 'categorized'
        updateData.auto_categorized = false
        updateData.matched_keywords = null
      }
    }

    if (validatedData.city_input !== undefined) {
      const resolveCityByInput = async (value: string) => {
        const normalized = value.trim()
        if (!normalized) {
          return null
        }
  
        const { data: directCity } = await supabase
          .from('cities')
          .select('id, name')
          .eq('user_id', user.id)
          .ilike('name', normalized)
          .maybeSingle()
  
        if (directCity?.id) {
          return directCity
        }
  
        const { data: synonymMatch } = await supabase
          .from('city_synonyms')
          .select('city_id, city:cities(id, name)')
          .eq('user_id', user.id)
          .ilike('synonym', normalized)
          .maybeSingle()
  
        if (synonymMatch?.city) {
          return synonymMatch.city as { id: string; name: string }
        }
  
        return null
      }
  
      const rememberUnrecognizedCity = async (value: string) => {
        const normalized = value.trim()
        if (!normalized) {
          return
        }
  
        try {
          const { data: existing } = await supabase
            .from('unrecognized_cities')
            .select('id, frequency')
            .eq('user_id', user.id)
            .ilike('name', normalized)
            .maybeSingle()
  
          const now = new Date().toISOString()
  
          if (existing?.id) {
            await supabase
              .from('unrecognized_cities')
              .update({
                frequency: (existing.frequency ?? 0) + 1,
                last_seen: now
              })
              .eq('id', existing.id)
          } else {
            await supabase
              .from('unrecognized_cities')
              .insert({
                user_id: user.id,
                name: normalized,
                frequency: 1,
                first_seen: now,
                last_seen: now
              })
          }
        } catch (rememberError) {
          console.error('Не удалось сохранить непознанный город', rememberError)
        }
      }

      const trimmedCityInput = (validatedData.city_input ?? '').trim()
      let resolvedCityId: string | null = null

      if (validatedData.city_id) {
        const { data: existingCity } = await supabase
          .from('cities')
          .select('id')
          .eq('id', validatedData.city_id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (existingCity?.id) {
          resolvedCityId = existingCity.id
        }
      }

      if (!resolvedCityId && trimmedCityInput) {
        const matchedCity = await resolveCityByInput(trimmedCityInput)
        if (matchedCity?.id) {
          resolvedCityId = matchedCity.id
        } else {
          await rememberUnrecognizedCity(trimmedCityInput)
        }
      }

      updateData.city_id = resolvedCityId
      updateData.raw_city_input = trimmedCityInput || null
      delete updateData.city_input
    }

    // Обновляем расход
    const { data: expense, error } = await supabase
      .from('expenses')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(`
        *,
        category:categories(*),
        city:cities(id, name, coordinates)
      `)
      .single()

    if (error) {
      console.error('Ошибка обновления расхода:', error)
      return { error: 'Не удалось обновить расход' }
    }

    revalidatePath('/expenses')
    revalidatePath('/dashboard')
    return { success: true, data: expense }
  } catch (err) {
    console.error('Ошибка валидации расхода:', err)
    return { error: 'Неверные данные расхода' }
  }
}

export async function deleteExpense(id: string) {
  const supabase = await createServerClient()

  try {
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    // Удаляем расход
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Ошибка удаления расхода:', error)
      return { error: 'Не удалось удалить расход' }
    }

    revalidatePath('/expenses')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error('Ошибка удаления расхода:', err)
    return { error: 'Произошла ошибка при удалении' }
  }
}

export async function getExpenses(filters?: {
  category_id?: string
  status?: string
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createServerClient()

  try {
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    let query = supabase
      .from('expenses')
      .select(`
        *,
        category:categories(*),
        city:cities(id, name, coordinates),
        bank_statements(filename)
      `)
      .eq('user_id', user.id)

    // Применяем фильтры
    if (filters?.category_id) {
      query = query.eq('category_id', filters.category_id)
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.date_from) {
      query = query.gte('expense_date', filters.date_from)
    }

    if (filters?.date_to) {
      query = query.lte('expense_date', filters.date_to)
    }

    // Сортировка по дате (новые сначала)
    query = query.order('expense_date', { ascending: false })
    query = query.order('created_at', { ascending: false })

    // Пагинация
    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
    }

    const { data: expenses, error } = await query

    if (error) {
      console.error('Ошибка получения расходов:', error)
      return { error: 'Не удалось загрузить расходы' }
    }

    return { success: true, data: expenses || [] }
  } catch (err) {
    console.error('Ошибка получения расходов:', err)
    return { error: 'Произошла ошибка при загрузке' }
  }
}

export async function getExpenseById(id: string) {
  const supabase = await createServerClient()

  try {
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    const { data: expense, error } = await supabase
      .from('expenses')
      .select(`
        *,
        category:categories(*),
        city:cities(id, name, coordinates)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      console.error('Ошибка получения расхода:', error)
      return { error: 'Расход не найден' }
    }

    return { success: true, data: expense }
  } catch (err) {
    console.error('Ошибка получения расхода:', err)
    return { error: 'Произошла ошибка при загрузке' }
  }
}

export async function createBulkExpenses(expenses: CreateExpenseData[]) {
  const supabase = await createServerClient()

  try {
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    if (!expenses || expenses.length === 0) {
      return { error: 'Нет данных для создания' }
    }

    // Получаем справочную информацию по городам и ключевым словам один раз
    const [cityQuery, synonymQuery] = await Promise.all([
      supabase
        .from('cities')
        .select('id, name')
        .eq('user_id', user.id),
      supabase
        .from('city_synonyms')
        .select('city_id, synonym')
        .eq('user_id', user.id)
    ])

    const cityRecords = cityQuery?.data ?? []
    const synonymRecords = synonymQuery?.data ?? []

    const cityIdSet = new Set<string>()
    const cityNameLookup = new Map<string, { id: string; name: string }>()
    const cityById = new Map<string, { id: string; name: string }>()

    for (const city of cityRecords ?? []) {
      if (!city?.id) {
        continue
      }
      cityIdSet.add(city.id)
      const normalized = city.name?.trim().toLocaleLowerCase('ru')
      if (normalized) {
        cityNameLookup.set(normalized, { id: city.id, name: city.name })
      }
      cityById.set(city.id, { id: city.id, name: city.name ?? '' })
    }

    const synonymLookup = new Map<string, { id: string; name: string }>()

    for (const record of synonymRecords ?? []) {
      const normalized = record?.synonym?.trim().toLocaleLowerCase('ru')
      if (normalized && record.city_id) {
        const city = cityById.get(record.city_id)
        synonymLookup.set(normalized, { id: record.city_id, name: city?.name ?? record.synonym ?? '' })
      }
    }



    const rememberUnrecognizedCity = async (name: string, occurrences: number) => {
      const normalized = name.trim()
      if (!normalized || occurrences <= 0) {
        return
      }

      try {
        const { data: existing } = await supabase
          .from('unrecognized_cities')
          .select('id, frequency')
          .eq('user_id', user.id)
          .ilike('name', normalized)
          .maybeSingle()

        const timestamp = new Date().toISOString()

        if (existing?.id) {
          await supabase
            .from('unrecognized_cities')
            .update({
              frequency: (existing.frequency ?? 0) + occurrences,
              last_seen: timestamp
            })
            .eq('id', existing.id)
        } else {
          await supabase
            .from('unrecognized_cities')
            .insert({
              user_id: user.id,
              name: normalized,
              frequency: occurrences,
              first_seen: timestamp,
              last_seen: timestamp
            })
        }
      } catch (error) {
        console.error('Не удалось сохранить непознанный город при массовом вводе', error)
      }
    }

    // ОПТИМИЗАЦИЯ: Получаем все ключевые слова один раз
    const { data: keywords } = await supabase
      .from('category_keywords')
      .select(`
        id,
        keyword,
        category_id,
        keyword_synonyms (synonym)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Функция быстрой категоризации в памяти
    const categorizeBulk = (description: string) => {
      if (!keywords || !description) {
        return { category_id: null, matched_keywords: [], auto_categorized: false }
      }

      const descriptionLower = description.toLowerCase()

      const keywordList = (keywords ?? []) as Array<
        (typeof keywords extends Array<infer Item> ? Item : never) & {
          keyword_synonyms?: { synonym: string | null }[]
        }
      >

      for (const keyword of keywordList) {
        const base = keyword.keyword?.toLowerCase()
        if (base && descriptionLower.includes(base)) {
          return {
            category_id: keyword.category_id,
            matched_keywords: [keyword.keyword],
            auto_categorized: true
          }
        }

        const synonyms = keyword.keyword_synonyms || []
        for (const synonym of synonyms) {
          const normalized = synonym.synonym?.toLowerCase()
          if (normalized && descriptionLower.includes(normalized)) {
            return {
              category_id: keyword.category_id,
              matched_keywords: [`${keyword.keyword} (${synonym.synonym})`],
              auto_categorized: true
            }
          }
        }
      }

      return { category_id: null, matched_keywords: [], auto_categorized: false }
    }
    
    // Обрабатываем все расходы в памяти (без await в цикле)
    const processedExpenses = []
    const errors: Array<{ row: number; message: string }> = []
    
    const unrecognizedCounters = new Map<string, { name: string; count: number }>()

    for (let i = 0; i < expenses.length; i++) {
      const expense = expenses[i]

      try {
        // Валидируем данные
        const validatedData = expenseSchema.parse({
          ...expense,
          input_method: 'bulk_table',
        })

        // Быстрая категоризация в памяти
        let finalCategoryId: string | null = validatedData.category_id || null
        let matchedKeywords: string[] = []
        let autoCategorized = false

        // Если категория не указана, пытаемся определить автоматически
        if (!finalCategoryId && validatedData.description) {
          const categorizationResult = categorizeBulk(validatedData.description)
          finalCategoryId = categorizationResult.category_id
          matchedKeywords = categorizationResult.matched_keywords
          autoCategorized = categorizationResult.auto_categorized
        }

        // Определяем статус расхода
        const status = finalCategoryId ? 'categorized' : 'uncategorized'

        let resolvedCityId: string | null = null
        const trimmedCityInput = validatedData.city_input?.trim() ?? ''

        if (validatedData.city_id && cityIdSet.has(validatedData.city_id)) {
          resolvedCityId = validatedData.city_id
        }

        if (!resolvedCityId && trimmedCityInput) {
          const normalizedCity = trimmedCityInput.toLocaleLowerCase('ru')
          const directMatch = cityNameLookup.get(normalizedCity)
          if (directMatch) {
            resolvedCityId = directMatch.id
          } else {
            const synonymMatch = synonymLookup.get(normalizedCity)
            if (synonymMatch) {
              resolvedCityId = synonymMatch.id
            }
          }

          if (!resolvedCityId) {
            const existing = unrecognizedCounters.get(normalizedCity)
            if (existing) {
              existing.count += 1
            } else {
              unrecognizedCounters.set(normalizedCity, { name: trimmedCityInput, count: 1 })
            }
          }
        }

        processedExpenses.push({
          user_id: user.id,
          amount: validatedData.amount,
          description: validatedData.description || null,
          notes: validatedData.notes || null,
          category_id: finalCategoryId,
          expense_date: validatedData.expense_date,
          expense_time: validatedData.expense_time || null,
          input_method: 'bulk_table',
          batch_id: validatedData.batch_id || null,
          status,
          matched_keywords: matchedKeywords.length > 0 ? matchedKeywords : null,
          auto_categorized: autoCategorized,
          city_id: resolvedCityId,
          raw_city_input: trimmedCityInput || null
        })
      } catch (err) {
        errors.push({
          row: i + 1,
          message: err instanceof Error ? err.message : 'Неверные данные'
        })
      }
    }

    if (processedExpenses.length === 0) {
      return { 
        error: 'Нет валидных данных для создания',
        errors 
      }
    }

    // Создаем расходы в базе данных
    const { data: createdExpenses, error } = await supabase
      .from('expenses')
      .insert(processedExpenses)
      .select(`
        *,
        category:categories(*),
        city:cities(id, name, coordinates)
      `)

    if (error) {
      console.error('Ошибка создания массовых расходов:', error)
      return { error: 'Не удалось создать расходы' }
    }

    if (unrecognizedCounters.size > 0) {
      await Promise.all(
        Array.from(unrecognizedCounters.values()).map(entry => rememberUnrecognizedCity(entry.name, entry.count))
      )
    }

    // Подсчитываем статистику
    const successCount = createdExpenses?.length || 0
    const failedCount = errors.length
    const uncategorizedCount = createdExpenses?.filter(e => e.status === 'uncategorized').length || 0

    revalidatePath('/expenses')
    revalidatePath('/dashboard')
    
    return { 
      success: true, 
      data: createdExpenses,
      stats: {
        success: successCount,
        failed: failedCount,
        uncategorized: uncategorizedCount,
        total: expenses.length
      },
      errors: errors.length > 0 ? errors : undefined
    }
  } catch (err) {
    console.error('Ошибка создания массовых расходов:', err)
    return { error: 'Произошла ошибка при создании расходов' }
  }
}

export async function getExpenseStats(filters?: {
  date_from?: string
  date_to?: string
}) {
  const supabase = await createServerClient()

  try {
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    let query = supabase
      .from('expenses')
      .select(`
        amount,
        expense_date,
        status,
        category:categories(name, color)
      `)
      .eq('user_id', user.id)

    // Применяем фильтры
    if (filters?.date_from) {
      query = query.gte('expense_date', filters.date_from)
    }

    if (filters?.date_to) {
      query = query.lte('expense_date', filters.date_to)
    }

    const { data: expenses, error } = await query

    if (error) {
      console.error('Ошибка получения статистики расходов:', error)
      return { error: 'Не удалось загрузить статистику' }
    }

    // Вычисляем статистику
    const totalAmount = expenses?.reduce((sum, expense) => sum + expense.amount, 0) || 0
    const totalCount = expenses?.length || 0
    const categorizedCount = expenses?.filter(e => e.status === 'categorized').length || 0
    const uncategorizedCount = expenses?.filter(e => e.status === 'uncategorized').length || 0

    // Группируем по категориям
    const categoryStats = expenses?.reduce((acc, expense) => {
      if (expense.category && typeof expense.category === 'object') {
        const category = expense.category as any
        const categoryName = category.name || 'Без названия'
        const categoryColor = category.color || '#6366f1'
        if (!acc[categoryName]) {
          acc[categoryName] = {
            name: categoryName,
            color: categoryColor,
            amount: 0,
            count: 0
          }
        }
        acc[categoryName].amount += expense.amount
        acc[categoryName].count += 1
      }
      return acc
    }, {} as Record<string, { name: string; color: string; amount: number; count: number }>)

    return {
      success: true,
      data: {
        totalAmount,
        totalCount,
        categorizedCount,
        uncategorizedCount,
        categoryStats: Object.values(categoryStats || {})
      }
    }
  } catch (err) {
    console.error('Ошибка получения статистики расходов:', err)
    return { error: 'Произошла ошибка при загрузке статистики' }
  }
}

export async function deleteAllExpenses() {
  const supabase = await createServerClient()

  try {
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    // Удаляем все расходы пользователя
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('Ошибка удаления всех расходов:', error)
      return { error: 'Не удалось удалить расходы' }
    }

    // Обновляем кэш
    revalidatePath('/expenses')
    revalidatePath('/dashboard')

    return { success: true }
  } catch (err) {
    console.error('Ошибка удаления всех расходов:', err)
    return { error: 'Произошла ошибка при удалении расходов' }
  }
}