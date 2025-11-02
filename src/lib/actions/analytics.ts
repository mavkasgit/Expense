'use server'

import { createServerClient } from '@/lib/supabase/server'

export type TimeSeriesData = {
  date: string
  amount: number
  count: number
}

export type CategoryAnalytics = {
  name: string
  color: string
  amount: number
  count: number
  percentage: number
}

export type CityAnalytics = {
  name: string
  amount: number
  count: number
  percentage: number
}

export type PeriodComparison = {
  current: {
    amount: number
    count: number
  }
  previous: {
    amount: number
    count: number
  }
  change: {
    amount: number
    amountPercent: number
    count: number
    countPercent: number
  }
}

export async function getTimeSeriesData(filters?: {
  dateFrom?: string
  dateTo?: string
  groupBy?: 'day' | 'week' | 'month'
}): Promise<{ success: true; data: TimeSeriesData[] } | { error: string }> {
  const supabaseClient = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    let query = supabaseClient
      .from('expenses')
      .select('amount, expense_date')
      .eq('user_id', user.id)
      .order('expense_date', { ascending: true })

    if (filters?.dateFrom) {
      query = query.gte('expense_date', filters.dateFrom)
    }

    if (filters?.dateTo) {
      query = query.lte('expense_date', filters.dateTo)
    }

    const { data: expenses, error } = await query

    if (error) {
      console.error('Ошибка получения данных временного ряда:', error)
      return { error: 'Не удалось загрузить данные' }
    }

    const groupBy = filters?.groupBy || 'day'
    const grouped = new Map<string, { amount: number; count: number }>()

    expenses?.forEach((expense: any) => {
      const date = new Date(expense.expense_date)
      let key: string

      if (groupBy === 'week') {
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        key = weekStart.toISOString().split('T')[0]
      } else if (groupBy === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
      } else {
        key = expense.expense_date
      }

      const current = grouped.get(key) || { amount: 0, count: 0 }
      grouped.set(key, {
        amount: current.amount + expense.amount,
        count: current.count + 1
      })
    })

    const result: TimeSeriesData[] = Array.from(grouped.entries())
      .map(([date, data]) => ({
        date,
        amount: data.amount,
        count: data.count
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return { success: true, data: result }
  } catch (err) {
    console.error('Ошибка получения временного ряда:', err)
    return { error: 'Произошла ошибка при загрузке данных' }
  }
}

export async function getCategoryAnalytics(filters?: {
  dateFrom?: string
  dateTo?: string
  limit?: number
}): Promise<{ success: true; data: CategoryAnalytics[] } | { error: string }> {
  const supabaseClient = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    let query = supabaseClient
      .from('expenses')
      .select('amount, category:categories(name, color)')
      .eq('user_id', user.id)
      .not('category_id', 'is', null)

    if (filters?.dateFrom) {
      query = query.gte('expense_date', filters.dateFrom)
    }

    if (filters?.dateTo) {
      query = query.lte('expense_date', filters.dateTo)
    }

    const { data: expenses, error } = await query

    if (error) {
      console.error('Ошибка получения аналитики по категориям:', error)
      return { error: 'Не удалось загрузить данные' }
    }

    const totalAmount = expenses?.reduce((sum, exp: any) => sum + exp.amount, 0) || 0

    const categoryMap = new Map<string, { name: string; color: string; amount: number; count: number }>()

    expenses?.forEach((expense: any) => {
      if (expense.category) {
        const name = expense.category.name
        const color = expense.category.color || '#6366f1'
        const current = categoryMap.get(name) || { name, color, amount: 0, count: 0 }
        categoryMap.set(name, {
          ...current,
          amount: current.amount + expense.amount,
          count: current.count + 1
        })
      }
    })

    let result: CategoryAnalytics[] = Array.from(categoryMap.values())
      .map(cat => ({
        ...cat,
        percentage: totalAmount > 0 ? (cat.amount / totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)

    if (filters?.limit) {
      result = result.slice(0, filters.limit)
    }

    return { success: true, data: result }
  } catch (err) {
    console.error('Ошибка получения аналитики по категориям:', err)
    return { error: 'Произошла ошибка при загрузке данных' }
  }
}

export async function getCityAnalytics(filters?: {
  dateFrom?: string
  dateTo?: string
  limit?: number
}): Promise<{ success: true; data: CityAnalytics[] } | { error: string }> {
  const supabaseClient = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    let query = supabaseClient
      .from('expenses')
      .select('amount, city:cities(name)')
      .eq('user_id', user.id)
      .not('city_id', 'is', null)

    if (filters?.dateFrom) {
      query = query.gte('expense_date', filters.dateFrom)
    }

    if (filters?.dateTo) {
      query = query.lte('expense_date', filters.dateTo)
    }

    const { data: expenses, error } = await query

    if (error) {
      console.error('Ошибка получения аналитики по городам:', error)
      return { error: 'Не удалось загрузить данные' }
    }

    const totalAmount = expenses?.reduce((sum, exp: any) => sum + exp.amount, 0) || 0

    const cityMap = new Map<string, { amount: number; count: number }>()

    expenses?.forEach((expense: any) => {
      if (expense.city?.name) {
        const name = expense.city.name
        const current = cityMap.get(name) || { amount: 0, count: 0 }
        cityMap.set(name, {
          amount: current.amount + expense.amount,
          count: current.count + 1
        })
      }
    })

    let result: CityAnalytics[] = Array.from(cityMap.entries())
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        count: data.count,
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)

    if (filters?.limit) {
      result = result.slice(0, filters.limit)
    }

    return { success: true, data: result }
  } catch (err) {
    console.error('Ошибка получения аналитики по городам:', err)
    return { error: 'Произошла ошибка при загрузке данных' }
  }
}

export async function getPeriodComparison(
  currentFrom: string,
  currentTo: string,
  previousFrom: string,
  previousTo: string
): Promise<{ success: true; data: PeriodComparison } | { error: string }> {
  const supabaseClient = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    const [currentResult, previousResult] = await Promise.all([
      supabaseClient
        .from('expenses')
        .select('amount')
        .eq('user_id', user.id)
        .gte('expense_date', currentFrom)
        .lte('expense_date', currentTo),
      supabaseClient
        .from('expenses')
        .select('amount')
        .eq('user_id', user.id)
        .gte('expense_date', previousFrom)
        .lte('expense_date', previousTo)
    ])

    if (currentResult.error || previousResult.error) {
      console.error('Ошибка получения сравнения периодов:', currentResult.error || previousResult.error)
      return { error: 'Не удалось загрузить данные' }
    }

    const currentAmount = currentResult.data?.reduce((sum, exp: any) => sum + exp.amount, 0) || 0
    const currentCount = currentResult.data?.length || 0
    const previousAmount = previousResult.data?.reduce((sum, exp: any) => sum + exp.amount, 0) || 0
    const previousCount = previousResult.data?.length || 0

    const amountChange = currentAmount - previousAmount
    const amountChangePercent = previousAmount > 0 ? (amountChange / previousAmount) * 100 : 0
    const countChange = currentCount - previousCount
    const countChangePercent = previousCount > 0 ? (countChange / previousCount) * 100 : 0

    return {
      success: true,
      data: {
        current: { amount: currentAmount, count: currentCount },
        previous: { amount: previousAmount, count: previousCount },
        change: {
          amount: amountChange,
          amountPercent: amountChangePercent,
          count: countChange,
          countPercent: countChangePercent
        }
      }
    }
  } catch (err) {
    console.error('Ошибка получения сравнения периодов:', err)
    return { error: 'Произошла ошибка при загрузке данных' }
  }
}

export async function getExpenseHeatmap(filters?: {
  dateFrom?: string
  dateTo?: string
}): Promise<{ success: true; data: { date: string; amount: number; count: number }[] } | { error: string }> {
  const supabaseClient = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    let query = supabaseClient
      .from('expenses')
      .select('amount, expense_date')
      .eq('user_id', user.id)
      .order('expense_date', { ascending: true })

    if (filters?.dateFrom) {
      query = query.gte('expense_date', filters.dateFrom)
    }

    if (filters?.dateTo) {
      query = query.lte('expense_date', filters.dateTo)
    }

    const { data: expenses, error } = await query

    if (error) {
      console.error('Ошибка получения данных heatmap:', error)
      return { error: 'Не удалось загрузить данные' }
    }

    const dailyData = new Map<string, { amount: number; count: number }>()

    expenses?.forEach((expense: any) => {
      const date = expense.expense_date
      const current = dailyData.get(date) || { amount: 0, count: 0 }
      dailyData.set(date, {
        amount: current.amount + expense.amount,
        count: current.count + 1
      })
    })

    const result = Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        amount: data.amount,
        count: data.count
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return { success: true, data: result }
  } catch (err) {
    console.error('Ошибка получения heatmap:', err)
    return { error: 'Произошла ошибка при загрузке данных' }
  }
}
