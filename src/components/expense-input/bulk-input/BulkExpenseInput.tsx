'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/hooks/useToast';
import { useCitySynonyms } from '@/hooks/useCitySynonyms';
import { buildCityOptions, type CityOption } from '@/lib/utils/cityOptions';
import { createBulkExpenses, getExistingCitiesAndDescriptions } from '@/lib/actions/expenses';
import { createBankStatement } from '@/lib/actions/bankStatements';
import type { Category, ColumnMapping, CreateExpenseData } from '@/types';
import type { BulkExpenseRowData } from '@/lib/validations/expenses';
import { BulkExpenseTable } from './components/BulkExpenseTable';
import { ColumnMappingModal } from './components/ColumnMappingModal';
import { ReviewModal } from './components/ReviewModal';
import { TableSelectionModal } from './components/TableSelectionModal';
import { TablePreviewModal } from './components/TablePreviewModal';
import { HowToUse } from './components/HowToUse';
import { ImportDropzone } from './components/ImportDropzone';
import { SelectedTableInfo } from './components/SelectedTableInfo';
import { useBulkExpenseState } from './hooks/useBulkExpenseState';
import { useFileImportHandlers } from './hooks/useFileImportHandlers';
import { createColumnMappingHandlers } from './utils/columnMappingWorkflow';
import { DEFAULT_SAMPLE_HEADERS } from './constants';
import {
  loadSavedColumnMapping,
  saveColumnMapping as persistColumnMapping,
  getDataSourceFormat,
  loadAllFormatMappings,
  type DataSourceFormat,
} from './utils/storage';
import type { BuildExpensesResult, ReviewModalState } from './types';
import { BulkImportToolbar } from './components/BulkImportToolbar';
import { BulkImportFooter } from './components/BulkImportFooter';

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
  const [currentFormat, setCurrentFormat] = useState<DataSourceFormat | null>(null);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [showNewCitiesOnly, setShowNewCitiesOnly] = useState(false);
  const [showNewDescriptionsOnly, setShowNewDescriptionsOnly] = useState(false);
  const [existingCities, setExistingCities] = useState<Set<string>>(new Set());
  const [existingDescriptions, setExistingDescriptions] = useState<Set<string>>(new Set());

  const handleToggleShowErrorsOnly = useCallback(() => {
    setShowErrorsOnly(prev => !prev);
  }, []);

  const handleToggleShowNewCitiesOnly = useCallback(() => {
    setShowNewCitiesOnly(prev => !prev);
  }, []);

  const handleToggleShowNewDescriptionsOnly = useCallback(() => {
    setShowNewDescriptionsOnly(prev => !prev);
  }, []);

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
    
    // Загружаем существующие города и описания
    const loadExistingData = async () => {
      const result = await getExistingCitiesAndDescriptions();
      if ('error' in result) {
        console.error('Ошибка загрузки существующих данных:', result.error);
      } else {
        setExistingCities(result.cities);
        setExistingDescriptions(result.descriptions);
      }
    };
    
    loadExistingData();
  }, []);

  // Определяем формат при изменении источника данных
  useEffect(() => {
    if (pastedData.length > 0 || fileName) {
      const format = getDataSourceFormat(fileName || undefined);
      setCurrentFormat(format);
    } else {
      setCurrentFormat(null);
    }
  }, [fileName, pastedData.length]);

  // Загружаем сохраненные настройки для текущего формата
  useEffect(() => {
    if (!currentFormat) {
      setSavedColumnMapping(null);
      return;
    }
    const storedMapping = loadSavedColumnMapping(currentFormat);
    setSavedColumnMapping(storedMapping.length > 0 ? storedMapping : null);
  }, [currentFormat]);

  // Валидация теперь происходит автоматически при изменении каждой строки в updateRow
  // Полная валидация вызывается только при попытке сохранить

  // Подсчет количества строк с ошибками, новыми городами и описаниями с дебаунсом
  const [counters, setCounters] = useState({ errorsCount: 0, newCitiesCount: 0, newDescriptionsCount: 0 });
  
  useEffect(() => {
    const timer = setTimeout(() => {
      let errorsCount = 0;
      let newCitiesCount = 0;
      let newDescriptionsCount = 0;

      expenses.forEach(expense => {
        const tempId = expense.tempId || '';
        
        // Проверяем есть ли ошибки в этой строке
        if (Object.keys(validationErrors).some(key => key.startsWith(tempId))) {
          errorsCount++;
        }

        // Проверяем новый ли город
        const cityName = expense.city?.toLowerCase().trim();
        if (cityName && !existingCities.has(cityName)) {
          newCitiesCount++;
        }

        // Проверяем новое ли описание
        const description = expense.description?.toLowerCase().trim();
        if (description && !existingDescriptions.has(description)) {
          newDescriptionsCount++;
        }
      });

      setCounters({ errorsCount, newCitiesCount, newDescriptionsCount });
    }, 300); // Пересчитываем счетчики через 300мс после последнего изменения
    
    return () => clearTimeout(timer);
  }, [expenses, validationErrors, existingCities, existingDescriptions]);

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
      persistColumnMapping: (mapping: ColumnMapping[]) => persistColumnMapping(mapping, currentFormat || undefined),
      currentFormat,
    });

  const handleOpenColumnMappingSettings = useCallback(() => {
    const saved = loadSavedColumnMapping(currentFormat || undefined);
    
    // Находим максимальный sourceIndex чтобы создать нужное количество столбцов
    const maxSourceIndex = saved.length > 0 
      ? Math.max(...saved.map(m => m.sourceIndex))
      : DEFAULT_SAMPLE_HEADERS.length - 1;
    
    // Создаем заголовки для всех столбцов до максимального индекса
    const columnCount = maxSourceIndex + 1;
    const headerRow = Array.from({ length: columnCount }, (_, index) => 
      `Столбец ${String.fromCharCode(65 + index)}`
    );
    
    setPastedData([headerRow]);
    setHasHeaderRow(false);
    setIsEditingColumnMapping(true);
    setIsColumnMappingOpen(true);
  }, [setHasHeaderRow, setPastedData, currentFormat]);

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
    setSelectedTableMeta(null);
    setValidationErrors({});
  }, [clearAll, setSelectedTableMeta, setValidationErrors]);

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
        <BulkImportToolbar
          onOpenColumnMapping={handleOpenColumnMappingSettings}
          onOpenColumnMappingWithData={handleOpenColumnMappingWithData}
          onOpenTableSelection={() => setShowTableSelection(true)}
          onAddRows={addRow}
          isFileLoading={isFileLoading}
          canChooseTable={Boolean(fileContent && availableTables.length > 1)}
          hasSelectedTable={Boolean(selectedTableMeta || savedTableIndex !== null)}
          hasSavedColumnMapping={Boolean(savedColumnMapping?.length)}
          hasFileLoaded={Boolean(fileContent)}
          currentFormat={currentFormat}
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
            onConfigureColumns={fileName ? handleOpenColumnMappingWithData : undefined}
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
            showErrorsOnly={showErrorsOnly}
            showNewCitiesOnly={showNewCitiesOnly}
            showNewDescriptionsOnly={showNewDescriptionsOnly}
            existingCities={existingCities}
            existingDescriptions={existingDescriptions}
            onAddRow={addRow}
          />
        )}

        <HowToUse />
      </Card>

      {expenses.length > 0 && (
        <BulkImportFooter
          onClear={handleClearExpenses}
          onDirectSave={handleDirectSave}
          isSubmitting={isSubmitting}
          hasExpenses={expenses.length > 0}
          showErrorsOnly={showErrorsOnly}
          onToggleShowErrorsOnly={handleToggleShowErrorsOnly}
          showNewCitiesOnly={showNewCitiesOnly}
          onToggleShowNewCitiesOnly={handleToggleShowNewCitiesOnly}
          showNewDescriptionsOnly={showNewDescriptionsOnly}
          onToggleShowNewDescriptionsOnly={handleToggleShowNewDescriptionsOnly}
          errorsCount={counters.errorsCount}
          newCitiesCount={counters.newCitiesCount}
          newDescriptionsCount={counters.newDescriptionsCount}
        />
      )}

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
        sampleData={pastedData}
        savedMapping={savedColumnMapping}
        isEditingMode={isEditingColumnMapping}
        tableDescription={selectedTableMeta?.description}
        onReplaceTable={handleRequestTableReplacement}
        currentFormat={currentFormat}
        onFormatChange={(format) => {
          setCurrentFormat(format);
        }}
      />
    </div>
  );
}
