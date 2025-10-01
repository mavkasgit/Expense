export type MarkerPresetConfig = {
  value: string
  label: string
  color: string
  isVirtual?: boolean
}

export const DEFAULT_MARKER_PRESET = 'islands#blueIcon'
export const VIRTUAL_CITY_MARKER_PRESET = 'virtual#ghostIcon'

export const MARKER_PRESETS: MarkerPresetConfig[] = [
  { value: 'islands#blueIcon', label: 'Синий маркер', color: '#2563EB' },
  { value: 'islands#redIcon', label: 'Красный маркер', color: '#DC2626' },
  { value: 'islands#greenIcon', label: 'Зелёный маркер', color: '#16A34A' },
  { value: 'islands#darkOrangeIcon', label: 'Оранжевый маркер', color: '#EA580C' },
  { value: 'islands#violetIcon', label: 'Фиолетовый маркер', color: '#7C3AED' },
  { value: 'islands#blackIcon', label: 'Графитовый маркер', color: '#1F2937' },
  { value: 'islands#yellowIcon', label: 'Жёлтый маркер', color: '#CA8A04' },
  { value: 'islands#darkGreenIcon', label: 'Хвойный маркер', color: '#047857' },
  { value: VIRTUAL_CITY_MARKER_PRESET, label: 'Виртуальный город', color: '#64748B', isVirtual: true }
]

export const markerPresetLookup = new Map(MARKER_PRESETS.map((preset) => [preset.value, preset] as const))

export function getMarkerColor(preset?: string | null, fallback?: string) {
  const normalised = preset ?? DEFAULT_MARKER_PRESET
  return markerPresetLookup.get(normalised)?.color ?? fallback ?? '#94A3B8'
}
