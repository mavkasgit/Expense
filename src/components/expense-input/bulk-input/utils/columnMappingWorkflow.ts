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
  currentFormat?: string | null;
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
  currentFormat,
}: ColumnMappingWorkflowOptions) {
  const applyMapping = async (mapping: ColumnMapping[], mode: 'append' | 'directSave', exclusions?: string[]) => {
    const sanitized = sanitizeColumnMapping(mapping);
    persistColumnMapping(sanitized);

    const hasActiveMapping = sanitized.some(m => m.targetFields && m.targetFields.length > 0);
    setSavedColumnMapping(hasActiveMapping ? sanitized : null);

    // Иконки и названия форматов
    const formatIcons: Record<string, string> = {
      csv: '📄',
      xlsx: '📊',
      xls: '📊',
      html: '🌐',
      clipboard: '📋',
      unknown: '📁'
    };
    
    const formatLabels: Record<string, string> = {
      csv: 'CSV',
      xlsx: 'Excel (XLSX)',
      xls: 'Excel (XLS)',
      html: 'HTML',
      clipboard: 'Буфер обмена',
      unknown: 'Неизвестный формат'
    };
    
    const formatIcon = currentFormat ? formatIcons[currentFormat] || '📁' : '📁';
    const formatLabel = currentFormat ? formatLabels[currentFormat] || 'Неизвестный формат' : '';

    // Если просто редактируем настройки без обработки данных
    if (mode === 'append' && isEditingColumnMapping) {
      const message = currentFormat ? `${formatIcon} Настройки ${formatLabel}` : 'Настройки сохранены';
      showToast(message, 'success');
      return;
    }
    
    // Показываем уведомление о сохранении настроек
    if (mode === 'append' && hasActiveMapping) {
      const message = currentFormat ? `${formatIcon} Настройки ${formatLabel}` : 'Настройки сохранены';
      showToast(message, 'success');
    }

    const result = buildExpensesFromMapping({
      mapping: sanitized,
      dataset: pastedData,
      hasHeaderRow,
      resolveCityByInput,
      exclusions,
    });

    if (result.expenses.length === 0) {
      showToast('Не удалось обработать данные с текущими настройками столбцов', 'error');
      return;
    }

    // Сразу применяем без подтверждения
    if (mode === 'append') {
      appendImportStats(result, 'append');
    } else {
      const success = await saveImportedExpenses(result);
      if (success) {
        setReviewModalState(null);
      }
    }
  };

  const handleColumnMappingApply = (mapping: ColumnMapping[], exclusions?: string[]) => {
    void applyMapping(mapping, 'append', exclusions);
  };

  const handleColumnMappingApplyAndSave = (mapping: ColumnMapping[], exclusions?: string[]) => {
    void applyMapping(mapping, 'directSave', exclusions);
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
  exclusions?: string[];
}

function buildExpensesFromMapping({
  mapping,
  dataset,
  hasHeaderRow,
  resolveCityByInput,
  exclusions,
}: BuildExpensesArgs) {
  return buildExpensesFromMappedData({
    mapping,
    dataset,
    hasHeaderRow,
    resolveCityByInput,
    exclusions,
  });
}
