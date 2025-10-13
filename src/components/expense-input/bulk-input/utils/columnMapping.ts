import type { ColumnMapping, ColumnMappingField } from '@/types'

const COLUMN_MAPPING_FIELDS: ColumnMappingField[] = [
  'amount',
  'description',
  'city',
  'expense_date',
  'expense_time',
  'notes'
]

const COLUMN_MAPPING_FIELD_SET = new Set<ColumnMappingField>(COLUMN_MAPPING_FIELDS)

export function isColumnMappingField(value: unknown): value is ColumnMappingField {
  return typeof value === 'string' && COLUMN_MAPPING_FIELD_SET.has(value as ColumnMappingField)
}

export function normalizeColumnMapping(raw: unknown): ColumnMapping[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.map((item, index) => {
    const candidate = item as Partial<ColumnMapping> & { targetField?: unknown }

    const directTargets = Array.isArray(candidate?.targetFields)
      ? candidate.targetFields.filter(isColumnMappingField)
      : []

    const legacyTarget = isColumnMappingField(candidate?.targetField)
      ? [candidate.targetField]
      : []

    const combinedTargets = [...directTargets, ...legacyTarget]
    const uniqueTargets = Array.from(new Set(combinedTargets))

    const normalizedTargets = uniqueTargets.filter(isColumnMappingField)

    const normalizedEnabled = typeof candidate?.enabled === 'boolean'
      ? candidate.enabled && normalizedTargets.length > 0
      : normalizedTargets.length > 0

    return {
      sourceIndex: typeof candidate?.sourceIndex === 'number' ? candidate.sourceIndex : index,
      targetFields: normalizedEnabled ? normalizedTargets : [],
      enabled: normalizedEnabled && normalizedTargets.length > 0,
      preview: typeof candidate?.preview === 'string' ? candidate.preview : '',
      hidden: Boolean(candidate?.hidden)
    }
  })
}

export function sanitizeColumnMapping(mapping: ColumnMapping[]): ColumnMapping[] {
  return normalizeColumnMapping(mapping)
}

export function getColumnLabel(index: number, headerRow?: string[] | null): string {
  const headerValue = headerRow?.[index]?.trim()
  if (headerValue) {
    return headerValue
  }

  if (index >= 0 && index < 26) {
    return `Столбец ${String.fromCharCode(65 + index)}`
  }

  return `Столбец ${index + 1}`
}

export const COLUMN_MAPPING_STORAGE_KEY = 'bulkExpenseColumnMapping'
