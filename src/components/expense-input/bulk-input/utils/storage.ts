import { COLUMN_MAPPING_STORAGE_KEY, TABLE_INDEX_STORAGE_KEY } from '../constants';
import { sanitizeColumnMapping } from './columnMapping';
import type { ColumnMapping } from '@/types';

const MAPPINGS_BY_FORMAT_KEY = 'expense-bulk-column-mappings-by-format';

export type DataSourceFormat = 'csv' | 'xlsx' | 'xls' | 'html' | 'clipboard' | 'unknown';

interface FormatMappingStorage {
  [format: string]: ColumnMapping[];
}

// Определение формата из имени файла или источника
export function getDataSourceFormat(fileName?: string): DataSourceFormat {
  if (!fileName) {
    return 'clipboard';
  }
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'csv':
      return 'csv';
    case 'xlsx':
      return 'xlsx';
    case 'xls':
      return 'xls';
    case 'html':
    case 'htm':
      return 'html';
    default:
      return 'unknown';
  }
}

// Загрузка всех сохраненных настроек для всех форматов
export function loadAllFormatMappings(): FormatMappingStorage {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = localStorage.getItem(MAPPINGS_BY_FORMAT_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Ошибка загрузки настроек форматов:', error);
    return {};
  }
}

// Сохранение настроек для всех форматов
function saveAllFormatMappings(storage: FormatMappingStorage): void {
  try {
    localStorage.setItem(MAPPINGS_BY_FORMAT_KEY, JSON.stringify(storage));
  } catch (error) {
    console.warn('Ошибка сохранения настроек форматов:', error);
  }
}

// Загрузка настроек для конкретного формата
export function loadSavedColumnMapping(format?: DataSourceFormat): ColumnMapping[] {
  try {
    if (!format) {
      // Fallback к старому способу хранения
      const raw = localStorage.getItem(COLUMN_MAPPING_STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return sanitizeColumnMapping(parsed);
    }

    const allMappings = loadAllFormatMappings();
    const formatMappings = allMappings[format];
    
    if (!formatMappings) {
      return [];
    }
    
    return sanitizeColumnMapping(formatMappings);
  } catch (error) {
    console.warn('Ошибка загрузки сохраненной схемы столбцов:', error);
    return [];
  }
}

// Сохранение настроек для конкретного формата
export function saveColumnMapping(mapping: ColumnMapping[], format?: DataSourceFormat): void {
  try {
    const sanitized = sanitizeColumnMapping(mapping);
    
    // Сохраняем только столбцы с полями ИЛИ скрытые столбцы (чтобы не потерять информацию о скрытости)
    const activeMappings = sanitized.filter(m => 
      (m.targetFields && m.targetFields.length > 0) || m.hidden
    );

    if (!format) {
      // Fallback к старому способу хранения
      if (activeMappings.length === 0) {
        localStorage.removeItem(COLUMN_MAPPING_STORAGE_KEY);
        return;
      }
      localStorage.setItem(COLUMN_MAPPING_STORAGE_KEY, JSON.stringify(activeMappings));
      return;
    }

    const allMappings = loadAllFormatMappings();
    
    if (activeMappings.length === 0) {
      delete allMappings[format];
    } else {
      allMappings[format] = activeMappings;
    }

    saveAllFormatMappings(allMappings);
  } catch (error) {
    console.warn('Ошибка сохранения схемы столбцов:', error);
  }
}

export function loadSavedTableIndex(): number | null {
  try {
    const raw = localStorage.getItem(TABLE_INDEX_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const index = parseInt(raw, 10);
    return Number.isFinite(index) ? index : null;
  } catch (error) {
    console.warn('Ошибка загрузки сохраненного индекса таблицы:', error);
    return null;
  }
}

export function saveTableIndex(index: number): void {
  try {
    localStorage.setItem(TABLE_INDEX_STORAGE_KEY, index.toString());
  } catch (error) {
    console.warn('Ошибка сохранения индекса таблицы:', error);
  }
}

export function clearSavedTableIndex(): void {
  try {
    localStorage.removeItem(TABLE_INDEX_STORAGE_KEY);
  } catch (error) {
    console.warn('Ошибка очистки индекса таблицы:', error);
  }
}

// Удаление настроек для конкретного формата
export function deleteColumnMapping(format: DataSourceFormat): void {
  try {
    const allMappings = loadAllFormatMappings();
    delete allMappings[format];
    saveAllFormatMappings(allMappings);
  } catch (error) {
    console.warn('Ошибка удаления настроек формата:', error);
  }
}
