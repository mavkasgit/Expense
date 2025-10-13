import type { ColumnMapping } from '@/types';
import type { CityOption } from '@/lib/utils/cityOptions';
import type { BuildExpensesResult, ReviewModalState } from '../types';
import type { ToastType } from '@/hooks/useToast';
import { buildExpensesFromMappedData } from './importBuilder';
import { sanitizeColumnMapping } from './columnMapping';

interface ColumnMappingWorkflowOptions {
  hasHeaderRow: boolean;
  pastedData: string[][];
  resolveCityByInput: (value: string) => CityOption | null;
  saveImportedExpenses: (result: BuildExpensesResult) => Promise<boolean>;
  appendImportStats: (result: BuildExpensesResult, mode: 'append' | 'save') => void;
  showToast: (message: string, type?: ToastType) => void;
  isEditingColumnMapping: boolean;
  reviewModalState: ReviewModalState | null;
  setReviewModalState: (state: ReviewModalState | null) => void;
  setIsReviewProcessing: (value: boolean) => void;
  setSavedColumnMapping: (mapping: ColumnMapping[] | null) => void;
  setIsColumnMappingOpen: (value: boolean) => void;
  setIsEditingColumnMapping: (value: boolean) => void;
  hasPendingDataset: boolean;
  persistColumnMapping: (mapping: ColumnMapping[]) => void;
}

export function createColumnMappingHandlers({
  hasHeaderRow,
  pastedData,
  resolveCityByInput,
  saveImportedExpenses,
  appendImportStats,
  showToast,
  isEditingColumnMapping,
  reviewModalState,
  setReviewModalState,
  setIsReviewProcessing,
  setSavedColumnMapping,
  setIsColumnMappingOpen,
  setIsEditingColumnMapping,
  hasPendingDataset,
  persistColumnMapping,
}: ColumnMappingWorkflowOptions) {
  const applyMapping = async (mapping: ColumnMapping[], mode: 'append' | 'directSave') => {
    const sanitized = sanitizeColumnMapping(mapping);
    persistColumnMapping(sanitized);

    const hasActiveMapping = sanitized.some(m => m.targetFields && m.targetFields.length > 0);
    setSavedColumnMapping(hasActiveMapping ? sanitized : null);

    if (mode === 'append' && isEditingColumnMapping) {
      showToast('Настройки столбцов сохранены', 'success');
      return;
    }

    const result = buildExpensesFromMapping({
      mapping: sanitized,
      dataset: pastedData,
      hasHeaderRow,
      resolveCityByInput,
    });

    if (result.expenses.length === 0) {
      showToast('Не удалось обработать данные с текущими настройками столбцов', 'error');
      return;
    }

    if (result.reviewItems.length > 0) {
      setReviewModalState({ mode, result });
      showToast(
        mode === 'append'
          ? 'Найдены автоматически выделенные поля. Подтвердите импорт.'
          : 'Найдены автоматически выделенные поля. Подтвердите сохранение.',
        'info',
      );
      return;
    }

    if (mode === 'append') {
      appendImportStats(result, 'append');
    } else {
      const success = await saveImportedExpenses(result);
      if (success) {
        setReviewModalState(null);
      }
    }
  };

  const handleColumnMappingApply = (mapping: ColumnMapping[]) => {
    void applyMapping(mapping, 'append');
  };

  const handleColumnMappingApplyAndSave = (mapping: ColumnMapping[]) => {
    void applyMapping(mapping, 'directSave');
  };

  const handleReviewCancel = () => {
    if (!reviewModalState) {
      return;
    }

    if (reviewModalState.mode === 'append') {
      showToast('Импорт отменён. При необходимости скорректируйте назначение столбцов.', 'info');
      if (hasPendingDataset) {
        setIsEditingColumnMapping(false);
        setIsColumnMappingOpen(true);
      }
    } else {
      showToast('Прямое сохранение отменено.', 'info');
    }

    setReviewModalState(null);
  };

  const handleReviewConfirm = async () => {
    if (!reviewModalState) {
      return;
    }

    if (reviewModalState.mode === 'append') {
      appendImportStats(reviewModalState.result, 'append');
      setReviewModalState(null);
      return;
    }

    setIsReviewProcessing(true);
    try {
      const success = await saveImportedExpenses(reviewModalState.result);
      if (success) {
        setReviewModalState(null);
      }
    } finally {
      setIsReviewProcessing(false);
    }
  };

  return {
    handleColumnMappingApply,
    handleColumnMappingApplyAndSave,
    handleReviewCancel,
    handleReviewConfirm,
  };
}

interface BuildExpensesArgs {
  mapping: ColumnMapping[];
  dataset: string[][];
  hasHeaderRow: boolean;
  resolveCityByInput: (value: string) => CityOption | null;
}

function buildExpensesFromMapping({
  mapping,
  dataset,
  hasHeaderRow,
  resolveCityByInput,
}: BuildExpensesArgs) {
  return buildExpensesFromMappedData({
    mapping,
    dataset,
    hasHeaderRow,
    resolveCityByInput,
  });
}
