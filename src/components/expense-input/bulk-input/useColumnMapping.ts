'use client'

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
import type { ColumnMapping, ColumnMappingField } from '@/types';

const COLUMN_MAPPING_FIELDS: ColumnMappingField[] = ['amount', 'description', 'city', 'expense_date', 'expense_time', 'notes'];
const COLUMN_MAPPING_FIELD_SET = new Set<ColumnMappingField>(COLUMN_MAPPING_FIELDS);

function isColumnMappingField(value: unknown): value is ColumnMappingField {
  return typeof value === 'string' && COLUMN_MAPPING_FIELD_SET.has(value as ColumnMappingField);
}

function normalizeColumnMapping(raw: unknown): ColumnMapping[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const candidate = item as Partial<ColumnMapping> & { targetField?: unknown };
    const directTargets = Array.isArray(candidate?.targetFields) ? candidate.targetFields.filter(isColumnMappingField) : [];
    const legacyTarget = isColumnMappingField(candidate?.targetField) ? [candidate.targetField] : [];
    const uniqueTargets = Array.from(new Set([...directTargets, ...legacyTarget]));
    const normalizedTargets = uniqueTargets.filter(isColumnMappingField);
    const normalizedEnabled = typeof candidate?.enabled === 'boolean' ? candidate.enabled && normalizedTargets.length > 0 : normalizedTargets.length > 0;
    return {
      sourceIndex: typeof candidate?.sourceIndex === 'number' ? candidate.sourceIndex : index,
      targetFields: normalizedEnabled ? normalizedTargets : [],
      enabled: normalizedEnabled && normalizedTargets.length > 0,
      preview: typeof candidate?.preview === 'string' ? candidate.preview : '',
      hidden: Boolean(candidate?.hidden)
    };
  });
}

function sanitizeColumnMapping(mapping: ColumnMapping[]): ColumnMapping[] {
  return normalizeColumnMapping(mapping);
}

interface UseColumnMappingProps {
  buildExpensesFromMappedData: (mapping: ColumnMapping[]) => any; 
  appendExpensesWithStats: (result: any) => void;
  saveImportedExpenses: (result: any, fileName: string) => Promise<boolean>;
  fileName: string;
  setReviewModalState: (state: any) => void;
  isColumnMappingOpen: boolean;
  setIsColumnMappingOpen: (isOpen: boolean) => void;
  isEditingColumnMapping: boolean;
  setIsEditingColumnMapping: (isEditing: boolean) => void;
}

export function useColumnMapping({ 
  buildExpensesFromMappedData, 
  appendExpensesWithStats, 
  saveImportedExpenses, 
  fileName, 
  setReviewModalState,
  isColumnMappingOpen,
  setIsColumnMappingOpen,
  isEditingColumnMapping,
  setIsEditingColumnMapping
}: UseColumnMappingProps) {
  const { showToast } = useToast();
  const [savedColumnMapping, setSavedColumnMapping] = useState<ColumnMapping[] | null>(null);

  const loadSavedColumnMapping = useCallback(() => {
    try {
      const saved = localStorage.getItem('columnMapping');
      if (saved) {
        const parsed = JSON.parse(saved);
        const sanitized = sanitizeColumnMapping(parsed);
        setSavedColumnMapping(sanitized);
        return sanitized;
      }
    } catch (error) {
      console.warn('Ошибка загрузки сохраненного сопоставления столбцов:', error);
    }
    return [];
  }, []);

  const saveColumnMapping = useCallback((mapping: ColumnMapping[]) => {
    try {
      const sanitized = sanitizeColumnMapping(mapping);
      localStorage.setItem('columnMapping', JSON.stringify(sanitized));
      setSavedColumnMapping(sanitized);
      showToast('Настройки столбцов сохранены', 'success');
    } catch (error) {
      console.warn('Ошибка сохранения сопоставления столбцов:', error);
      showToast('Не удалось сохранить настройки столбцов', 'error');
    }
  }, [showToast]);

  const handleColumnMappingApply = useCallback((mapping: ColumnMapping[]) => {
    const result = buildExpensesFromMappedData(mapping);
    appendExpensesWithStats(result);
    setIsColumnMappingOpen(false);
  }, [buildExpensesFromMappedData, appendExpensesWithStats, setIsColumnMappingOpen]);

  const handleColumnMappingApplyAndSave = useCallback(async (mapping: ColumnMapping[]) => {
    saveColumnMapping(mapping);
    const result = buildExpensesFromMappedData(mapping);
    if (result.expenses.length === 0) {
      showToast('Не удалось обработать данные с текущими настройками столбцов', 'error');
      return;
    }
    if (result.reviewItems.length > 0) {
      setReviewModalState({ mode: 'directSave', result });
      showToast('Найдены автоматически выделенные поля. Подтвердите сохранение.', 'info');
      return;
    }
    await saveImportedExpenses(result, fileName);
  }, [buildExpensesFromMappedData, saveImportedExpenses, fileName, setReviewModalState, saveColumnMapping, showToast]);

  return {
    savedColumnMapping,
    loadSavedColumnMapping,
    handleColumnMappingApply,
    handleColumnMappingApplyAndSave,
  };
}
