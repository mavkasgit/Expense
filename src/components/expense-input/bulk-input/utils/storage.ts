import { COLUMN_MAPPING_STORAGE_KEY, TABLE_INDEX_STORAGE_KEY } from '../constants';
import { sanitizeColumnMapping } from './columnMapping';
import type { ColumnMapping } from '@/types';

export function loadSavedColumnMapping(): ColumnMapping[] {
  try {
    const raw = localStorage.getItem(COLUMN_MAPPING_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return sanitizeColumnMapping(parsed);
  } catch (error) {
    console.warn('Ошибка загрузки сохраненной схемы столбцов:', error);
    return [];
  }
}

export function saveColumnMapping(mapping: ColumnMapping[]): void {
  try {
    const sanitized = sanitizeColumnMapping(mapping);
    if (sanitized.length === 0) {
      localStorage.removeItem(COLUMN_MAPPING_STORAGE_KEY);
      return;
    }
    localStorage.setItem(COLUMN_MAPPING_STORAGE_KEY, JSON.stringify(sanitized));
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
