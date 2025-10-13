'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { BulkExpenseTable } from './BulkExpenseTable'
import { ColumnMappingModal } from './ColumnMappingModal'
import { HowToUse } from './HowToUse'
import { Dropzone } from './components/Dropzone'
import { ReviewModal } from './components/ReviewModal'
import { TableSelectionModal } from './components/TableSelectionModal'
import { TablePreviewModal } from './components/TablePreviewModal'
import { useCitySynonyms } from '@/hooks/useCitySynonyms'
import { buildCityOptions } from '@/lib/utils/cityOptions'
import type { Category, ColumnMapping } from '@/types'
import type { BuildExpensesResult } from './types'
import { useExpenseBuilder } from './useExpenseBuilder'
import { useFileHandler } from './useFileHandler'
import { useColumnMapping } from './useColumnMapping'
import { useExpenseSubmit } from './useExpenseSubmit'

interface BulkExpenseInputProps {
  categories: Category[]
}

export function BulkExpenseInput({ categories }: BulkExpenseInputProps) {
  const [pastedData, setPastedData] = useState<string[][]>([])
  const [hasHeaderRow, setHasHeaderRow] = useState(false)
  const [isColumnMappingOpen, setIsColumnMappingOpen] = useState(false)
  const [isEditingColumnMapping, setIsEditingColumnMapping] = useState(false)
  const [autoRedirect, setAutoRedirect] = useState(false)
  const [reviewModalState, setReviewModalState] = useState<{
    mode: 'append' | 'directSave'
    result: BuildExpensesResult
  } | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  const { synonyms: citySynonyms } = useCitySynonyms()

  const { cityOptions, cityLookupBySynonym, cityLookupById } = useMemo(
    () => buildCityOptions(citySynonyms),
    [citySynonyms]
  )

  const resolveCityByInput = useCallback(
    (value: string) => {
      const normalized = value.trim().toLowerCase()
      if (!normalized) {
        return null
      }
      return cityLookupBySynonym.get(normalized) ?? null
    },
    [cityLookupBySynonym]
  )

  const handleDatasetClear = useCallback(() => {
    setPastedData([])
    setHasHeaderRow(false)
    setIsColumnMappingOpen(false)
    setIsEditingColumnMapping(false)
  }, [])

  const {
    expenses,
    validationErrors,
    addRow,
    removeRow,
    updateRow,
    handleClear,
    validateExpenses,
    appendSingleColumnExpenses,
    buildExpensesFromMappedData,
    appendExpensesWithStats
  } = useExpenseBuilder({
    pastedData,
    hasHeaderRow,
    resolveCityByInput,
    onDatasetConsumed: handleDatasetClear
  })

  const {
    fileInputRef,
    isFileLoading,
    fileName,
    fileContent,
    availableTables,
    showTableSelection,
    setShowTableSelection,
    selectedTableMeta,
    savedTableIndex,
    isDragOver,
    isPreviewModalOpen,
    setIsPreviewModalOpen,
    previewedTable,
    loadSavedTableIndex,
    clearSavedTableIndex,
    handleFileUpload,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleTableSelection,
    handlePreviewTable,
    handleFileStateReset
  } = useFileHandler({
    appendSingleColumnExpenses,
    onDatasetReady: (data, hasHeader) => {
      setPastedData(data)
      setHasHeaderRow(hasHeader)
      setIsEditingColumnMapping(false)
      setIsColumnMappingOpen(true)
    },
    resetDataset: handleDatasetClear,
    setIsColumnMappingOpen,
    setIsEditingColumnMapping
  })

  const onDatasetSaved = useCallback((_result: BuildExpensesResult) => {
    handleDatasetClear()
    handleFileStateReset()
  }, [handleDatasetClear, handleFileStateReset])

  const {
    isSubmitting,
    isReviewProcessing,
    handleDirectSave,
    saveImportedExpenses
  } = useExpenseSubmit({
    expenses,
    autoRedirect,
    validateExpenses,
    clearExpenses: handleClear,
    resetFileState: handleFileStateReset,
    onDatasetSaved,
    fileName
  })

  const {
    savedColumnMapping,
    loadSavedColumnMapping,
    handleColumnMappingApply,
    handleColumnMappingApplyAndSave
  } = useColumnMapping({
    buildExpensesFromMappedData,
    appendExpensesWithStats,
    saveImportedExpenses: async (result: BuildExpensesResult) => {
      const success = await saveImportedExpenses(result)
      if (success) {
        setReviewModalState(null)
      }
      return success
    },
    setReviewModalState,
    isEditingColumnMapping
  })

  useEffect(() => {
    setIsMounted(true)
    loadSavedColumnMapping()
    loadSavedTableIndex()
  }, [loadSavedColumnMapping, loadSavedTableIndex])

  const hasPendingDataset = pastedData.length > 0

  const handleReviewCancel = useCallback(() => {
    if (!reviewModalState) {
      return
    }
    setReviewModalState(null)
    if (reviewModalState.mode === 'append' && hasPendingDataset) {
      setIsColumnMappingOpen(true)
    }
  }, [hasPendingDataset, reviewModalState])

  const handleReviewConfirm = useCallback(async () => {
    if (!reviewModalState) {
      return
    }

    if (reviewModalState.mode === 'append') {
      appendExpensesWithStats(reviewModalState.result)
      setReviewModalState(null)
      return
    }

    const success = await saveImportedExpenses(reviewModalState.result)
    if (success) {
      setReviewModalState(null)
    }
  }, [appendExpensesWithStats, reviewModalState, saveImportedExpenses])

  const handleOpenColumnMapping = useCallback(() => {
    const sampleData = savedColumnMapping && savedColumnMapping.length > 0
      ? [savedColumnMapping.map((_, index) => `Столбец ${String.fromCharCode(65 + index)}`)]
      : [['Столбец A', 'Столбец B', 'Столбец C', 'Столбец D']]

    setPastedData(sampleData)
    setHasHeaderRow(false)
    setIsEditingColumnMapping(true)
    setIsColumnMappingOpen(true)
  }, [savedColumnMapping])

  const handleMappingApply = useCallback(
    (mapping: ColumnMapping[]) => {
      handleColumnMappingApply(mapping)
      setIsColumnMappingOpen(false)
    },
    [handleColumnMappingApply]
  )

  const handleMappingApplyAndSave = useCallback(
    (mapping: ColumnMapping[]) => {
      handleColumnMappingApplyAndSave(mapping)
      setIsColumnMappingOpen(false)
    },
    [handleColumnMappingApplyAndSave]
  )

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Массовый ввод и банковские выписки</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="flex items-center gap-2 cursor-pointer select-none"
              onClick={() => setAutoRedirect(prev => !prev)}
            >
              <span className="text-sm text-gray-700">Автопереход</span>
              <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoRedirect ? 'bg-blue-600' : 'bg-gray-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoRedirect ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={addRow}>
              + Добавить строку
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isFileLoading}
              className={isFileLoading ? 'cursor-wait opacity-80' : undefined}
            >
              {isFileLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Обработка...
                </span>
              ) : (
                '📁 Загрузить файл'
              )}
            </Button>
            {fileContent && availableTables.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTableSelection(true)}
                disabled={isFileLoading}
              >
                📊 Выбрать таблицу
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenColumnMapping}
              title="Настроить порядок столбцов для вставки данных"
            >
              ⚙️ Настройка столбцов
              <span className={`ml-1 text-xs ${isMounted && (savedColumnMapping || savedTableIndex !== null) ? 'opacity-100' : 'opacity-0'}`}>
                ●
              </span>
            </Button>
            {isMounted && savedTableIndex !== null && (
              <Button variant="outline" size="sm" onClick={clearSavedTableIndex}>
                ♻️ Сбросить выбор таблицы
              </Button>
            )}
            {selectedTableMeta && (
              <div className="w-full rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                <span className="font-medium">Текущая таблица:</span> {selectedTableMeta.description}
                <span className="ml-2 text-blue-600">
                  ({selectedTableMeta.rowCount} строк, {selectedTableMeta.columnCount} столбцов,
                  {selectedTableMeta.hasHeaders ? ' есть заголовок' : ' без заголовка'})
                </span>
              </div>
            )}
            {expenses.length > 0 && (
              <>
                <div className="h-6 w-px bg-gray-300" />
                <Button variant="outline" size="sm" onClick={handleClear}>
                  🗑️ Очистить
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDirectSave}
                  disabled={isSubmitting}
                  className={isSubmitting ? 'animate-pulse' : ''}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Сохранение...
                    </span>
                  ) : (
                    '💾 Сохранить'
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {isFileLoading && (
          <div className="flex items-center gap-2 text-sm text-blue-700" aria-live="polite">
            <span className="h-3 w-3 animate-spin rounded-full border border-blue-400 border-t-transparent" />
            <span>{fileName ? `Обрабатываем «${fileName}»...` : 'Подготавливаем данные файла...'}</span>
          </div>
        )}

        {expenses.length === 0 ? (
          <Dropzone
            ref={fileInputRef}
            isDragOver={isDragOver}
            onClick={() => fileInputRef.current?.click()}
            onPaste={handlePaste}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFileChange={handleFileUpload}
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
        state={reviewModalState}
        isProcessing={isReviewProcessing}
        onConfirm={handleReviewConfirm}
        onCancel={handleReviewCancel}
      />

      <TableSelectionModal
        isOpen={showTableSelection}
        tables={availableTables}
        savedIndex={savedTableIndex}
        isLoading={isFileLoading}
        onSelect={handleTableSelection}
        onClose={() => {
          setShowTableSelection(false)
          if (!selectedTableMeta) {
            handleFileStateReset()
          }
        }}
        onPreview={handlePreviewTable}
      />

      <TablePreviewModal
        isOpen={isPreviewModalOpen}
        table={previewedTable}
        onClose={() => setIsPreviewModalOpen(false)}
      />

      <ColumnMappingModal
        isOpen={isColumnMappingOpen}
        onClose={() => {
          setIsColumnMappingOpen(false)
          if (!isEditingColumnMapping) {
            handleDatasetClear()
          }
        }}
        onApply={handleMappingApply}
        onApplyAndSave={isEditingColumnMapping ? undefined : handleMappingApplyAndSave}
        sampleData={pastedData}
        savedMapping={savedColumnMapping}
        isEditingMode={isEditingColumnMapping}
        tableDescription={selectedTableMeta?.description}
        onReplaceTable={fileContent ? () => setShowTableSelection(true) : undefined}
      />
    </div>
  )
}
