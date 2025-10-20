'use client'

import { useState, useEffect, useMemo } from 'react'
import * as Slider from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

interface DateRangeSliderProps {
  value: [number, number]
  min: number
  max: number
  onValueCommit: (value: [number, number]) => void
  disabled?: boolean
}

export function DateRangeSlider({ value, min, max, onValueCommit, disabled }: DateRangeSliderProps) {
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const monthMarks = useMemo(() => {
    if (min >= max) return []

    const marks = []
    const startDate = new Date(min)
    const endDate = new Date(max)

    let currentDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1)

    while (currentDate <= endDate) {
      marks.push(currentDate.getTime())
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    }

    return marks
  }, [min, max])

  if (min >= max) {
    return null // Не рендерим слайдер, если диапазон невалидный
  }

  return (
    <div className="relative">
      <Slider.Root
        className={cn('relative flex w-full touch-none select-none items-center', disabled && 'opacity-50')}
        value={localValue}
        min={min}
              max={max}
              step={86400000} // 1 день в миллисекундах
              onValueChange={(newValue) => setLocalValue(newValue as [number, number])}
              onValueCommit={onValueCommit}
              minStepsBetweenThumbs={0}        disabled={disabled}
      >
        <Slider.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-200">
          <Slider.Range className="absolute h-full bg-indigo-600" />
        </Slider.Track>
        <Slider.Thumb className="block h-5 w-5 rounded-full border-2 border-indigo-600 bg-white ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
        <Slider.Thumb className="block h-5 w-5 rounded-full border-2 border-indigo-600 bg-white ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
      </Slider.Root>
      <div className="absolute w-full top-1/2 -translate-y-1/2 h-2 pointer-events-none">
        {monthMarks.map(mark => {
          const percent = ((mark - min) / (max - min)) * 100
          return (
            <div 
              key={mark}
              className="absolute w-px h-4 bg-gray-400 -translate-y-1/2 top-1/2"
              style={{ left: `${percent}%` }}
            />
          )
        })}
      </div>
    </div>
  )
}
