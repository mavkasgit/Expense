'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/hooks/useToast';
import { useCitySynonyms } from '@/hooks/useCitySynonyms';
import { buildCityOptions, type CityOption } from '@/lib/utils/cityOptions';
import { createBulkExpenses } from '@/lib/actions/expenses';
import { createBankStatement } from '@/lib/actions/bankStatements';
import type { Category, ColumnMapping, CreateExpenseData } from '@/types';
import type { BulkExpenseRowData } from '@/lib/validations/expenses';
import { BulkExpenseTable } from './components/BulkExpenseTable';
import { ColumnMappingModal } from './components/ColumnMappingModal';
import { ReviewModal } from './components/ReviewModal';
import { TableSelectionModal } from './components/TableSelectionModal';
import { TablePreviewModal } from './components/TablePreviewModal';
import { HowToUse } from './components/HowToUse';
import { BulkImportHeader } from './components/BulkImportHeader';
import { ImportDropzone } from './components/ImportDropzone';
import { SelectedTableInfo } from './components/SelectedTableInfo';
import { useBulkExpenseState } from './hooks/useBulkExpenseState';
import { useFileImportHandlers } from './hooks/useFileImportHandlers';
import { createColumnMappingHandlers } from './utils/columnMappingWorkflow';
import { DEFAULT_SAMPLE_HEADERS } from './constants';
import {
  loadSavedColumnMapping,
  saveColumnMapping as persistColumnMapping,
} from './utils/storage';
import type { BuildExpensesResult, ReviewModalState } from './types';

interface BulkExpenseInputProps {
  categories: Category[];
}

export function BulkExpenseInput({ categories }: BulkExpenseInputProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    expenses,
    setExpenses,
    validationErrors,
    setValidationErrors,
    addRow,
    removeRow,
    updateRow,
    validateExpenses,
    clearAll,
  } = useBulkExpenseState();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isColumnMappingOpen, setIsColumnMappingOpen] = useState(false);
  const [isEditingColumnMapping, setIsEditingColumnMapping] = useState(false);
  const [savedColumnMapping, setSavedColumnMapping] = useState<ColumnMapping[] | null>(null);
  const [reviewModalState, setReviewModalState] = useState<ReviewModalState | null>(null);
  const [isReviewProcessing, setIsReviewProcessing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const { synonyms: citySynonyms } = useCitySynonyms();
  const { cityOptions, cityLookupBySynonym, cityLookupById } = useMemo(
    () => buildCityOptions(citySynonyms),
    [citySynonyms],
  );

  const resolveCityByInput = useCallback(
    (value: string): CityOption | null => {
      const normalized = value.trim().toLowerCase();
      if (!normalized) {
        return null;
      }
      return cityLookupBySynonym.get(normalized) ?? null;
    },
    [cityLookupBySynonym],
  );

  const handleAppendExpenses = useCallback(
    (newExpenses: BulkExpenseRowData[], sourceLabel: string) => {
      if (newExpenses.length === 0) {
        return;
      }
      setExpenses(prev => [...prev, ...newExpenses]);
      showToast(`Добавлено ${newExpenses.length} описаний из ${sourceLabel}`, 'success');
    },
    [setExpenses, showToast],
  );

  const fileHandlers = useFileImportHandlers({
    onAppendExpenses: handleAppendExpenses,
    onOpenColumnMapping: () => {
      setIsEditingColumnMapping(false);
      setIsColumnMappingOpen(true);
    },
    showToast,
  });

  const {
    pastedData,
    setPastedData,
    hasHeaderRow,
    setHasHeaderRow,
    availableTables,
    showTableSelection,
    setShowTableSelection,
    fileContent,
    fileName,
    isFileLoading,
    savedTableIndex,
    selectedTableMeta,
    setSelectedTableMeta,
    previewedTable,
    isPreviewModalOpen,
    isDragOver,
    handlePaste,
    handleClipboardImport,
    handleFileUpload,
    handleTableSelection,
    handlePreviewTable,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    clearFileState,
    closePreviewModal,
    resetSavedTableIndex,
  } = fileHandlers;

  useEffect(() => {
    setIsMounted(true);
    const storedMapping = loadSavedColumnMapping();
    setSavedColumnMapping(storedMapping.length > 0 ? storedMapping : null);
  }, []);

  const appendImportStats = useCallback(
    (result: BuildExpensesResult) => {
      const { expenses: importedExpenses, stats } = result;
      if (importedExpenses.length === 0) {
        showToast('Не удалось обработать данные с текущими настройками столбцов', 'error');
        return;
      }

      setExpenses(prev => [...prev, ...importedExpenses]);
      // Не очищаем pastedData, чтобы можно было быстро переоткрыть настройку
      // setPastedData([]);
      setHasHeaderRow(false);
      showToast(`Добавлено ${importedExpenses.length} из ${stats.totalRows} записей`, 'success');
      if (stats.autoDetectedCities > 0 || stats.detectedTimes > 0 || stats.manualTimes > 0) {
        const details: string[] = [];
        if (stats.autoDetectedCities > 0) {
          details.push(`автогорода: ${stats.autoDetectedCities}`);
        }
        if (stats.manualTimes + stats.detectedTimes > 0) {
          details.push(`время: ${stats.manualTimes + stats.detectedTimes}`);
        }
        const suffix = details.length > 0 ? ` (${details.join(', ')})` : '';
        showToast(`Пожалуйста, подтвердите автоматически заполненные поля${suffix}.`, 'info');
      } else {
        showToast('Проверьте импортированные данные перед сохранением.', 'info');
      }
    },
    [setExpenses, setHasHeaderRow, showToast],
  );

  const saveImportedExpenses = useCallback(
    async (result: BuildExpensesResult) => {
      const { expenses: importedExpenses, stats } = result;
      if (importedExpenses.length === 0) {
        showToast('Нет данных для сохранения', 'warning');
        return false;
      }

      let batchId: string | undefined;
      if (fileName) {
        batchId = crypto.randomUUID();
        const fileType = fileName.split('.').pop()?.toLowerCase() ?? 'unknown';
        const statementResult = await createBankStatement({
          id: batchId,
          filename: fileName,
          file_type: fileType,
          total_records: importedExpenses.length,
        });

        if (statementResult.error) {
          showToast(`Ошибка создания записи о выписке: ${statementResult.error}`, 'error');
          return false;
        }
      }

      const payload: CreateExpenseData[] = importedExpenses.map(expense => ({
        amount: expense.amount,
        description: expense.description,
        notes: expense.notes,
        category_id: expense.category_id || undefined,
        expense_date: expense.expense_date,
        expense_time: expense.expense_time || null,
        city_id: expense.city_id || undefined,
        city_input: expense.city?.trim() || undefined,
        input_method: 'bulk_table',
        batch_id: batchId,
      }));

      const response = await createBulkExpenses(payload);
      if (response.error) {
        showToast(response.error, 'error');
        return false;
      }
      if (response.success && response.stats) {
        const { success, failed, uncategorized, total } = response.stats;
        let message = `Создано ${success} из ${total} расходов`;
        if (failed > 0) {
          message += `, ${failed} с ошибками`;
        }
        if (uncategorized > 0) {
          message += `, ${uncategorized} без категории`;
        }
        showToast(message, success > 0 ? 'success' : 'error');
        if (success > 0) {
          setPastedData([]);
          setHasHeaderRow(false);
          clearFileState();
          if (stats.autoDetectedCities > 0 || stats.detectedTimes > 0 || stats.manualTimes > 0) {
            const details: string[] = [];
            if (stats.autoDetectedCities > 0) {
              details.push(`автогорода: ${stats.autoDetectedCities}`);
            }
            if (stats.manualTimes + stats.detectedTimes > 0) {
              details.push(`время: ${stats.manualTimes + stats.detectedTimes}`);
            }
            const suffix = details.length > 0 ? ` (${details.join(', ')})` : '';
            showToast(`Автоматически заполненные поля сохранены${suffix}. Проверьте их в списке расходов.`, 'info');
          }
        }
        return success > 0;
      }
      return false;
    },
    [clearFileState, fileName, setHasHeaderRow, setPastedData, showToast],
  );

  const { handleColumnMappingApply, handleColumnMappingApplyAndSave, handleReviewCancel, handleReviewConfirm } =
    createColumnMappingHandlers({
      hasHeaderRow,
      pastedData,
      resolveCityByInput,
      saveImportedExpenses,
      appendImportStats: (result: BuildExpensesResult, _mode: 'append' | 'save') => appendImportStats(result),
      showToast,
      isEditingColumnMapping,
      reviewModalState,
      setReviewModalState,
      setIsReviewProcessing,
      setSavedColumnMapping,
      setIsColumnMappingOpen,
      setIsEditingColumnMapping,
      hasPendingDataset: pastedData.length > 0,
      persistColumnMapping,
    });

  const handleOpenColumnMappingSettings = useCallback(() => {
    const saved = loadSavedColumnMapping();
    const headerRow = saved.length > 0
      ? saved.map((_, index) => `Столбец ${String.fromCharCode(65 + index)}`)
      : [...DEFAULT_SAMPLE_HEADERS];
    setPastedData([headerRow]);
    setHasHeaderRow(false);
    setIsEditingColumnMapping(true);
    setIsColumnMappingOpen(true);
  }, [setHasHeaderRow, setPastedData]);

  const handleOpenColumnMappingWithData = useCallback(() => {
    // Если есть данные - открываем сразу
    if (pastedData.length > 0) {
      setIsEditingColumnMapping(false);
      setIsColumnMappingOpen(true);
      return;
    }
    
    // Если файл загружен, но таблица не выбрана - открываем выбор таблицы
    if (fileContent && !selectedTableMeta && savedTableIndex === null) {
      setShowTableSelection(true);
      return;
    }
    
    // Если таблица выбрана, но данные очищены - загружаем таблицу
    if (fileContent && (selectedTableMeta || savedTableIndex !== null)) {
      const indexToUse = selectedTableMeta?.index ?? savedTableIndex ?? 0;
      handleTableSelection(indexToUse);
      return;
    }
    
    showToast('Сначала импортируйте данные из файла или буфера обмена', 'warning');
  }, [pastedData, fileContent, selectedTableMeta, savedTableIndex, setShowTableSelection, handleTableSelection, showToast]);

  const handleBrowseFiles = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleClearFile = useCallback(() => {
    clearFileState();
    setSelectedTableMeta(null);
    setPastedData([]);
    setHasHeaderRow(false);
    showToast('Файл удалён', 'info');
  }, [clearFileState, setSelectedTableMeta, setPastedData, setHasHeaderRow, showToast]);

  const handleClearExpenses = useCallback(() => {
    clearAll();
    clearFileState();
    setSelectedTableMeta(null);
    setValidationErrors({});
  }, [clearAll, clearFileState, setSelectedTableMeta, setValidationErrors]);

  const handleDirectSave = useCallback(async () => {
    if (expenses.length === 0) {
      showToast('Добавьте хотя бы один расход', 'error');
      return;
    }
    if (!validateExpenses()) {
      showToast('Исправьте ошибки в данных', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      let batchId: string | undefined;
      if (fileName) {
        batchId = crypto.randomUUID();
        const fileType = fileName.split('.').pop()?.toLowerCase() ?? 'unknown';
        const statementResult = await createBankStatement({
          id: batchId,
          filename: fileName,
          file_type: fileType,
          total_records: expenses.length,
        });
        if (statementResult.error) {
          showToast(`Ошибка создания записи о выписке: ${statementResult.error}`, 'error');
          return;
        }
      }

      const payload: CreateExpenseData[] = expenses.map(expense => ({
        amount: expense.amount,
        description: expense.description,
        notes: expense.notes,
        category_id: expense.category_id || undefined,
        expense_date: expense.expense_date,
        expense_time: expense.expense_time || null,
        city_id: expense.city_id || undefined,
        city_input: expense.city?.trim() || undefined,
        input_method: 'bulk_table',
        batch_id: batchId,
      }));

      const result = await createBulkExpenses(payload);
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      if (result.success && result.stats) {
        const { success, failed, uncategorized, total } = result.stats;
        let message = `Создано ${success} из ${total} расходов`;
        if (failed > 0) {
          message += `, ${failed} с ошибками`;
        }
        if (uncategorized > 0) {
          message += `, ${uncategorized} без категории`;
        }
        showToast(message, success > 0 ? 'success' : 'error');
        if (success > 0) {
          clearAll();
          clearFileState();
          setSelectedTableMeta(null);
          setValidationErrors({});
        }
      }
    } catch (error) {
      console.error('Ошибка при сохранении расходов', error);
      showToast('Произошла ошибка при сохранении', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    clearAll,
    clearFileState,
    expenses,
    fileName,
    setSelectedTableMeta,
    setValidationErrors,
    showToast,
    validateExpenses,
  ]);

  const handleResetTableIndex = useCallback(() => {
    resetSavedTableIndex();
    showToast('Сохраненный выбор таблицы очищен', 'info');
  }, [resetSavedTableIndex, showToast]);

  const handleCloseColumnMapping = useCallback(() => {
    setIsColumnMappingOpen(false);
    setPastedData([]);
    setHasHeaderRow(false);
    setIsEditingColumnMapping(false);
  }, [setHasHeaderRow, setPastedData]);

  const handleCloseTableSelection = useCallback(() => {
    setShowTableSelection(false);
    if (!selectedTableMeta) {
      clearFileState();
    }
  }, [clearFileState, selectedTableMeta, setShowTableSelection]);

  const handleRequestTableReplacement = useCallback(() => {
    if (!fileContent) {
      showToast('Не найдено данных из файла для смены таблицы.', 'warning');
      return;
    }
    setIsColumnMappingOpen(false);
    setShowTableSelection(true);
  }, [fileContent, setShowTableSelection, showToast]);

  const fileStatusMessage = isFileLoading
    ? fileName
      ? `Обрабатываем «${fileName}»...`
      : 'Подготавливаем данные файла...'
    : '';

  return (
    <div className="space-y-6">
      <input ref={fileInputRef} type="file" accept="*/*" className="hidden" onChange={handleFileUpload} />

      <Card className="space-y-6 p-6">
        <BulkImportHeader
          onOpenColumnMapping={handleOpenColumnMappingSettings}
          onOpenColumnMappingWithData={handleOpenColumnMappingWithData}
          onOpenTableSelection={() => setShowTableSelection(true)}
          onAddRows={addRow}
          isFileLoading={isFileLoading}
          canChooseTable={Boolean(fileContent && availableTables.length > 1)}
          hasSelectedTable={Boolean(selectedTableMeta || savedTableIndex !== null)}
          hasSavedColumnMapping={Boolean(savedColumnMapping?.length)}
          savedMappingCount={savedColumnMapping?.length ?? 0}
          hasExpenses={expenses.length > 0}
          onClear={handleClearExpenses}
          onDirectSave={handleDirectSave}
          isSubmitting={isSubmitting}
          hasFileLoaded={Boolean(fileContent)}
        />

        {selectedTableMeta && (
          <SelectedTableInfo
            description={selectedTableMeta.description}
            rowCount={selectedTableMeta.rowCount}
            columnCount={selectedTableMeta.columnCount}
            hasHeaders={selectedTableMeta.hasHeaders}
          />
        )}

        {expenses.length === 0 ? (
          <ImportDropzone
            isDragOver={isDragOver}
            onBrowse={handleBrowseFiles}
            onPaste={handlePaste}
            onImportFromClipboard={handleClipboardImport}
            fileName={fileName || undefined}
            isFileLoading={isFileLoading}
            fileStatusMessage={fileStatusMessage}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClearFile={handleClearFile}
          />
        ) : (
          <BulkExpenseTable
            expenses={expenses}
            categories={categories}
            validationErrors={validationErrors}
            onUpdateRow={updateRow}
            onRemoveRow={removeRow}
            onPaste={handlePaste}
            cityOptions={cityOptions}
            cityLookupById={cityLookupById}
            resolveCityByInput={resolveCityByInput}
          />
        )}

        <HowToUse />
      </Card>

      <ReviewModal
        reviewState={reviewModalState}
        isProcessing={isReviewProcessing}
        onCancel={handleReviewCancel}
        onConfirm={handleReviewConfirm}
      />

      <TableSelectionModal
        isOpen={showTableSelection}
        tables={availableTables}
        savedTableIndex={savedTableIndex}
        isLoading={isFileLoading}
        onSelect={handleTableSelection}
        onPreview={handlePreviewTable}
        onClose={handleCloseTableSelection}
      />

      <TablePreviewModal isOpen={isPreviewModalOpen} table={previewedTable} onClose={closePreviewModal} />

      <ColumnMappingModal
        isOpen={isColumnMappingOpen}
        onClose={handleCloseColumnMapping}
        onApply={handleColumnMappingApply}
        onApplyAndSave={handleColumnMappingApplyAndSave}
        sampleData={pastedData}
        savedMapping={savedColumnMapping}
        isEditingMode={isEditingColumnMapping}
        tableDescription={selectedTableMeta?.description}
        onReplaceTable={handleRequestTableReplacement}
      />
    </div>
  );
}

