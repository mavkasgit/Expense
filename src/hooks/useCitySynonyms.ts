'use client'

import { useCallback, useEffect, useState } from 'react'
import { getCitySynonyms } from '@/lib/actions/synonyms'
import { syncCitySynonyms } from '@/lib/utils/cityParser'
import { hasGeoPoint, isVirtualCoordinates, parseCityCoordinates, normaliseMarkerPreset } from '@/lib/utils/cityCoordinates'
import type { CitySynonymOptionRecord, CitySynonymWithCity } from '@/types'

export function useCitySynonyms() {
  const [synonyms, setSynonyms] = useState<CitySynonymOptionRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadSynonyms = useCallback(async (): Promise<CitySynonymOptionRecord[]> => {
    try {
      const result = await getCitySynonyms()
      if (result.success && result.data) {
        const records = (result.data as CitySynonymWithCity[])
          .map((record) => {
            const cityId = record.city?.id ?? record.city_id
            const cityName = record.city?.name ?? record.synonym
            if (!cityId) {
              return null
            }

            const parsedCoordinates = parseCityCoordinates(record.city?.coordinates ?? null)

            return {
              id: Number(record.id),
              cityId,
              cityName,
              synonym: record.synonym,
              markerPreset: parsedCoordinates ? normaliseMarkerPreset(parsedCoordinates.markerPreset) : null,
              hasCoordinates: Boolean(parsedCoordinates && hasGeoPoint(parsedCoordinates) && !isVirtualCoordinates(parsedCoordinates)),
              isFavorite: Boolean(record.city?.is_favorite)
            } satisfies CitySynonymOptionRecord
          })
          .filter((record): record is CitySynonymOptionRecord => record !== null)

        syncCitySynonyms(records.map(record => ({ city: record.cityName, synonym: record.synonym })))
        return records
      }
    } catch (error) {
      console.error('Failed to preload city synonyms', error)
    }

    return []
  }, [])

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      setIsLoading(true)
      const records = await loadSynonyms()
      if (!isMounted) {
        return
      }

      setSynonyms(records)
      setIsLoading(false)
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [loadSynonyms])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    const records = await loadSynonyms()
    setSynonyms(records)
    setIsLoading(false)
  }, [loadSynonyms])

  const updateCityFavorite = useCallback((cityId: string, isFavorite: boolean) => {
    setSynonyms(prev =>
      prev.map(record =>
        record.cityId === cityId
          ? { ...record, isFavorite }
          : record
      )
    )
  }, [])

  return { synonyms, isLoading, refresh, updateCityFavorite }
}
