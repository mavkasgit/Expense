import { extractCityFromDescription, batchExtractCities, getCityStats, syncCitySynonyms } from '../cityParser'
import { parseCityCoordinates } from '../cityCoordinates'
import { VIRTUAL_CITY_MARKER_PRESET } from '@/lib/constants/cityMarkers'

describe('cityParser', () => {
  describe('extractCityFromDescription', () => {
    beforeEach(() => {
      syncCitySynonyms([])
    })

    test('should extract city from "BY НАЗВАНИЕ, ГОРОД" format', () => {
      const result = extractCityFromDescription('BY SUPERMARKET LOGOYSK')
      expect(result.city).toBe('LOGOYSK')
      expect(result.displayCity).toBe('Logoysk')
      expect(result.cleanDescription).toBe('Supermarket')
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    test('should extract city from "MN ГОРОДBY НАЗВАНИЕ" format', () => {
      const result = extractCityFromDescription('MN LOGOYSKBY SHOP "MAYAK", LOGOYSK')
      expect(result.city).toBe('LOGOYSK')
      expect(result.displayCity).toBe('Logoysk')
      expect(result.cleanDescription).toContain('Shop')
      expect(result.confidence).toBeGreaterThan(0.5)
    })

    test('should extract city from "BY НАЗВАНИЕ, ГОРОД" format', () => {
      const result = extractCityFromDescription('BY KEBAB FACTORY, MINSK')
      expect(result.city).toBe('MINSK')
      expect(result.displayCity).toBe('Minsk')
      expect(result.cleanDescription).toBe('Kebab Factory')
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    test('should handle unknown cities with lower confidence', () => {
      const result = extractCityFromDescription('BY SHOP, UNKNOWN_CITY')
      expect(result.city).toBeNull()
      expect(result.confidence).toBeLessThan(0.5)
    })

    test('should handle empty or invalid input', () => {
      const result1 = extractCityFromDescription('')
      expect(result1.city).toBeNull()
      expect(result1.confidence).toBe(0)

      const result2 = extractCityFromDescription(null as any)
      expect(result2.city).toBeNull()
      expect(result2.confidence).toBe(0)
    })

    test('should clean description properly', () => {
      const result = extractCityFromDescription('BY "SUPER MARKET", MINSK')
      expect(result.cleanDescription).toBe('Super Market')
      expect(result.city).toBe('MINSK')
      expect(result.displayCity).toBe('Minsk')
    })

    test('should resolve synonym to canonical city', () => {
      syncCitySynonyms([{ city: 'Minsk', synonym: 'Минск' }])

      const result = extractCityFromDescription('BY SUPERMARKET, Минск')
      expect(result.city).toBe('MINSK')
      expect(result.displayCity).toBe('Minsk (Минск)')
      expect(result.matchedSynonym).toBe('Минск')
      expect(result.confidence).toBeGreaterThan(0.5)
    })
  })

  describe('batchExtractCities', () => {
    test('should process multiple descriptions', () => {
      const descriptions = [
        'BY SUPERMARKET LOGOYSK',
        'MN LOGOYSKBY SHOP "MAYAK", LOGOYSK',
        'BY KEBAB FACTORY, MINSK'
      ]
      
      const results = batchExtractCities(descriptions)
      expect(results).toHaveLength(3)
      expect(results[0].city).toBe('LOGOYSK')
      expect(results[0].displayCity).toBe('Logoysk')
      expect(results[2].city).toBe('MINSK')
      expect(results[2].displayCity).toBe('Minsk')
    })
  })

  describe('getCityStats', () => {
    test('should calculate city statistics', () => {
      const descriptions = [
        'BY SUPERMARKET LOGOYSK',
        'BY SHOP, MINSK',
        'BY CAFE, MINSK',
        'BY STORE, LOGOYSK'
      ]

      const stats = getCityStats(descriptions)
      expect(stats['Minsk']).toBe(2)
      expect(stats['Logoysk']).toBe(2)
    })
  })

  describe('parseCityCoordinates', () => {
    test('returns numeric coordinates when lat/lon provided', () => {
      const result = parseCityCoordinates({ lat: 51.5, lon: 39.2, markerPreset: 'islands#redIcon' })
      expect(result).not.toBeNull()
      expect(result?.lat).toBeCloseTo(51.5)
      expect(result?.lon).toBeCloseTo(39.2)
      expect(result?.markerPreset).toBe('islands#redIcon')
      expect(result?.isVirtual).toBeFalsy()
    })

    test('returns virtual coordinates when marker preset is virtual', () => {
      const result = parseCityCoordinates({ markerPreset: VIRTUAL_CITY_MARKER_PRESET, lat: null, lon: null })
      expect(result).not.toBeNull()
      expect(result?.isVirtual).toBe(true)
      expect(result?.lat).toBeNull()
      expect(result?.lon).toBeNull()
      expect(result?.markerPreset).toBe(VIRTUAL_CITY_MARKER_PRESET)
    })

    test('returns null when coordinates missing without virtual marker', () => {
      const result = parseCityCoordinates({ markerPreset: 'islands#blueIcon' })
      expect(result).toBeNull()
    })
  })
})