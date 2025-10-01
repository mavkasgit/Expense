'use client'

import { memo, useMemo } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection as TopologyGeometryCollection, Topology } from 'topojson-specification'
import countries110m from 'world-atlas/countries-110m.json'
import { hasGeoPoint, isVirtualCoordinates, normaliseMarkerPreset, type CityCoordinates } from '@/lib/utils/cityCoordinates'

const WIDTH = 760
const HEIGHT = 420
const RUSSIA_ID = 643

interface CityMapProps {
  cities: {
    id: string;
    name: string;
    total: number;
    alternate: number;
    coordinates: CityCoordinates | null;
  }[];
}

interface Marker {
  id: string
  name: string
  total: number
  alternate: number
  x: number
  y: number
  radius: number
  hasCoordinates: boolean
  color: string
}

const normaliseName = (value: string) => value.trim().toLowerCase()

const coordinateLookup = new Map<string, { lon: number; lat: number }>()

const addCoordinate = (names: string[], lon: number, lat: number) => {
  names.forEach(name => {
    coordinateLookup.set(normaliseName(name), { lon, lat })
  })
}

type CoordinateEntry = [string[], number, number]

const coordinateEntries: CoordinateEntry[] = [
  [['Москва', 'Moscow', 'Msk'], 37.6173, 55.7558],
  [['Санкт-Петербург', 'Saint Petersburg', 'Санкт Петербург', 'St Petersburg', 'СПб'], 30.3351, 59.9343],
  [['Новосибирск', 'Novosibirsk'], 82.9204, 55.0302],
  [['Екатеринбург', 'Ekaterinburg', 'Yekaterinburg'], 60.5975, 56.8389],
  [['Казань', 'Kazan'], 49.1064, 55.7963],
  [['Нижний Новгород', 'Nizhny Novgorod'], 44.002, 56.3269],
  [['Челябинск', 'Chelyabinsk'], 61.4026, 55.1604],
  [['Самара', 'Samara'], 50.1008, 53.1959],
  [['Омск', 'Omsk'], 73.3682, 54.9893],
  [['Ростов-на-Дону', 'Rostov-on-Don', 'Rostov na Donu'], 39.7203, 47.2357],
  [['Уфа', 'Ufa'], 55.9678, 54.7388],
  [['Красноярск', 'Krasnoyarsk'], 92.8526, 56.0106],
  [['Пермь', 'Perm'], 56.2294, 58.0104],
  [['Воронеж', 'Voronezh'], 39.2003, 51.6608],
  [['Волгоград', 'Volgograd'], 44.5018, 48.708],
  [['Саратов', 'Saratov'], 46.0333, 51.5336],
  [['Краснодар', 'Krasnodar'], 38.9747, 45.0355],
  [['Тюмень', 'Tyumen'], 65.5343, 57.153],
  [['Томск', 'Tomsk'], 84.9744, 56.4847],
  [['Иркутск', 'Irkutsk'], 104.296, 52.2869],
  [['Якутск', 'Yakutsk'], 129.7326, 62.0355],
  [['Владивосток', 'Vladivostok'], 131.8869, 43.1155],
  [['Хабаровск', 'Khabarovsk'], 135.0719, 48.4827],
  [['Калининград', 'Kaliningrad'], 20.492, 54.7104],
  [['Барнаул', 'Barnaul'], 83.7689, 53.3481],
  [['Сочи', 'Sochi'], 39.7303, 43.5855],
  [['Ярославль', 'Yaroslavl'], 39.8938, 57.6266],
  [['Белгород', 'Belgorod'], 36.5802, 50.5997],
  [['Тула', 'Tula'], 37.6188, 54.1961]
]

coordinateEntries.forEach(([names, lon, lat]) => addCoordinate(names, lon, lat))

const countriesTopology = countries110m as unknown as Topology<{
  countries: TopologyGeometryCollection
}>

const countries = feature(
  countriesTopology,
  countriesTopology.objects.countries as TopologyGeometryCollection
) as FeatureCollection<Geometry>

const russiaFeature = countries.features.find(item => item.id === RUSSIA_ID) as Feature<Geometry> | undefined

const DEFAULT_MARKER_COLOR = '#2563EB'

const MARKER_COLORS: Record<string, string> = {
  'islands#blueIcon': '#2563EB',
  'islands#redIcon': '#DC2626',
  'islands#greenIcon': '#16A34A',
  'islands#darkOrangeIcon': '#EA580C',
  'islands#violetIcon': '#7C3AED',
  'islands#blackIcon': '#1F2937',
  'virtual#ghostIcon': '#64748B',
}

const CityMapComponent = ({ cities }: CityMapProps) => {
  const projection = useMemo(() => {
    const proj = geoMercator()
    if (russiaFeature) {
      proj.fitExtent(
        [
          [40, 30],
          [WIDTH - 40, HEIGHT - 100]
        ],
        russiaFeature
      )
    } else {
      proj.scale(450).translate([WIDTH / 2, HEIGHT / 2])
    }
    return proj
  }, [])

  const pathGenerator = useMemo(() => geoPath(projection), [projection])
  const mapPath = useMemo(() => (russiaFeature ? pathGenerator(russiaFeature) : null), [pathGenerator])

  const markers: Marker[] = useMemo(() => {
    let fallbackIndex = 0
    const fallbackColumns = 4
    const fallbackStartX = 120
    const fallbackStartY = HEIGHT - 60
    const fallbackColumnSpacing = 140
    const fallbackRowSpacing = 44

    return cities
      .map<Marker | null>(city => {
      const key = normaliseName(city.name)
        const coordinateSource = city.coordinates
        const isVirtual = isVirtualCoordinates(coordinateSource)

        if (isVirtual) {
          return null
        }

        const coordinate = coordinateSource && hasGeoPoint(coordinateSource)
          ? { lon: coordinateSource.lon!, lat: coordinateSource.lat! }
          : coordinateLookup.get(key) ?? null
      let position: [number, number] | null = null
      let hasCoordinates = false

        if (coordinate) {
        const projected = projection([coordinate.lon, coordinate.lat])
        if (projected) {
          position = projected as [number, number]
            hasCoordinates = Boolean((coordinateSource && hasGeoPoint(coordinateSource)) || coordinateLookup.has(key))
        }
      }

      if (!position) {
        const column = fallbackIndex % fallbackColumns
        const row = Math.floor(fallbackIndex / fallbackColumns)
        position = [
          fallbackStartX + column * fallbackColumnSpacing,
          fallbackStartY + row * fallbackRowSpacing
        ]
        fallbackIndex += 1
      }

      const radius = Math.min(6 + city.alternate * 2, 14)

        const preset = normaliseMarkerPreset(city.coordinates?.markerPreset)
      const color = MARKER_COLORS[preset] ?? DEFAULT_MARKER_COLOR

      return {
        id: city.id,
        name: city.name,
        total: city.total,
        alternate: city.alternate,
        x: position[0],
        y: position[1],
        radius,
        hasCoordinates,
        color,
      }
      })
      .filter((marker): marker is Marker => marker !== null)
  }, [cities, projection])

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-[320px] w-full rounded-lg border border-slate-200 bg-slate-100"
          role="img"
          aria-label="Карта с расположением городов"
        >
          {mapPath ? (
            <path d={mapPath} fill="#E2E8F0" stroke="#94A3B8" strokeWidth={1.2} />
          ) : (
            <rect x={40} y={40} width={WIDTH - 80} height={HEIGHT - 120} fill="#E2E8F0" stroke="#94A3B8" strokeWidth={1.2} />
          )}
        </svg>

        {markers.map(marker => {
          const left = `${(marker.x / WIDTH) * 100}%`
          const top = `${(marker.y / HEIGHT) * 100}%`
          const label = `${marker.name}. Всего записей: ${marker.total}. Альтернативных написаний: ${marker.alternate}`

          return (
            <div
              key={marker.id}
              className="group absolute -translate-x-1/2 -translate-y-1/2 transform"
              style={{ left, top }}
              aria-label={label}
            >
              <span
                className="flex items-center justify-center rounded-full border text-xs font-semibold transition bg-white"
                style={{
                  width: `${marker.radius * 2}px`,
                  height: `${marker.radius * 2}px`,
                  borderColor: marker.color,
                  color: marker.color,
                }}
              >
                {marker.alternate}
              </span>
              <span
                className="mt-1 block whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] transition bg-white"
                style={{
                  borderColor: marker.color,
                  color: marker.color,
                }}
              >
                {marker.name}
                {!marker.hasCoordinates && ' *'}
              </span>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-slate-500">
        Число в маркере показывает количество альтернативных написаний. Звёздочка рядом с названием означает приблизительное
        расположение.
      </p>
    </div>
  )
}

export const CityMap = memo(CityMapComponent)
CityMap.displayName = 'CityMap'
