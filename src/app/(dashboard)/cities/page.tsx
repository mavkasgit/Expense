'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StickyPageHeader } from '@/components/layout/StickyPageHeader'
import { CityManager } from '@/components/cities/CityManager'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { YMaps, Map as YandexMap, Placemark } from '@pbe/react-yandex-maps'
import { DEFAULT_MARKER_PRESET } from '@/lib/constants/cityMarkers'
import { createClient } from '@/lib/supabase/client'

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

type MapState = {
  center: [number, number]
  zoom: number
}

const MAP_DEFAULT_STATE: MapState = {
  center: [55.751574, 37.573856],
  zoom: 4
}

const PERIOD_OPTIONS: Array<{ value: CityExpensePeriod; label: string; description: string }> = [
  { value: '30d', label: '30 дней', description: 'Последний месяц расходов по городам.' },
  { value: '90d', label: '90 дней', description: 'Квартальный обзор перемещений.' },
  { value: '365d', label: '365 дней', description: 'Динамика за последний год.' },
  { value: 'all', label: 'Всё время', description: 'Вся история трат по городам.' }
]

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return '—'
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleDateString('ru-RU')
}

export default function CitiesPage() {
  const yandexApiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY
  const [selectedPeriod, setSelectedPeriod] = useState<CityExpensePeriod>('30d')
  const [cityExpenses, setCityExpenses] = useState<CityExpenseSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapState, setMapState] = useState<MapState>(MAP_DEFAULT_STATE)
  const mapRef = useRef<unknown>(null)
  const [userEmail, setUserEmail] = useState<string | undefined>()
  const [isUserLoading, setIsUserLoading] = useState(true)

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'BYN',
        maximumFractionDigits: 2
      }),
    []
  )

  const sortedExpenses = useMemo(
    () => [...cityExpenses].sort((a, b) => b.totalAmount - a.totalAmount),
    [cityExpenses]
  )

  const topCities = useMemo(() => sortedExpenses.slice(0, 3), [sortedExpenses])
  const citiesWithCoordinates = useMemo(
    () => sortedExpenses.filter(city => Boolean(city.coordinates)),
    [sortedExpenses]
  )
  const totalAmount = useMemo(
    () => sortedExpenses.reduce((acc, city) => acc + (Number.isFinite(city.totalAmount) ? city.totalAmount : 0), 0),
    [sortedExpenses]
  )

  // Оптимизированная загрузка пользователя
  useEffect(() => {
    const supabase = createClient()
    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUserEmail(user?.email)
      } catch (error) {
        console.error('Ошибка загрузки пользователя:', error)
      } finally {
        setIsUserLoading(false)
      }
    }
    void fetchUser()
  }, [])

  const loadCityExpenses = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/cities/expenses?period=${selectedPeriod}`, { cache: 'no-store' })
      const payload = await response.json()

      if (!response.ok || payload?.error) {
        throw new Error(payload?.error ?? 'Не удалось загрузить карту расходов по городам')
      }

      const data = Array.isArray(payload?.data) ? (payload.data as CityExpenseSummary[]) : []
      setCityExpenses(data)
    } catch (loadError) {
      console.error('Не удалось загрузить данные для карты расходов по городам', loadError)
      setCityExpenses([])
      setError(loadError instanceof Error ? loadError.message : 'Произошла ошибка при загрузке данных')
    } finally {
      setIsLoading(false)
    }
  }, [selectedPeriod])

  useEffect(() => {
    void loadCityExpenses()
  }, [loadCityExpenses])

  useEffect(() => {
    if (citiesWithCoordinates.length === 0) {
      setMapState(MAP_DEFAULT_STATE)
      return
    }

    const instance = mapRef.current as {
      setCenter?: (center: [number, number], zoom?: number) => void
      setBounds?: (bounds: [[number, number], [number, number]], options?: { checkZoomRange?: boolean; zoomMargin?: number }) => void
    } | null

    if (citiesWithCoordinates.length === 1) {
      const coords = citiesWithCoordinates[0].coordinates!
      const center: [number, number] = [coords.lat, coords.lon]
      setMapState({ center, zoom: 9 })
      instance?.setCenter?.(center, 9)
      return
    }

    const latitudes = citiesWithCoordinates.map(city => city.coordinates!.lat)
    const longitudes = citiesWithCoordinates.map(city => city.coordinates!.lon)
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...latitudes), Math.min(...longitudes)],
      [Math.max(...latitudes), Math.max(...longitudes)]
    ]

    instance?.setBounds?.(bounds, { checkZoomRange: true, zoomMargin: 32 })
    const center: [number, number] = [
      (bounds[0][0] + bounds[1][0]) / 2,
      (bounds[0][1] + bounds[1][1]) / 2
    ]
    setMapState(prev => ({ ...prev, center }))
  }, [citiesWithCoordinates])

  const formatAmount = (value: number) => currencyFormatter.format(Number.isFinite(value) ? value : 0)

  return (
    <div className="min-h-screen bg-slate-50">
      <StickyPageHeader
        title="Города и синонимы"
        description="Управляйте городами и анализируйте географию ваших расходов."
        userEmail={userEmail}
      />
      <main className="container mx-auto grid gap-6 px-4 pb-12 pt-6">
        <Card>
          <CardHeader>
            <CardTitle>Карта расходов</CardTitle>
            <CardDescription>
              Выберите период и изучайте, в каких городах сконцентрированы ваши траты.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Период анализа</p>
                  <div className="space-y-2">
                    {PERIOD_OPTIONS.map(option => {
                      const isActive = option.value === selectedPeriod
                      return (
                        <div key={option.value} className="space-y-1">
                          <Button
                            type="button"
                            variant={isActive ? 'primary' : 'outline'}
                            className="w-full justify-between"
                            onClick={() => setSelectedPeriod(option.value)}
                          >
                            <span>{option.label}</span>
                            {isActive && <span className="text-xs font-semibold uppercase text-indigo-100">Выбрано</span>}
                          </Button>
                          <p className="text-xs text-slate-500">{option.description}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Сумма за период</p>
                  <p className="text-2xl font-semibold text-slate-900">{formatAmount(totalAmount)}</p>
                  <p className="text-xs text-slate-500">
                    Города на карте: {citiesWithCoordinates.length} из {sortedExpenses.length}
                  </p>
                  {error && (
                    <p className="text-xs text-red-600">{error}</p>
                  )}
                </div>

                <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Топ городов</p>
                  {topCities.length > 0 ? (
                    <ul className="space-y-1.5">
                      {topCities.map(city => (
                        <li key={city.cityId} className="flex items-center justify-between text-sm text-slate-700">
                          <span className="font-medium text-slate-900">{city.cityName}</span>
                          <span>{formatAmount(city.totalAmount)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">Нет данных для отображения.</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="h-[480px] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  {!yandexApiKey ? (
                    <div className="flex h-full items-center justify-center px-4 text-center text-sm text-red-700">
                      API-ключ для Яндекс Карт не настроен. Карта недоступна.
                    </div>
                  ) : isLoading ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">Загружаем данные…</div>
                  ) : error ? (
                    <div className="flex h-full items-center justify-center px-4 text-center text-sm text-red-600">
                      {error}
                    </div>
                  ) : citiesWithCoordinates.length > 0 ? (
                    <YMaps query={{ apikey: yandexApiKey, lang: 'ru_RU' }}>
                      <YandexMap
                        state={mapState}
                        width="100%"
                        height="100%"
                        modules={['geoObject.addon.balloon', 'geoObject.addon.hint']}
                        instanceRef={(ref) => {
                          mapRef.current = ref ?? null
                        }}
                      >
                        {citiesWithCoordinates.map(city => (
                          <Placemark
                            key={city.cityId}
                            geometry={[city.coordinates!.lat, city.coordinates!.lon]}
                            properties={{
                              balloonContentHeader: city.cityName,
                              balloonContentBody: `<div><strong>Сумма: ${formatAmount(city.totalAmount)}</strong><br/>Операций: ${city.expenseCount}${city.lastExpenseDate ? `<br/>Последняя трата: ${formatDate(city.lastExpenseDate)}` : ''}</div>`,
                              hintContent: `${city.cityName} — ${formatAmount(city.totalAmount)}`
                            }}
                            options={{ preset: city.coordinates?.markerPreset ?? DEFAULT_MARKER_PRESET }}
                          />
                        ))}
                      </YandexMap>
                    </YMaps>
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-500">
                      Нет расходов с координатами за выбранный период.
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Наведите курсор на точку, чтобы увидеть сумму и количество операций. Раскройте маркеры для подробностей.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <CityManager onCityCreated={loadCityExpenses} />
      </main>
    </div>
  )
}


