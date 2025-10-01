'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  ConfirmationModal,
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { getCitySynonyms, createCitySynonym, deleteCitySynonym, deleteCity, updateCityName } from '@/lib/actions/synonyms';
import { toggleCityFavorite, updateCityCoordinates } from '@/lib/actions/cities';
import { attachUnrecognizedCity, getUnrecognizedCities, resolveUnrecognizedCity } from '@/lib/actions/unrecognizedCities';
import { syncCitySynonyms } from '@/lib/utils/cityParser';
import type { CitySynonymWithCity, UnrecognizedCity } from '@/types';
import { DEFAULT_MARKER_PRESET, MARKER_PRESETS, markerPresetLookup } from '@/lib/constants/cityMarkers';
import {
  createVirtualCityCoordinates,
  hasGeoPoint,
  isVirtualCoordinates,
  isVirtualMarkerPreset,
  normaliseMarkerPreset,
  parseCityCoordinates,
  parseManualCoordinatePair,
  type CityCoordinates
} from '@/lib/utils/cityCoordinates';
import {
  DEFAULT_ZOOM,
  MapState,
  coordinatesAreEqual,
  createDefaultMapState,
  extractEventCoordinates,
  extractPlacemarkCoordinates,
  normaliseCoordinateInput,
} from './cityManagerUtils';
import { CityManagerUnrecognizedPanel, type SelectOption } from './CityManagerUnrecognizedPanel';
import { CityManagerCreateCitySection } from './CityManagerCreateCitySection';
import { CityManagerSynonymListSection } from './CityManagerSynonymListSection';
import { CityManagerOverviewMapSection } from './CityManagerOverviewMapSection';
import { CityManagerStatsCard } from './CityManagerStatsCard';
import type { CityGroup, CityGroupWithCoordinates, CitySynonymRecord } from './cityManagerTypes';

interface CityManagerProps {
  onCityCreated?: () => Promise<void> | void;
}

const pickRandomMarkerPreset = (exclude?: string) => {
  const selectablePresets = MARKER_PRESETS.filter(preset => !preset.isVirtual);
  const source = selectablePresets.length > 0 ? selectablePresets : MARKER_PRESETS;

  if (source.length === 0) {
    return DEFAULT_MARKER_PRESET;
  }

  const [firstPreset] = source;

  if (!firstPreset) {
    return DEFAULT_MARKER_PRESET;
  }

  if (source.length === 1) {
    return firstPreset.value;
  }

  let candidate: string | undefined = exclude;

  while (!candidate || candidate === exclude) {
    const randomIndex = Math.floor(Math.random() * source.length);
    candidate = source[randomIndex]?.value ?? firstPreset.value;
  }

  return candidate;
};

export function CityManager({ onCityCreated }: CityManagerProps = {}) {
  const [synonyms, setSynonyms] = useState<CitySynonymRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newCity, setNewCity] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingMap, setDeletingMap] = useState<Record<string, boolean>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [cityToDelete, setCityToDelete] = useState<{ id: string; name: string } | null>(null)
  const [unrecognizedCities, setUnrecognizedCities] = useState<UnrecognizedCity[]>([])
  const [isLoadingUnrecognized, setIsLoadingUnrecognized] = useState(false)
  const [selectedUnrecognizedCityId, setSelectedUnrecognizedCityId] = useState<string | null>(null)
  const [selectedAttachCityId, setSelectedAttachCityId] = useState<string | null>(null)
  const [isAttachingUnrecognized, setIsAttachingUnrecognized] = useState(false)
  const [selectedMarkerPreset, setSelectedMarkerPreset] = useState<string>(DEFAULT_MARKER_PRESET)
  const selectedMarkerPresetRef = useRef(selectedMarkerPreset)
  selectedMarkerPresetRef.current = selectedMarkerPreset
  const selectedMarkerLabel = useMemo(() => {
    const preset = markerPresetLookup.get(normaliseMarkerPreset(selectedMarkerPreset))
    return preset?.label ?? 'Стандартный маркер'
  }, [selectedMarkerPreset])
  const [markerUpdatingMap, setMarkerUpdatingMap] = useState<Record<string, boolean>>({})
  const [favoriteUpdatingCityId, setFavoriteUpdatingCityId] = useState<string | null>(null)
  const { showToast } = useToast()
  const [mapState, setMapState] = useState<MapState>(() => createDefaultMapState())
  const [selectedCoordinates, setSelectedCoordinates] = useState<CityCoordinates | null>(null)
  const [manualLat, setManualLat] = useState('')
  const [manualLon, setManualLon] = useState('')
  const [useUnrecognizedAlternate, setUseUnrecognizedAlternate] = useState(false)
  const newCityInputRef = useRef<HTMLInputElement | null>(null)
  const [isSearchingCoordinates, setIsSearchingCoordinates] = useState(false)
  const mapRef = useRef<unknown>(null)
  const overviewMapRef = useRef<unknown>(null)
  const lastGeocodedQuery = useRef('')
  const yandexApiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY

  useEffect(() => {
    setSelectedMarkerPreset(pickRandomMarkerPreset());
  }, []);

  const formatCityCoordinates = useCallback((coords: CityCoordinates | null) => {
    if (!coords) {
      return 'нет координат'
    }
    if (isVirtualCoordinates(coords)) {
      return 'виртуальный город'
    }
    if (!hasGeoPoint(coords)) {
      return 'нет координат'
    }
    return `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`
  }, [])

  const handleSearchKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
    }
  }, [])

  const resetSelection = useCallback(() => {
    setSelectedCoordinates(null)
    setManualLat('')
    setManualLon('')
    setSelectedMarkerPreset(prev => pickRandomMarkerPreset(prev))
    setMapState(createDefaultMapState())
    lastGeocodedQuery.current = ''
  }, [])

  const focusOnCoordinates = useCallback((coords: CityCoordinates) => {
    if (!hasGeoPoint(coords)) {
      return
    }
    setMapState(prev => {
      const nextZoom = Math.max(prev.zoom, 10)
      const instance = mapRef.current as { setCenter?: (center: [number, number], zoom?: number) => void } | null
      instance?.setCenter?.([coords.lat, coords.lon], nextZoom)
      return {
        center: [coords.lat, coords.lon],
        zoom: nextZoom
      }
    })
  }, [])

  const applyCoordinates = useCallback((coords: CityCoordinates) => {
    const preset = normaliseMarkerPreset(coords.markerPreset)
    const isVirtual = isVirtualCoordinates(coords) || isVirtualMarkerPreset(preset)
    const nextCoordinates: CityCoordinates = {
      ...coords,
      lat: hasGeoPoint(coords) ? coords.lat : coords.lat ?? null,
      lon: hasGeoPoint(coords) ? coords.lon : coords.lon ?? null,
      markerPreset: preset,
      isVirtual
    }

    setSelectedMarkerPreset(preset)
    setSelectedCoordinates(prev => (coordinatesAreEqual(prev, nextCoordinates) ? prev : { ...nextCoordinates }))

    if (hasGeoPoint(nextCoordinates)) {
      setManualLat(nextCoordinates.lat.toFixed(6))
      setManualLon(nextCoordinates.lon.toFixed(6))
    } else {
      setManualLat('')
      setManualLon('')
    }

    focusOnCoordinates(nextCoordinates)
  }, [focusOnCoordinates])

  const applyManualCoordinates = useCallback((options: { silentOnEmpty?: boolean } = {}) => {
    const { silentOnEmpty = false } = options
    const trimmedLat = manualLat.trim()
    const trimmedLon = manualLon.trim()

    if (isVirtualMarkerPreset(selectedMarkerPresetRef.current)) {
      if (!silentOnEmpty) {
        showToast('Для виртуального города координаты не требуются', 'info')
      }
      return
    }

    if (!trimmedLat || !trimmedLon) {
      if (!silentOnEmpty) {
        showToast('Введите широту и долготу', 'warning')
      }
      return
    }

    const parsed = parseManualCoordinatePair(trimmedLat, trimmedLon)
    if (!parsed) {
      showToast('Введите корректные координаты', 'error')
      return
    }

    const preset = normaliseMarkerPreset(selectedMarkerPresetRef.current)
    applyCoordinates({ ...parsed, markerPreset: preset, isVirtual: false })
  }, [manualLat, manualLon, applyCoordinates, showToast])

  const geocodeCity = useCallback(async (query: string, options: { silent?: boolean; force?: boolean } = {}) => {
    const { silent = false, force = false } = options
    const trimmed = query.trim()

    if (!trimmed) {
      if (!silent) {
        showToast('Введите название города', 'warning')
      }
      return null
    }

    if (isVirtualMarkerPreset(selectedMarkerPresetRef.current)) {
      if (!silent) {
        showToast('Виртуальный город не требует координат', 'info')
      }
      return null
    }

    if (!yandexApiKey) {
      if (!silent) {
        showToast('API ключ для Яндекс Карт не найден', 'error')
      }
      return null
    }

    if (!force && silent && trimmed === lastGeocodedQuery.current) {
      return null
    }

    setIsSearchingCoordinates(true)
    try {
      const response = await fetch(`/api/geocode?city=${encodeURIComponent(trimmed)}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch geocoding data')
      }

      const geoObjects = data?.response?.GeoObjectCollection?.featureMember ?? []

      if (geoObjects.length === 0) {
        if (!silent) {
          showToast(`Город "${trimmed}" не найден`, 'error')
        }
        return null
      }

      const point = geoObjects[0]?.GeoObject?.Point?.pos as string | undefined
      if (!point) {
        if (!silent) {
          showToast('Не удалось определить координаты города', 'error')
        }
        return null
      }

      const [lonString, latString] = point.split(' ')
      const lat = Number.parseFloat(latString)
      const lon = Number.parseFloat(lonString)

      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        if (!silent) {
          showToast('Получены некорректные координаты города', 'error')
        }
        return null
      }

      const preset = normaliseMarkerPreset(selectedMarkerPresetRef.current)
      const coords: CityCoordinates = { lat, lon, markerPreset: preset, isVirtual: false }
      lastGeocodedQuery.current = trimmed
      applyCoordinates(coords)

      if (!silent) {
        showToast(`Город ${trimmed} найден`, 'success')
      }

      return coords
    } catch (error) {
      console.error('Geocoding API error:', error)
      if (!silent) {
        const errorMessage = error instanceof Error ? error.message : 'Произошла ошибка при поиске города'
        showToast(errorMessage, 'error')
      }
      return null
    } finally {
      setIsSearchingCoordinates(false)
    }
  }, [applyCoordinates, showToast, yandexApiKey])

  const loadSynonyms = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await getCitySynonyms()
      if (result.error) {
        showToast(result.error, 'error')
      } else if (result.success && result.data) {
        const records = (result.data as CitySynonymWithCity[])
          .map((record) => {
            const cityId = record.city?.id ?? record.city_id;
            const cityName = record.city?.name ?? record.synonym;
            if (!cityId) {
              return null;
            }
            const parsedCoordinates = parseCityCoordinates(record.city?.coordinates ?? null);
            const coordinates = parsedCoordinates
              ? { ...parsedCoordinates, markerPreset: normaliseMarkerPreset(parsedCoordinates.markerPreset) }
              : null;
            return {
              id: Number(record.id),
              cityId,
              cityName,
              synonym: record.synonym,
              coordinates,
              isFavorite: Boolean(record.city?.is_favorite)
            } as CitySynonymRecord;
          })
          .filter((record): record is CitySynonymRecord => record !== null)

        setSynonyms(records)
        syncCitySynonyms(records.map(record => ({ city: record.cityName, synonym: record.synonym })))
      }
    } catch (error) {
      console.error('Failed to load city synonyms', error)
      showToast('Не удалось загрузить синонимы городов', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  const loadUnrecognizedCities = useCallback(async () => {
    setIsLoadingUnrecognized(true)
    try {
      const result = await getUnrecognizedCities()
      if (result.error) {
        showToast(result.error, 'error')
      } else if (result.success && Array.isArray(result.data)) {
        setUnrecognizedCities(result.data as UnrecognizedCity[])
      }
    } catch (error) {
      console.error('Failed to load unrecognized cities', error)
      showToast('Не удалось загрузить список непознанных городов', 'error')
    } finally {
      setIsLoadingUnrecognized(false)
    }
  }, [showToast])

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadSynonyms(), loadUnrecognizedCities()])
  }, [loadSynonyms, loadUnrecognizedCities])

  useEffect(() => {
    handleRefresh()
  }, [handleRefresh])

  useEffect(() => {
    const trimmed = newCity.trim()
    if (!trimmed) {
      resetSelection()
      return
    }

    if (isVirtualMarkerPreset(selectedMarkerPresetRef.current)) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      geocodeCity(trimmed, { silent: true })
    }, 700)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [newCity, geocodeCity, resetSelection])

  const groupedSynonyms = useMemo(() => {
    const map = new Map<string, CityGroup>()

    synonyms.forEach(record => {
      const groupKey = record.cityId
      if (!groupKey) {
        return
      }
      if (!map.has(groupKey)) {
        map.set(groupKey, {
          cityId: groupKey,
          cityName: record.cityName,
          entries: [],
          coordinates: record.coordinates,
          isFavorite: record.isFavorite
        })
      }
      const group = map.get(groupKey)!
      group.entries.push(record)
      if (!group.cityName && record.cityName) {
        group.cityName = record.cityName
      }
      if (!group.coordinates && record.coordinates) {
        group.coordinates = record.coordinates
      }
      if (group.isFavorite !== record.isFavorite) {
        group.isFavorite = record.isFavorite
      }
    })

    return Array.from(map.values()).sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) {
        return a.isFavorite ? -1 : 1
      }
      return a.cityName.localeCompare(b.cityName, 'ru')
    })
  }, [synonyms])

  const filteredGroupedSynonyms = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) {
      return groupedSynonyms
    }

    return groupedSynonyms.filter(group => {
      if (group.cityName.toLowerCase().includes(term)) {
        return true
      }
      return group.entries.some(entry => entry.synonym.toLowerCase().includes(term))
    })
  }, [groupedSynonyms, searchTerm])

  const citiesWithCoordinates = useMemo<CityGroupWithCoordinates[]>(
    () => groupedSynonyms.filter((group): group is CityGroupWithCoordinates => hasGeoPoint(group.coordinates)),
    [groupedSynonyms]
  )

  const selectedUnrecognizedCity = useMemo(() => {
    if (!selectedUnrecognizedCityId) {
      return null
    }
    return unrecognizedCities.find(city => city.id === selectedUnrecognizedCityId) ?? null
  }, [selectedUnrecognizedCityId, unrecognizedCities])

  useEffect(() => {
    if (selectedUnrecognizedCityId && !selectedUnrecognizedCity) {
      setSelectedUnrecognizedCityId(null)
      setSelectedAttachCityId(null)
    }
  }, [selectedUnrecognizedCityId, selectedUnrecognizedCity])

  useEffect(() => {
    if (!useUnrecognizedAlternate) {
      return
    }

    if (!selectedUnrecognizedCity?.name) {
      setUseUnrecognizedAlternate(false)
    }
  }, [selectedUnrecognizedCity, useUnrecognizedAlternate])

  const citySelectionOptions = useMemo<SelectOption[]>(
    () =>
      groupedSynonyms.map(group => ({
        value: group.cityId,
        label: group.cityName,
      })),
    [groupedSynonyms]
  )

  const unrecognizedCityOptions = useMemo<SelectOption[]>(
    () =>
      unrecognizedCities.map(city => ({
        value: city.id,
        label: city.frequency ? `${city.name} · ${city.frequency}` : city.name,
      })),
    [unrecognizedCities]
  )

  const overviewMapState = useMemo<MapState>(() => {
    if (citiesWithCoordinates.length === 0) {
      return createDefaultMapState()
    }

    const first = citiesWithCoordinates[0].coordinates
    return {
      center: [first.lat, first.lon],
      zoom: citiesWithCoordinates.length === 1 ? 9 : DEFAULT_ZOOM
    }
  }, [citiesWithCoordinates])

  useEffect(() => {
    if (citiesWithCoordinates.length === 0) {
      return
    }

    const instance = overviewMapRef.current as {
      setBounds?: (bounds: [[number, number], [number, number]], options?: { checkZoomRange?: boolean; zoomMargin?: number }) => void
      setCenter?: (center: [number, number], zoom?: number) => void
    } | null

    if (!instance) {
      return
    }

    if (citiesWithCoordinates.length === 1) {
      const coords = citiesWithCoordinates[0].coordinates
      instance.setCenter?.([coords.lat, coords.lon], 9)
      return
    }

    const latitudes = citiesWithCoordinates.map(city => city.coordinates.lat)
    const longitudes = citiesWithCoordinates.map(city => city.coordinates.lon)
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...latitudes), Math.min(...longitudes)],
      [Math.max(...latitudes), Math.max(...longitudes)]
    ]

    instance.setBounds?.(bounds, { checkZoomRange: true, zoomMargin: 32 })
  }, [citiesWithCoordinates])

  const stats = useMemo(() => {
    const totalCities = groupedSynonyms.length
    const citiesWithCustomSynonyms = groupedSynonyms.filter(group =>
      group.entries.some(entry => entry.synonym.trim() && entry.synonym.trim().toLowerCase() !== group.cityName.trim().toLowerCase())
    ).length
    const totalSynonyms = synonyms.length
    const customSynonyms = synonyms.filter(entry => entry.synonym.trim().toLowerCase() !== entry.cityName.trim().toLowerCase()).length
    const coverage = totalCities === 0 ? 0 : Math.round((citiesWithCustomSynonyms / totalCities) * 100)

    return {
      totalCities,
      totalSynonyms,
      customSynonyms,
      coverage
    }
  }, [groupedSynonyms, synonyms])

  const handleSelectUnrecognizedCity = useCallback(
    (value: string | null) => {
      setSelectedUnrecognizedCityId(value)
      setSelectedAttachCityId(null)

      if (!value) {
        setUseUnrecognizedAlternate(false)
      }
    },
    []
  )

  const handleUseUnrecognizedCity = useCallback(() => {
    if (!selectedUnrecognizedCity) {
      showToast('Выберите город из списка непознанных', 'warning')
      return
    }
    setNewCity(selectedUnrecognizedCity.name)
    requestAnimationFrame(() => {
      newCityInputRef.current?.focus()
    })
    geocodeCity(selectedUnrecognizedCity.name, { silent: true, force: true })
  }, [geocodeCity, selectedUnrecognizedCity, showToast])

  const handleClearUnrecognizedSelection = useCallback(() => {
    setSelectedUnrecognizedCityId(null)
    setSelectedAttachCityId(null)
    setUseUnrecognizedAlternate(false)
  }, [])

  const handleSelectAttachCity = useCallback((value: string | null) => {
    setSelectedAttachCityId(value)
  }, [])

  const handleCityNameChange = useCallback((value: string) => {
    setNewCity(value)
  }, [])

  const handleToggleUseUnrecognizedAlternate = useCallback(
    (nextValue: boolean) => {
      if (nextValue) {
        if (!selectedUnrecognizedCity?.name) {
          showToast('Выберите непознанный город, чтобы использовать его как альтернативное название', 'warning')
          return
        }
        setUseUnrecognizedAlternate(true)
        requestAnimationFrame(() => {
          newCityInputRef.current?.focus()
        })
        return
      }

      setUseUnrecognizedAlternate(false)
    },
    [selectedUnrecognizedCity, showToast]
  )

  const handleFindCityOnMap = useCallback(() => {
    if (!newCity.trim()) {
      return
    }
    if (isVirtualMarkerPreset(selectedMarkerPresetRef.current)) {
      showToast('Виртуальный город не отображается на карте', 'info')
      return
    }
    void geocodeCity(newCity, { force: true })
  }, [geocodeCity, newCity, showToast])

  const handleMapInstanceChange = useCallback((ref: unknown) => {
    mapRef.current = ref ?? null
  }, [])

  const handleCoordinateSelection = useCallback(
    (lat: number, lon: number) => {
      if (isVirtualMarkerPreset(selectedMarkerPresetRef.current)) {
        showToast('Для виртуального города координаты не используются', 'info')
        return
      }
      applyCoordinates({ lat, lon, markerPreset: selectedMarkerPresetRef.current })
    },
    [applyCoordinates, showToast]
  )

  const handleManualLatChange = useCallback((value: string) => {
    setManualLat(normaliseCoordinateInput(value))
  }, [])

  const handleManualLonChange = useCallback((value: string) => {
    setManualLon(normaliseCoordinateInput(value))
  }, [])

  const handleManualBlur = useCallback(() => {
    applyManualCoordinates({ silentOnEmpty: true })
  }, [applyManualCoordinates])

  const handleManualApply = useCallback(() => {
    applyManualCoordinates()
  }, [applyManualCoordinates])

  const handleSearchTermChange = useCallback((value: string) => {
    setSearchTerm(value)
  }, [])

  const handleOverviewMapInstanceChange = useCallback((ref: unknown) => {
    overviewMapRef.current = ref ?? null
  }, [])

  const handleAttachUnrecognizedCity = useCallback(async () => {
    if (!selectedUnrecognizedCityId || !selectedAttachCityId) {
      showToast('Выберите непознанный город и основной город для привязки', 'warning')
      return
    }

    setIsAttachingUnrecognized(true)
    try {
      const result = await attachUnrecognizedCity({
        unrecognizedCityId: selectedUnrecognizedCityId,
        cityId: selectedAttachCityId,
      })
      if (result.error) {
        showToast(result.error, 'error')
        return
      }

      showToast('Альтернативное название добавлено', 'success')
      handleClearUnrecognizedSelection()
      await Promise.all([loadSynonyms(), loadUnrecognizedCities()])
    } catch (error) {
      console.error('Failed to attach unrecognized city', error)
      showToast('Не удалось прикрепить альтернативное название', 'error')
    } finally {
      setIsAttachingUnrecognized(false)
    }
  }, [handleClearUnrecognizedSelection, loadSynonyms, loadUnrecognizedCities, selectedAttachCityId, selectedUnrecognizedCityId, showToast])

  const handleMarkerPresetChange = useCallback(async (cityId: string, preset: string) => {
    const targetPreset = normaliseMarkerPreset(preset)
    const recordCoordinates = synonyms.find(record => record.cityId === cityId && record.coordinates)?.coordinates ?? null
    const isVirtualTarget = isVirtualMarkerPreset(targetPreset)

    if (!isVirtualTarget && (!recordCoordinates || !hasGeoPoint(recordCoordinates))) {
      showToast('Сначала задайте координаты города, затем выбирайте маркер', 'warning')
      return
    }

    const nextCoordinates: CityCoordinates = isVirtualTarget
      ? { ...createVirtualCityCoordinates(), markerPreset: targetPreset }
      : { ...recordCoordinates!, markerPreset: targetPreset, isVirtual: false }

    const matchesSelected =
      selectedCoordinates != null &&
      recordCoordinates != null &&
      coordinatesAreEqual(selectedCoordinates, recordCoordinates)

    setMarkerUpdatingMap(prev => ({ ...prev, [cityId]: true }))
    try {
      const result = await updateCityCoordinates({ id: cityId, coordinates: nextCoordinates })
      if (result?.error) {
        showToast(result.error, 'error')
        return
      }

      setSynonyms(prev =>
        prev.map(record =>
          record.cityId === cityId
            ? { ...record, coordinates: nextCoordinates }
            : record
        )
      )

      if (matchesSelected) {
        setSelectedMarkerPreset(targetPreset)
        setSelectedCoordinates(() => ({ ...nextCoordinates }))
      }

      showToast('Маркер города обновлён', 'success')
    } catch (error) {
      console.error('Failed to update marker preset', error)
      showToast('Не удалось обновить маркер города', 'error')
    } finally {
      setMarkerUpdatingMap(prev => ({ ...prev, [cityId]: false }))
    }
  }, [selectedCoordinates, showToast, synonyms])

  const handleCityNameClick = useCallback((group: CityGroup) => {
    if (group.coordinates) {
      if (isVirtualCoordinates(group.coordinates)) {
        applyCoordinates(group.coordinates)
        showToast('Это виртуальный город, координаты не требуются', 'info')
        return
      }

      if (hasGeoPoint(group.coordinates)) {
        applyCoordinates({ ...group.coordinates, markerPreset: normaliseMarkerPreset(group.coordinates.markerPreset) })
        return
      }
    }

    if (isVirtualMarkerPreset(selectedMarkerPresetRef.current)) {
      showToast('Для виртуального маркера координаты не ищутся автоматически', 'info')
      return
    }

    showToast('Координаты не найдены, выполняем поиск на карте…', 'info')
    geocodeCity(group.cityName, { force: true })
  }, [applyCoordinates, geocodeCity, showToast])

  const handleNewCityMarkerPresetChange = useCallback((value: string) => {
    const preset = normaliseMarkerPreset(value)
    setSelectedMarkerPreset(preset)

    if (isVirtualMarkerPreset(preset)) {
      setSelectedCoordinates(createVirtualCityCoordinates())
      setManualLat('')
      setManualLon('')
      setMapState(() => createDefaultMapState())
      return
    }

    setSelectedCoordinates(prev => {
      if (!prev) {
        return prev
      }
      if (!hasGeoPoint(prev)) {
        return null
      }
      return { ...prev, markerPreset: preset, isVirtual: false }
    })
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newCity.trim()) {
      showToast('Заполните название города', 'error')
      return
    }

    if (!selectedCoordinates || (!isVirtualCoordinates(selectedCoordinates) && !hasGeoPoint(selectedCoordinates))) {
      showToast('Подтвердите координаты города или выберите виртуальный маркер', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      const cityName = newCity.trim()
      const result = await createCitySynonym({ city: cityName, synonym: cityName })
      if (result.error) {
        showToast(result.error, 'error')
      } else if (result.success && result.data) {
        const payload = result.data as CitySynonymWithCity
        const createdCityId = payload.city?.id ?? payload.city_id
        const createdCityName = payload.city?.name ?? cityName
        const parsedServerCoordinates = parseCityCoordinates(payload.city?.coordinates ?? null)
        const serverCoordinates = parsedServerCoordinates
          ? { ...parsedServerCoordinates, markerPreset: normaliseMarkerPreset(parsedServerCoordinates.markerPreset) }
          : null
        let effectiveCoordinates: CityCoordinates | null = selectedCoordinates

        const additionalSynonyms = (() => {
          if (!useUnrecognizedAlternate) {
            return []
          }

          const alternative = selectedUnrecognizedCity?.name?.trim()
          if (!alternative) {
            return []
          }

          const normalizedCity = cityName.toLocaleLowerCase('ru')
          if (alternative.toLocaleLowerCase('ru') === normalizedCity) {
            return []
          }

          return [alternative]
        })()

        if (createdCityId && !coordinatesAreEqual(selectedCoordinates, serverCoordinates)) {
          const updateResult = await updateCityCoordinates({ id: createdCityId, coordinates: selectedCoordinates })
          if (updateResult?.error) {
            showToast(updateResult.error, 'error')
            effectiveCoordinates = serverCoordinates
          }
        }

        const normalisedEffective = effectiveCoordinates
          ? { ...effectiveCoordinates, markerPreset: normaliseMarkerPreset(effectiveCoordinates.markerPreset) }
          : null

        const createdRecords: CitySynonymRecord[] = []

        if (!createdCityId) {
          await loadSynonyms()
        } else {
          createdRecords.push({
            id: Number(payload.id),
            cityId: createdCityId,
            cityName: createdCityName,
            synonym: payload.synonym,
            coordinates: normalisedEffective ?? serverCoordinates ?? null,
            isFavorite: false
          })

          for (const synonymValue of additionalSynonyms) {
            const synonymResult = await createCitySynonym({ cityId: createdCityId, synonym: synonymValue })
            if (synonymResult?.error) {
              showToast(synonymResult.error, 'error')
              continue
            }
            const synonymPayload = synonymResult?.data as CitySynonymWithCity | undefined
            if (!synonymPayload) {
              continue
            }
            createdRecords.push({
              id: Number(synonymPayload.id),
              cityId: createdCityId,
              cityName: createdCityName,
              synonym: synonymPayload.synonym,
              coordinates: normalisedEffective ?? serverCoordinates ?? null,
              isFavorite: false
            })
          }

          setSynonyms(prev => {
            const updated = [...prev, ...createdRecords]
            syncCitySynonyms(updated.map(record => ({ city: record.cityName, synonym: record.synonym })))
            return updated
          })
        }
        if (selectedUnrecognizedCityId) {
          const resolveResult = await resolveUnrecognizedCity({ id: selectedUnrecognizedCityId })
          if (resolveResult?.error) {
            showToast(resolveResult.error, 'error')
          } else {
            handleClearUnrecognizedSelection()
          }
          await loadUnrecognizedCities()
        }

        if (onCityCreated) {
          try {
            await onCityCreated()
          } catch (refreshError) {
            console.error('Не удалось обновить карту расходов после добавления города', refreshError)
          }
        }

        showToast('Город добавлен', 'success')
        setNewCity('')
        setUseUnrecognizedAlternate(false)
        resetSelection()
      }
    } catch (error) {
      console.error('Failed to create city', error)
      showToast('Не удалось добавить город', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSynonym = async (synonym: CitySynonymRecord) => {
    const key = synonym.id.toString()
    setDeletingMap(prev => ({ ...prev, [key]: true }))
    try {
      const result = await deleteCitySynonym({ id: synonym.id })
      if (result.error) {
        showToast(result.error, 'error')
      } else {
        setSynonyms(prev => {
          const updated = prev.filter(item => item.id !== synonym.id)
          syncCitySynonyms(updated.map(record => ({ city: record.cityName, synonym: record.synonym })))
          return updated
        })
        showToast('Синоним удален', 'success')
      }
    } catch (error) {
      console.error('Failed to delete city synonym', error)
      showToast('Не удалось удалить синоним', 'error')
    } finally {
      setDeletingMap(prev => ({ ...prev, [key]: false }))
    }
  }

  const handleDeleteClick = (e: React.MouseEvent, city: { id: string; name: string }) => {
    e.stopPropagation();
    setCityToDelete(city);
  };

  const handleToggleFavoriteCity = useCallback(async (cityId: string, nextFavorite?: boolean) => {
    const group = groupedSynonyms.find(item => item.cityId === cityId)
    if (!group) {
      return
    }

    setFavoriteUpdatingCityId(cityId)
    const nextFavoriteState = typeof nextFavorite === 'boolean' ? nextFavorite : !group.isFavorite

    try {
      const result = await toggleCityFavorite({ id: cityId, isFavorite: nextFavoriteState })
      if (result?.error) {
        showToast(result.error, 'error')
        return
      }

      setSynonyms(prev => {
        const updated = prev.map(record =>
          record.cityId === cityId ? { ...record, isFavorite: nextFavoriteState } : record
        )
        syncCitySynonyms(updated.map(record => ({ city: record.cityName, synonym: record.synonym })))
        return updated
      })

      showToast(
        nextFavoriteState
          ? `Город «${group.cityName}» добавлен в избранные`
          : `Город «${group.cityName}» убран из избранных`,
        'success'
      )
    } catch (error) {
      console.error('Failed to toggle city favorite', error)
      showToast('Не удалось обновить статус избранного города', 'error')
    } finally {
      setFavoriteUpdatingCityId(null)
    }
  }, [groupedSynonyms, showToast])

  const handleConfirmDelete = async () => {
    if (!cityToDelete) return;

    setIsSubmitting(true);
    try {
      const result = await deleteCity({ id: cityToDelete.id });
      if (result.error) {
        showToast(result.error, 'error');
      } else {
        setSynonyms(prev => {
          const updated = prev.filter(s => s.cityId !== cityToDelete.id);
          syncCitySynonyms(updated.map(record => ({ city: record.cityName, synonym: record.synonym })));
          return updated;
        });
        if (selectedAttachCityId === cityToDelete.id) {
          setSelectedAttachCityId(null);
        }
        await loadUnrecognizedCities();
        showToast('Город и все его синонимы удалены', 'success');
      }
    } catch (error) {
      console.error('Failed to delete city', error);
      showToast('Не удалось удалить город', 'error');
    } finally {
      setIsSubmitting(false);
      setCityToDelete(null);
    }
  };

  const handleUpdateCityName = async (cityId: string, newName: string) => {
    const originalCity = groupedSynonyms.find(g => g.cityId === cityId);
    if (!originalCity || originalCity.cityName === newName) {
      return;
    }

    const result = await updateCityName({ id: cityId, newCityName: newName });

    if (result.error) {
      showToast(result.error, 'error');
      // Optionally revert UI change here if needed
    } else {
      setSynonyms(prev => {
        const updated = prev.map(s => {
          if (s.cityId !== cityId) {
            return s;
          }
          const isCanonical = s.synonym.trim().toLowerCase() === originalCity.cityName.trim().toLowerCase();
          return {
            ...s,
            cityName: newName,
            synonym: isCanonical ? newName : s.synonym
          };
        });
        syncCitySynonyms(updated.map(record => ({ city: record.cityName, synonym: record.synonym })));
        return updated;
      });
      showToast('Название города обновлено', 'success');
    }
  };

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
        <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>Справочник городов</CardTitle>
                  <CardDescription>
                    Рабочая область для управления городами и их альтернативными написаниями.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={isLoading || isLoadingUnrecognized}
                  className="self-start lg:self-auto"
                >
                  Обновить
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                <div className="space-y-5">
                  <CityManagerUnrecognizedPanel
                    unrecognizedCityOptions={unrecognizedCityOptions}
                    selectedUnrecognizedCityId={selectedUnrecognizedCityId}
                    onSelectUnrecognizedCity={handleSelectUnrecognizedCity}
                    isLoadingUnrecognized={isLoadingUnrecognized}
                    isSubmitting={isSubmitting}
                    selectedUnrecognizedCity={selectedUnrecognizedCity}
                    onClearUnrecognizedSelection={handleClearUnrecognizedSelection}
                    onUseUnrecognizedCity={handleUseUnrecognizedCity}
                    useUnrecognizedAlternate={useUnrecognizedAlternate}
                    onToggleUseUnrecognizedAlternate={handleToggleUseUnrecognizedAlternate}
                    citySelectionOptions={citySelectionOptions}
                    selectedAttachCityId={selectedAttachCityId}
                    onSelectAttachCity={handleSelectAttachCity}
                    onAttachUnrecognizedCity={handleAttachUnrecognizedCity}
                    isAttachingUnrecognized={isAttachingUnrecognized}
                  />

                  <CityManagerCreateCitySection
                    newCity={newCity}
                    onCityChange={handleCityNameChange}
                    newCityInputRef={newCityInputRef}
                    useUnrecognizedAlternate={useUnrecognizedAlternate}
                    isSubmitting={isSubmitting}
                    onFindOnMap={handleFindCityOnMap}
                    isSearchingCoordinates={isSearchingCoordinates}
                    selectedCoordinates={selectedCoordinates}
                    selectedMarkerPreset={selectedMarkerPreset}
                    onMarkerPresetChange={handleNewCityMarkerPresetChange}
                    yandexApiKey={yandexApiKey}
                    mapState={mapState}
                    onMapInstanceChange={handleMapInstanceChange}
                    onSelectCoordinates={handleCoordinateSelection}
                    manualLat={manualLat}
                    manualLon={manualLon}
                    onManualLatChange={handleManualLatChange}
                    onManualLonChange={handleManualLonChange}
                    onManualBlur={handleManualBlur}
                    onManualApply={handleManualApply}
                  />

                </div>
              </form>

              <CityManagerSynonymListSection
                searchTerm={searchTerm}
                onSearchTermChange={handleSearchTermChange}
                onSearchKeyDown={handleSearchKeyDown}
                isLoading={isLoading}
                filteredGroupedSynonyms={filteredGroupedSynonyms}
                deletingMap={deletingMap}
                isSubmitting={isSubmitting}
                onDeleteSynonym={handleDeleteSynonym}
                onCityNameClick={handleCityNameClick}
                onUpdateCityName={handleUpdateCityName}
                onDeleteCity={handleDeleteClick}
                onMarkerPresetChange={handleMarkerPresetChange}
                markerUpdatingMap={markerUpdatingMap}
                formatCityCoordinates={formatCityCoordinates}
                onSynonymAdded={loadSynonyms}
                onToggleFavoriteCity={handleToggleFavoriteCity}
                favoriteUpdatingCityId={favoriteUpdatingCityId}
              />
            </CardContent>
          </Card>

          <div className="space-y-3">
            <CityManagerOverviewMapSection
              yandexApiKey={yandexApiKey}
              citiesWithCoordinates={citiesWithCoordinates}
              overviewMapState={overviewMapState}
              onMapInstanceChange={handleOverviewMapInstanceChange}
              formatCityCoordinates={formatCityCoordinates}
            />
            <CityManagerStatsCard
              totalCities={stats.totalCities}
              totalSynonyms={stats.totalSynonyms}
              customSynonyms={stats.customSynonyms}
              coverage={stats.coverage}
            />
          </div>
        </div>
      <ConfirmationModal
        isOpen={!!cityToDelete}
        onClose={() => setCityToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={`Удалить город ${cityToDelete?.name}?`}
        message="Это действие приведет к удалению города и всех связанных с ним синонимов. Отменить это действие будет невозможно."
        confirmText="Удалить"
        isLoading={isSubmitting}
      />
    </>
  )
}
