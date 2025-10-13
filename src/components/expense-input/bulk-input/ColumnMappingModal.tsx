'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { ColumnMapping, ColumnMappingField } from '@/types'
import { getColumnLabel } from './utils/columnMapping'

interface ColumnMappingModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (mapping: ColumnMapping[]) => void
  onApplyAndSave?: (mapping: ColumnMapping[]) => void
  sampleData: string[][]
  savedMapping?: ColumnMapping[] | null
  isEditingMode?: boolean
  tableDescription?: string | null
  onReplaceTable?: () => void
}

interface ColumnConfig {
  sourceIndex: number
  label: string
  preview: string[]
  targetFields: ColumnMappingField[]
  hidden: boolean
}

const FIELD_OPTIONS: Array<{ value: ColumnMappingField; label: string; required?: boolean }> = [
  { value: 'amount', label: 'Сумма', required: true },
  { value: 'description', label: 'Описание', required: true },
  { value: 'city', label: 'Город' },
  { value: 'expense_date', label: 'Дата' },
  { value: 'expense_time', label: 'Время' },
  { value: 'notes', label: 'Примечания' }
]

const REQUIRED_FIELDS = FIELD_OPTIONS.filter(option => option.required).map(option => option.value)

function buildInitialConfig(sampleData: string[][], savedMapping?: ColumnMapping[] | null): ColumnConfig[] {
  const columnCount = Math.max(0, ...sampleData.map(row => row.length))
  const headerRow = sampleData[0] ?? []
  const previewRows = sampleData.slice(0, 4)

  return Array.from({ length: columnCount }, (_, index) => {
    const saved = savedMapping?.[index]
    const preview = previewRows.map(row => row[index] ?? '')
    const label = getColumnLabel(index, headerRow)

    const targetFields = saved?.targetFields && saved.targetFields.length > 0
      ? saved.targetFields.filter((value): value is ColumnMappingField => FIELD_OPTIONS.some(option => option.value === value))
      : []

    return {
      sourceIndex: index,
      label,
      preview,
      targetFields,
      hidden: Boolean(saved?.hidden)
    }
  })
}

function toColumnMapping(config: ColumnConfig[]): ColumnMapping[] {
  return config.map(column => ({
    sourceIndex: column.sourceIndex,
    targetFields: column.hidden ? [] : column.targetFields,
    enabled: !column.hidden && column.targetFields.length > 0,
    preview: column.preview.join(' | ').slice(0, 80),
    hidden: column.hidden
  }))
}

export function ColumnMappingModal({
  isOpen,
  onClose,
  onApply,
  onApplyAndSave,
  sampleData,
  savedMapping,
  isEditingMode = false,
  tableDescription,
  onReplaceTable
}: ColumnMappingModalProps) {
  const [config, setConfig] = useState<ColumnConfig[]>([])

  useEffect(() => {
    if (isOpen) {
      setConfig(buildInitialConfig(sampleData, savedMapping))
    }
  }, [isOpen, sampleData, savedMapping])

  const selectedFields = useMemo(() => {
    const map = new Map<ColumnMappingField, number>()
    config.forEach(column => {
      if (column.hidden) return
      column.targetFields.forEach(field => {
        map.set(field, (map.get(field) ?? 0) + 1)
      })
    })
    return map
  }, [config])

  const missingRequired = REQUIRED_FIELDS.filter(field => (selectedFields.get(field) ?? 0) === 0)

  const handleToggleField = (index: number, field: ColumnMappingField) => {
    setConfig(prev =>
      prev.map(column => {
        if (column.sourceIndex !== index) {
          return column
        }
        const exists = column.targetFields.includes(field)
        return {
          ...column,
          targetFields: exists
            ? column.targetFields.filter(item => item !== field)
            : [...column.targetFields, field]
        }
      })
    )
  }

  const handleToggleHidden = (index: number) => {
    setConfig(prev =>
      prev.map(column =>
        column.sourceIndex === index
          ? { ...column, hidden: !column.hidden }
          : column
      )
    )
  }

  const handleApply = (mode: 'apply' | 'applyAndSave') => {
    const mapping = toColumnMapping(config)
    if (mode === 'applyAndSave' && onApplyAndSave) {
      onApplyAndSave(mapping)
    } else {
      onApply(mapping)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Настройка соответствия столбцов"
      size="xl"
    >
      <div className="space-y-6">
        {tableDescription && (
          <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <span className="font-medium">Таблица: {tableDescription}</span>
            {onReplaceTable && (
              <Button variant="ghost" size="sm" onClick={onReplaceTable}>
                Сменить таблицу
              </Button>
            )}
          </div>
        )}

        {missingRequired.length > 0 && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            Назначьте обязательные поля:{' '}
            {missingRequired
              .map(field => FIELD_OPTIONS.find(option => option.value === field)?.label)
              .filter((label): label is string => Boolean(label))
              .join(', ')}
          </div>
        )}

        <div className="overflow-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Столбец
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Предпросмотр
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Поля
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Видимость
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {config.map(column => (
                <tr key={column.sourceIndex} className={column.hidden ? 'bg-gray-50 text-gray-400' : undefined}>
                  <td className="px-3 py-3 align-top font-medium text-gray-900">
                    {column.label}
                  </td>
                  <td className="px-3 py-3 align-top text-xs text-gray-600">
                    <div className="space-y-1 whitespace-pre-wrap break-words">
                      {column.preview.length > 0
                        ? column.preview.map((value, index) => (
                            <div key={index}>{value || '—'}</div>
                          ))
                        : 'Нет данных'}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-wrap gap-2">
                      {FIELD_OPTIONS.map(option => {
                        const checked = column.targetFields.includes(option.value)
                        const disabled = column.hidden
                        return (
                          <label
                            key={option.value}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${
                              checked
                                ? 'border-blue-400 bg-blue-50 text-blue-700'
                                : 'border-gray-200 bg-gray-100 text-gray-600'
                            } ${disabled ? 'opacity-60' : 'cursor-pointer hover:border-blue-300'}`}
                          >
                            <input
                              type="checkbox"
                              className="h-3 w-3"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => handleToggleField(column.sourceIndex, option.value)}
                            />
                            <span>
                              {option.label}
                              {option.required && <span className="ml-1 text-red-500">*</span>}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={column.hidden}
                        onChange={() => handleToggleHidden(column.sourceIndex)}
                      />
                      Скрыть столбец
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">
            Назначьте, какие поля расходов соответствуют каждому столбцу. Обязательные поля помечены *.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button variant="secondary" onClick={() => handleApply('apply')}>
              {isEditingMode ? 'Сохранить' : 'Применить'}
            </Button>
            {onApplyAndSave && !isEditingMode && (
              <Button variant="primary" onClick={() => handleApply('applyAndSave')}>
                Применить и сохранить
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
