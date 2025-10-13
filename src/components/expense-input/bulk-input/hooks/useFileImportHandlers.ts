'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  analyzeHTML,
  parseBankStatementFile,
  parseCSV,
  parseHTML,
  prepareParsedDataset,
  type TableInfo,
} from '@/lib/utils/bankStatementParsers';
import type { BulkExpenseRowData } from '@/lib/validations/expenses';
import type { SelectedTableMeta, PreviewedTable } from '../types';
import type { ToastType } from '@/hooks/useToast';
import { buildSingleColumnExpenses } from '../utils/importBuilder';
import {
  loadSavedTableIndex,
  saveTableIndex,
  clearSavedTableIndex,
} from '../utils/storage';

interface UseFileImportHandlersOptions {
  onAppendExpenses: (expenses: BulkExpenseRowData[], sourceLabel: string) => void;
  onOpenColumnMapping: (dataset: string[][], hasHeader: boolean) => void;
  showToast: (message: string, type?: ToastType) => void;
}

interface FileImportHandlers {
  pastedData: string[][];
  setPastedData: (data: string[][]) => void;
  hasHeaderRow: boolean;
  setHasHeaderRow: (value: boolean) => void;
  availableTables: TableInfo[];
  showTableSelection: boolean;
  setShowTableSelection: (value: boolean) => void;
  fileContent: string | null;
  fileName: string;
  isFileLoading: boolean;
  savedTableIndex: number | null;
  selectedTableMeta: SelectedTableMeta | null;
  previewedTable: PreviewedTable | null;
  isPreviewModalOpen: boolean;
  isDragOver: boolean;
  handlePaste: (event: React.ClipboardEvent) => void;
  handleClipboardImport: () => Promise<void>;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleTableSelection: (index: number, tableInfo?: TableInfo) => Promise<void>;
  handlePreviewTable: (tableIndex: number) => void;
  handleDragOver: (event: React.DragEvent) => void;
  handleDragLeave: (event: React.DragEvent) => void;
  handleDrop: (event: React.DragEvent) => void;
  clearFileState: () => void;
  closePreviewModal: () => void;
  setSelectedTableMeta: (meta: SelectedTableMeta | null) => void;
  setIsPreviewModalOpen: (value: boolean) => void;
  resetSavedTableIndex: () => void;
}

export function useFileImportHandlers({
  onAppendExpenses,
  onOpenColumnMapping,
  showToast,
}: UseFileImportHandlersOptions): FileImportHandlers {
  const [pastedData, setPastedData] = useState<string[][]>([]);
  const [hasHeaderRow, setHasHeaderRow] = useState(false);
  const [availableTables, setAvailableTables] = useState<TableInfo[]>([]);
  const [showTableSelection, setShowTableSelection] = useState(false);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [savedTableIndex, setSavedTableIndex] = useState<number | null>(null);
  const [selectedTableMeta, setSelectedTableMeta] = useState<SelectedTableMeta | null>(null);
  const [previewedTable, setPreviewedTable] = useState<PreviewedTable | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const storedIndex = loadSavedTableIndex();
    setSavedTableIndex(storedIndex);
  }, []);

  const appendSingleColumn = useCallback(
    (rows: string[][], hasHeader: boolean, sourceLabel: string) => {
      const expenses = buildSingleColumnExpenses(rows, hasHeader);
      if (expenses.length === 0) {
        showToast('Не найдены значения для описания', 'warning');
        return;
      }
      onAppendExpenses(expenses, sourceLabel);
    },
    [onAppendExpenses, showToast],
  );

  const openColumnMapping = useCallback(
    (dataset: string[][], hasHeader: boolean) => {
      setPastedData(dataset);
      setHasHeaderRow(hasHeader);
      onOpenColumnMapping(dataset, hasHeader);
    },
    [onOpenColumnMapping],
  );

  const processClipboardPayload = useCallback(
    async ({ htmlData, textData }: { htmlData?: string; textData?: string }) => {
      setSelectedTableMeta(null);
      setAvailableTables([]);
      setFileContent(null);
      setFileName('');

      try {
        const html = htmlData?.trim() ?? '';
        if (html && html.includes('<table')) {
          const parsed = parseHTML(html);
          const prepared = prepareParsedDataset(parsed);
          const dataset = prepared.rows;

          if (dataset.length === 0) {
            showToast('Вставленная таблица не содержит данных', 'error');
            return;
          }

          const dataRows = prepared.hasHeader ? dataset.slice(1) : dataset;
          if (dataRows.length === 0) {
            showToast('Вставленная таблица содержит только заголовки', 'warning');
            return;
          }

          if (dataRows[0].length > 1) {
            openColumnMapping(dataset, prepared.hasHeader);
            showToast(`Обнаружена таблица (${dataRows.length} строк). Назначьте столбцы и проверьте данные.`, 'success');
          } else {
            appendSingleColumn(dataset, prepared.hasHeader, 'вставленной таблицы');
          }
          return;
        }

        const text = textData?.trim() ?? '';
        if (!text) {
          showToast('Буфер обмена пуст', 'warning');
          return;
        }

        const parsed = parseCSV(text);
        const prepared = prepareParsedDataset(parsed);
        const dataset = prepared.rows;

        if (dataset.length === 0) {
          showToast('Вставленные данные пусты', 'error');
          return;
        }

        const dataRows = prepared.hasHeader ? dataset.slice(1) : dataset;
        if (dataRows.length === 0) {
          showToast('Не найдены строки с данными', 'error');
          return;
        }

        if (dataRows[0].length > 1) {
          openColumnMapping(dataset, prepared.hasHeader);
          showToast(`Получены данные (${dataRows.length} строк). Проверьте соответствие столбцов.`, 'success');
        } else {
          appendSingleColumn(dataset, prepared.hasHeader, 'буфера обмена');
        }
      } catch (error) {
        console.error('Ошибка при вставке данных', error);
        showToast('Ошибка при вставке данных', 'error');
      }
    },
    [appendSingleColumn, openColumnMapping, showToast],
  );

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent) => {
      event.preventDefault();
      const htmlData = event.clipboardData.getData('text/html');
      const textData = event.clipboardData.getData('text');
      await processClipboardPayload({ htmlData, textData });
    },
    [processClipboardPayload],
  );

  const handleClipboardImport = useCallback(async () => {
    try {
      if (navigator?.clipboard?.read) {
        const items = await navigator.clipboard.read();
        let htmlData = '';
        let textData = '';

        for (const item of items) {
          if (item.types.includes('text/html') && !htmlData) {
            const blob = await item.getType('text/html');
            htmlData = await blob.text();
          }
          if (item.types.includes('text/plain') && !textData) {
            const blob = await item.getType('text/plain');
            textData = await blob.text();
          }
        }

        if (htmlData || textData) {
          await processClipboardPayload({ htmlData, textData });
          return;
        }
      }

      if (navigator?.clipboard?.readText) {
        const textData = await navigator.clipboard.readText();
        await processClipboardPayload({ textData });
        return;
      }

      showToast('Не удалось получить доступ к буферу обмена. Используйте сочетание Ctrl+V.', 'warning');
    } catch (error) {
      console.error('Ошибка чтения буфера обмена', error);
      showToast('Не удалось прочитать буфер обмена. Разрешите доступ или вставьте вручную.', 'error');
    }
  }, [processClipboardPayload, showToast]);

  const processTableSelection = useCallback(
    async (
      tableIndex: number,
      currentContent: string,
      currentFileName: string,
      tableInfo?: TableInfo,
    ) => {
      setIsFileLoading(true);
      saveTableIndex(tableIndex);
      setSavedTableIndex(tableIndex);

      const resolvedInfo = tableInfo ?? availableTables.find(table => table.index === tableIndex);
      if (resolvedInfo) {
        setSelectedTableMeta({
          index: resolvedInfo.index,
          description: resolvedInfo.description,
          rowCount: resolvedInfo.rowCount,
          columnCount: resolvedInfo.columnCount,
          hasHeaders: resolvedInfo.hasHeaders,
        });
      }

      try {
        const parsed = await parseBankStatementFile(
          new File([currentContent], currentFileName),
          tableIndex,
        );
        const prepared = prepareParsedDataset(parsed);
        const dataset = prepared.rows;

        if (dataset.length === 0) {
          showToast('Выбранная таблица не содержит данных', 'error');
          return;
        }

        const dataRows = prepared.hasHeader ? dataset.slice(1) : dataset;
        if (dataRows.length === 0) {
          showToast('Выбранная таблица содержит только заголовки', 'warning');
          return;
        }

        if (dataRows[0].length > 1) {
          openColumnMapping(dataset, prepared.hasHeader);
          showToast(`Загружено ${dataRows.length} строк из выбранной таблицы`, 'success');
        } else {
          appendSingleColumn(dataset, prepared.hasHeader, 'выбранной таблицы');
          setHasHeaderRow(false);
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Ошибка обработки таблицы', 'error');
      } finally {
        setShowTableSelection(false);
        setIsFileLoading(false);
      }
    },
    [appendSingleColumn, availableTables, openColumnMapping, showToast],
  );

  const handleTableSelection = useCallback(
    async (tableIndex: number, tableInfo?: TableInfo) => {
      if (!fileContent || !fileName) {
        showToast('Сначала загрузите файл с выпиской', 'error');
        return;
      }
      await processTableSelection(tableIndex, fileContent, fileName, tableInfo);
    },
    [fileContent, fileName, processTableSelection, showToast],
  );

  const handlePreviewTable = useCallback(
    (tableIndex: number) => {
      if (!fileContent) {
        return;
      }

      try {
        const parsedTable = parseHTML(fileContent, tableIndex);
        const allRows =
          parsedTable.headers && parsedTable.headers.length > 0
            ? [parsedTable.headers, ...parsedTable.rows]
            : parsedTable.rows;
        setPreviewedTable({
          description: availableTables[tableIndex]?.description || `Таблица ${tableIndex + 1}`,
          rows: allRows,
        });
        setIsPreviewModalOpen(true);
      } catch (error) {
        console.error('Ошибка предпросмотра таблицы', error);
        showToast('Не удалось загрузить предпросмотр таблицы', 'error');
      }
    },
    [availableTables, fileContent, showToast],
  );

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setIsFileLoading(true);
      try {
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        const content = await file.text();

        setFileName(file.name);
        setFileContent(content);
        setSelectedTableMeta(null);
        setAvailableTables([]);

        if (fileExtension === 'html' || fileExtension === 'htm') {
          const analysis = analyzeHTML(content);
          if (analysis.tables.length === 0) {
            showToast('В HTML файле не найдено таблиц с данными', 'error');
            setIsFileLoading(false);
            return;
          }

          setAvailableTables(analysis.tables);
          if (analysis.tables.length === 1) {
            await processTableSelection(0, content, file.name, analysis.tables[0]);
          } else {
            const storedIndex = loadSavedTableIndex();
            if (
              storedIndex !== null &&
              storedIndex >= 0 &&
              storedIndex < analysis.tables.length
            ) {
              await processTableSelection(storedIndex, content, file.name, analysis.tables[storedIndex]);
            } else {
              setShowTableSelection(true);
              setIsFileLoading(false);
            }
          }
        } else {
          const parsed = await parseBankStatementFile(file);
          const prepared = prepareParsedDataset(parsed);
          const dataset = prepared.rows;

          if (dataset.length === 0) {
            showToast('Файл пуст', 'error');
            setIsFileLoading(false);
            return;
          }

          const dataRows = prepared.hasHeader ? dataset.slice(1) : dataset;
          if (dataRows.length === 0) {
            showToast('В файле найдены только заголовки без данных', 'warning');
            setIsFileLoading(false);
            return;
          }

          if (dataRows[0].length > 1) {
            openColumnMapping(dataset, prepared.hasHeader);
            showToast(`Загружено ${dataRows.length} строк из файла`, 'success');
          } else {
            appendSingleColumn(dataset, prepared.hasHeader, 'файла');
            setHasHeaderRow(false);
          }
          setIsFileLoading(false);
        }
      } catch (error) {
        console.error('Ошибка при загрузке файла', error);
        showToast('Ошибка при загрузке файла', 'error');
        setIsFileLoading(false);
      } finally {
        if (event.target) {
          event.target.value = '' as any;
        }
      }
    },
    [appendSingleColumn, openColumnMapping, processTableSelection, showToast],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);
      const files = event.dataTransfer.files;
      if (files && files.length > 0) {
        const syntheticEvent = { target: { files } } as unknown as React.ChangeEvent<HTMLInputElement>;
        void handleFileUpload(syntheticEvent);
      }
    },
    [handleFileUpload],
  );

  const clearFileState = useCallback(() => {
    setAvailableTables([]);
    setShowTableSelection(false);
    setFileContent(null);
    setFileName('');
    setSelectedTableMeta(null);
  }, []);

  const closePreviewModal = useCallback(() => {
    setIsPreviewModalOpen(false);
    setPreviewedTable(null);
  }, []);

  const resetSavedTableIndex = useCallback(() => {
    clearSavedTableIndex();
    setSavedTableIndex(null);
  }, []);

  return {
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
    setSelectedTableMeta,
    setIsPreviewModalOpen,
    resetSavedTableIndex,
  };
}
