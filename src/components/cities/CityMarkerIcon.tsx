'use client'

import { markerPresetLookup } from '@/lib/constants/cityMarkers'
import { normaliseMarkerPreset } from '@/lib/utils/cityCoordinates'
import { cn } from '@/lib/utils'

interface CityMarkerIconProps {
  preset?: string | null
  active?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeToClass: Record<NonNullable<CityMarkerIconProps['size']>, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6'
}

export function CityMarkerIcon({
  preset,
  active = true,
  className,
  size = 'sm'
}: CityMarkerIconProps) {
  const normalisedPreset = normaliseMarkerPreset(preset)
  const marker = markerPresetLookup.get(normalisedPreset)
  const baseColor = marker?.color ?? '#0EA5E9'
  const color = active ? baseColor : '#94A3B8'
  const isVirtual = marker?.isVirtual

  if (isVirtual) {
    // Иконка глобуса/интернета для виртуальных городов
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={cn(sizeToClass[size], 'shrink-0 transition', className)}
        style={{ color }}
      >
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"
          fill="currentColor"
        />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn(sizeToClass[size], 'shrink-0 transition', className)}
      style={{ color }}
    >
      <path
        d="M12 2.25a6.25 6.25 0 0 0-6.25 6.25c0 4.69 5.15 11.06 5.37 11.32a1 1 0 0 0 1.76 0c.22-.26 5.37-6.63 5.37-11.32A6.25 6.25 0 0 0 12 2.25Zm0 8.75a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"
        fill="currentColor"
      />
    </svg>
  )
}
