import type { ColumnMapping, ColumnMappingField } from '@/types';

const COLUMN_MAPPING_FIELDS: ColumnMappingField[] = [
  'amount',
  'description',
  'city',
  'expense_date',
  'expense_time',
  'notes',
];

const COLUMN_MAPPING_FIELD_SET = new Set<ColumnMappingField>(COLUMN_MAPPING_FIELDS);

export function isColumnMappingField(value: unknown): value is ColumnMappingField {
  return typeof value === 'string' && COLUMN_MAPPING_FIELD_SET.has(value as ColumnMappingField);
}

export function normalizeColumnMapping(raw: unknown): ColumnMapping[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((item, index) => {
    const candidate = item as Partial<ColumnMapping> & { targetField?: unknown };

    const directTargets = Array.isArray(candidate?.targetFields)
      ? candidate.targetFields.filter(isColumnMappingField)
      : [];

    const legacyTarget = isColumnMappingField(candidate?.targetField)
      ? [candidate.targetField]
      : [];

    const combinedTargets = [...directTargets, ...legacyTarget];
    const normalizedTargets = Array.from(new Set(combinedTargets));

    const normalizedEnabled = typeof candidate?.enabled === 'boolean'
      ? candidate.enabled && normalizedTargets.length > 0
      : normalizedTargets.length > 0;

    const result: ColumnMapping = {
      sourceIndex: typeof candidate?.sourceIndex === 'number' ? candidate.sourceIndex : index,
      targetFields: normalizedEnabled ? normalizedTargets : [],
      enabled: normalizedEnabled && normalizedTargets.length > 0,
      preview: typeof candidate?.preview === 'string' ? candidate.preview : '',
      hidden: Boolean(candidate?.hidden),
    };

    // Сохраняем настройки кастомного разделения если они есть
    if (typeof candidate?.customSplitSeparator === 'string' && candidate.customSplitSeparator) {
      result.customSplitSeparator = candidate.customSplitSeparator;
    }
    
    // Валидация customSplitParts: должен быть объект с числовыми значениями >= 0
    if (candidate?.customSplitParts && 
        typeof candidate.customSplitParts === 'object' && 
        candidate.customSplitParts !== null &&
        !Array.isArray(candidate.customSplitParts)) {
      const validParts: Record<string, number> = {};
      for (const [key, value] of Object.entries(candidate.customSplitParts)) {
        if (typeof value === 'number' && value >= 0 && Number.isInteger(value)) {
          validParts[key] = value;
        }
      }
      if (Object.keys(validParts).length > 0) {
        result.customSplitParts = validParts;
      }
    }
    
    // Сохраняем пример строки для демонстрации разделения
    if (typeof candidate?.customSplitExample === 'string' && candidate.customSplitExample) {
      result.customSplitExample = candidate.customSplitExample;
    }

    return result;
  });
}

/**
 * Sanitize column mapping by validating and normalizing all fields.
 * Used before saving to localStorage or applying to data processing.
 * Preserves customSplitSeparator, customSplitParts and customSplitExample if valid.
 */
export function sanitizeColumnMapping(mapping: ColumnMapping[]): ColumnMapping[] {
  return normalizeColumnMapping(mapping);
}

export { COLUMN_MAPPING_FIELDS };
