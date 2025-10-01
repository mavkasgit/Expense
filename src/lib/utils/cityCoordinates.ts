import { DEFAULT_MARKER_PRESET, VIRTUAL_CITY_MARKER_PRESET } from '@/lib/constants/cityMarkers'

export type CityCoordinates = {
  lat: number | null
  lon: number | null
  markerPreset?: string | null
  isVirtual?: boolean
}

export const hasGeoPoint = (coords: CityCoordinates | null | undefined): coords is CityCoordinates & {
  lat: number
  lon: number
} => {
  if (!coords) {
    return false
  }
  return typeof coords.lat === 'number' && typeof coords.lon === 'number'
}

export const createVirtualCityCoordinates = (): CityCoordinates => ({
  lat: null,
  lon: null,
  markerPreset: VIRTUAL_CITY_MARKER_PRESET,
  isVirtual: true
})

export const isVirtualMarkerPreset = (preset?: string | null) => (preset ?? '') === VIRTUAL_CITY_MARKER_PRESET

export const isVirtualCoordinates = (coords: CityCoordinates | null | undefined) =>
  Boolean(coords?.isVirtual) || (coords != null && isVirtualMarkerPreset(coords.markerPreset) && !hasGeoPoint(coords))

const normaliseCoordinateInput = (value: string) => value.trim().replace(',', '.')

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }

  return null
}

export const normaliseMarkerPreset = (preset?: string | null) => preset ?? DEFAULT_MARKER_PRESET

export const parseCityCoordinates = (value: unknown): CityCoordinates | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const {
    lat,
    lon,
    markerPreset,
    marker_preset: markerPresetAlt,
    isVirtual,
    is_virtual: isVirtualAlt
  } = value as {
    lat?: unknown
    lon?: unknown
    markerPreset?: unknown
    marker_preset?: unknown
    isVirtual?: unknown
    is_virtual?: unknown
  }

  const latNumber = toNumber(lat)
  const lonNumber = toNumber(lon)

  const preset = typeof markerPreset === 'string'
    ? markerPreset
    : typeof markerPresetAlt === 'string'
      ? markerPresetAlt
      : null

  const virtualFlag = typeof isVirtual === 'boolean'
    ? isVirtual
    : typeof isVirtualAlt === 'boolean'
      ? isVirtualAlt
      : false

  const hasNumericPoint = latNumber !== null && lonNumber !== null

  if (virtualFlag || (preset === VIRTUAL_CITY_MARKER_PRESET && !hasNumericPoint)) {
    return {
      lat: latNumber,
      lon: lonNumber,
      markerPreset: preset ?? VIRTUAL_CITY_MARKER_PRESET,
      isVirtual: true
    }
  }

  if (!hasNumericPoint) {
    return null
  }

  return {
    lat: latNumber,
    lon: lonNumber,
    markerPreset: preset
  }
}

export const parseManualCoordinatePair = (lat: string, lon: string): Pick<CityCoordinates, 'lat' | 'lon'> | null => {
  const latNumber = toNumber(normaliseCoordinateInput(lat))
  const lonNumber = toNumber(normaliseCoordinateInput(lon))

  if (latNumber === null || lonNumber === null) {
    return null
  }

  return { lat: latNumber, lon: lonNumber }
}
