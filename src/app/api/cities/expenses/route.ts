import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
import { hasGeoPoint, isVirtualCoordinates, parseCityCoordinates, normaliseMarkerPreset } from '@/lib/utils/cityCoordinates'
import { DEFAULT_MARKER_PRESET } from '@/lib/constants/cityMarkers'

type CityExpensePeriod = '30d' | '90d' | '365d' | 'all'

type CityExpenseSummary = {
  cityId: string
  cityName: string
  totalAmount: number
  expenseCount: number
  coordinates: {
    lat: number
    lon: number
    markerPreset?: string | null
  } | null
  lastExpenseDate: string | null
}

const PERIOD_TO_DAYS: Record<Exclude<CityExpensePeriod, 'all'>, number> = {
  '30d': 30,
  '90d': 90,
  '365d': 365
}

const resolveDateFrom = (period: CityExpensePeriod): string | null => {
  if (period === 'all') {
    return null
  }

  const days = PERIOD_TO_DAYS[period]
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  from.setDate(from.getDate() - days + 1)
  return from.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()

  try {
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Пользователь не авторизован' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const periodParam = (searchParams.get('period') ?? '30d') as CityExpensePeriod
    const period: CityExpensePeriod = ['30d', '90d', '365d', 'all'].includes(periodParam)
      ? periodParam
      : '30d'

    const dateFrom = resolveDateFrom(period)

    let query = supabase
      .from('expenses')
      .select('amount, expense_date, city_id, city:cities(id, name, coordinates)')
      .eq('user_id', user.id)
      .not('city_id', 'is', null)

    if (dateFrom) {
      query = query.gte('expense_date', dateFrom)
    }

    const { data, error } = await query

    if (error) {
      console.error('Ошибка загрузки расходов по городам:', error)
      return NextResponse.json({ error: 'Не удалось загрузить данные' }, { status: 500 })
    }

    const summaryMap = new Map<string, CityExpenseSummary>()

    for (const item of (data as any[]) ?? []) {
      const cityId = item.city_id as string | null
      const city = item.city as { id: string; name: string; coordinates: unknown } | null

      if (!cityId || !city?.id) {
        continue
      }

      const amount = typeof item.amount === 'number' ? item.amount : Number.parseFloat(String(item.amount ?? 0))
      const parsedCoordinates = parseCityCoordinates(city.coordinates)
      const coordinates = parsedCoordinates && hasGeoPoint(parsedCoordinates) && !isVirtualCoordinates(parsedCoordinates)
        ? { ...parsedCoordinates, markerPreset: normaliseMarkerPreset(parsedCoordinates.markerPreset) }
        : null

      const existing = summaryMap.get(cityId)

      if (existing) {
        existing.totalAmount += Number.isFinite(amount) ? amount : 0
        existing.expenseCount += 1
        if (!existing.coordinates && coordinates) {
          existing.coordinates = coordinates
        }
        if (item.expense_date && (!existing.lastExpenseDate || item.expense_date > existing.lastExpenseDate)) {
          existing.lastExpenseDate = item.expense_date
        }
      } else {
        summaryMap.set(cityId, {
          cityId,
          cityName: city.name,
          totalAmount: Number.isFinite(amount) ? amount : 0,
          expenseCount: 1,
          coordinates,
          lastExpenseDate: item.expense_date ?? null
        })
      }
    }

    const summaries = Array.from(summaryMap.values())
      .map((entry) => ({
        ...entry,
        coordinates: entry.coordinates
          ? { ...entry.coordinates, markerPreset: entry.coordinates.markerPreset ?? DEFAULT_MARKER_PRESET }
          : null
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)

    return NextResponse.json({ success: true, data: summaries, period })
  } catch (err) {
    console.error('Неизвестная ошибка при формировании карты расходов по городам:', err)
    return NextResponse.json({ error: 'Произошла ошибка при загрузке данных' }, { status: 500 })
  }
}
