'use client'

import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/useToast';
import {
  parseBankStatementFile,
  analyzeHTML,
  parseCSV,
  parseHTML,
  prepareParsedDataset
} from '@/lib/utils/bankStatementParsers';
import type { TableInfo } from '@/lib/utils/bankStatementParsers';
import type { ParsedBankData } from '@/types';

// Типы, которые должны быть доступны и в хуке, и в основном компоненте
type SelectedTableMeta = Pick<
  TableInfo,
  'index' | 'description' | 'rowCount' | 'columnCount' | 'hasHeaders'
>

interface UseFileHandlerProps {
  appendSingleColumnExpenses: (rows: string[][], hasHeader: boolean, sourceLabel: string) => number;
  setPastedData: (data: string[][]) => void;
  setHasHeaderRow: (hasHeader: boolean) => void;
  setIsColumnMappingOpen: (isOpen: boolean) => void;
  setIsEditingColumnMapping: (isEditing: boolean) => void;
}

export function useFileHandler({ 
  appendSingleColumnExpenses, 
  setPastedData, 
  setHasHeaderRow, 
  setIsColumnMappingOpen, 
  setIsEditingColumnMapping
}: UseFileHandlerProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isFileLoading, setIsFileLoading] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [fileContent, setFileContent] = useState<string | null>(null);
  
  const [availableTables, setAvailableTables] = useState<TableInfo[]>([]);
  const [showTableSelection, setShowTableSelection] = useState(false);
  const [selectedTableMeta, setSelectedTableMeta] = useState<SelectedTableMeta | null>(null);
  const [savedTableIndex, setSavedTableIndex] = useState<number | null>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewedTable, setPreviewedTable] = useState<{ description: string; rows: string[][] } | null>(null);

  const loadSavedTableIndex = useCallback(() => {
    try {
      const saved = localStorage.getItem('bulkExpenseTableIndex');
      if (saved) {
        const tableIndex = parseInt(saved, 10);
        setSavedTableIndex(tableIndex);
        return tableIndex;
      }
    } catch (error) { console.warn('Ошибка загрузки сохраненного индекса таблицы:', error); }
    return null;
  }, []);

  const saveTableIndex = useCallback((tableIndex: number) => {
    try {
      localStorage.setItem('bulkExpenseTableIndex', tableIndex.toString());
      setSavedTableIndex(tableIndex);
    } catch (error) { console.warn('Ошибка сохранения индекса таблицы:', error); }
  }, []);

  const clearSavedTableIndex = useCallback(() => {
    try {
      localStorage.removeItem('bulkExpenseTableIndex');
      setSavedTableIndex(null);
      setSelectedTableMeta(null);
    } catch (error) { console.warn('Ошибка очистки индекса таблицы:', error); }
  }, []);

  const processTableSelection = useCallback(
    async (tableIndex: number, currentFileContent: string, currentFileName: string, tableInfo?: TableInfo) => {
      setIsFileLoading(true);
      saveTableIndex(tableIndex);

      const resolvedInfo = tableInfo ?? availableTables.find(table => table.index === tableIndex) ?? availableTables[tableIndex];
      if (resolvedInfo) {
        setSelectedTableMeta({ ...resolvedInfo });
      }

      try {
        const parsed = await parseBankStatementFile(new File([currentFileContent], currentFileName), tableIndex);
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
          setPastedData(dataset);
          setHasHeaderRow(prepared.hasHeader);
          setIsEditingColumnMapping(false);
          setIsColumnMappingOpen(true);
          showToast(`Загружено ${dataRows.length} строк из выбранной таблицы`, 'success');
        } else {
          appendSingleColumnExpenses(dataset, prepared.hasHeader, 'выбранной таблицы');
          setHasHeaderRow(false);
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Ошибка обработки таблицы', 'error');
      } finally {
        setShowTableSelection(false);
        setIsFileLoading(false);
      }
    },
    [appendSingleColumnExpenses, availableTables, saveTableIndex, showToast, setPastedData, setHasHeaderRow, setIsEditingColumnMapping, setIsColumnMappingOpen]
  );

  const handleTableSelection = useCallback(async (tableIndex: number, tableInfo?: TableInfo) => {
    if (!fileContent || !fileName) {
      showToast('Сначала загрузите файл с выпиской', 'error');
      return;
    }
    await processTableSelection(tableIndex, fileContent, fileName, tableInfo);
  }, [fileContent, fileName, processTableSelection, showToast]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsFileLoading(true);
    try {
      const fileText = await file.text();
      setFileName(file.name);
      setFileContent(fileText);
      setSelectedTableMeta(null);
      setAvailableTables([]);

      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'pdf') {
        // PDF logic remains here for now due to API call
      } else if (fileExtension === 'html' || fileExtension === 'htm') {
        const analysis = analyzeHTML(fileText);
        if (analysis.tables.length === 0) {
          showToast('В HTML файле не найдено таблиц с данными', 'error');
          setIsFileLoading(false);
          return;
        }
        setAvailableTables(analysis.tables);
        if (analysis.tables.length === 1) {
          await processTableSelection(0, fileText, file.name, analysis.tables[0]);
        } else {
          const savedIdx = loadSavedTableIndex();
          if (savedIdx !== null && savedIdx >= 0 && savedIdx < analysis.tables.length) {
            await processTableSelection(savedIdx, fileText, file.name, analysis.tables[savedIdx]);
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
          setPastedData(dataset);
          setHasHeaderRow(prepared.hasHeader);
          setIsEditingColumnMapping(false);
          setIsColumnMappingOpen(true);
          showToast(`Загружено ${dataRows.length} строк из файла`, 'success');
        } else {
          appendSingleColumnExpenses(dataset, prepared.hasHeader, 'файла');
          setHasHeaderRow(false);
        }
        setIsFileLoading(false);
      }
    } catch (error) {
      showToast('Ошибка при загрузке файла', 'error');
      setIsFileLoading(false);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [showToast, processTableSelection, loadSavedTableIndex, appendSingleColumnExpenses, setPastedData, setHasHeaderRow, setIsColumnMappingOpen, setIsEditingColumnMapping]);

  const handlePaste = useCallback(async (event: React.ClipboardEvent) => {
    event.preventDefault();
    showToast('Paste event triggered', 'info');

    const files = event.clipboardData.files;
    if (files && files.length > 0) {
      showToast(`Found ${files.length} file(s) in clipboard.`, 'info');
      const syntheticEvent = { target: { files } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileUpload(syntheticEvent);
      return;
    }

    showToast('No files in clipboard, processing as text.', 'info');
    setSelectedTableMeta(null);
    setAvailableTables([]);
    setFileContent(null);
    setFileName('');

    try {
      const pastedText = event.clipboardData.getData('text');
      if (!pastedText) {
        showToast('Буфер обмена пуст', 'warning');
        return;
      }
      const parsed = parseCSV(pastedText);
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
        setPastedData(dataset);
        setHasHeaderRow(prepared.hasHeader);
        setIsEditingColumnMapping(false);
        setIsColumnMappingOpen(true);
        showToast(`Получены данные (${dataRows.length} строк). Проверьте соответствие столбцов.`, 'success');
      } else {
        appendSingleColumnExpenses(dataset, prepared.hasHeader, 'буфера обмена');
        setHasHeaderRow(false);
      }
    } catch (error) {
      console.error('Ошибка при вставке данных', error);
      showToast('Ошибка при вставке данных', 'error');
    }
  }, [showToast, appendSingleColumnExpenses, setPastedData, setHasHeaderRow, setIsColumnMappingOpen, setIsEditingColumnMapping, handleFileUpload]);

  const handleDragOver = useCallback((event: React.DragEvent) => { event.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((event: React.DragEvent) => { event.preventDefault(); setIsDragOver(false); }, []);
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      const syntheticEvent = { target: { files } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileUpload(syntheticEvent);
    }
  }, [handleFileUpload]);

  const handlePreviewTable = (tableIndex: number) => {
    if (!fileContent) return;
    try {
      const parsedTable = parseHTML(fileContent, tableIndex);
      const allRows = parsedTable.headers && parsedTable.headers.length > 0 
        ? [parsedTable.headers, ...parsedTable.rows] 
        : parsedTable.rows;
      setPreviewedTable({ description: availableTables[tableIndex]?.description || `Таблица ${tableIndex + 1}`, rows: allRows });
      setIsPreviewModalOpen(true);
    } catch (error) {
      console.error("Error previewing table:", error);
      showToast("Не удалось загрузить предпросмотр таблицы", "error");
    }
  };

  const handleClear = useCallback(() => {
    setFileName('');
    setFileContent(null);
    setAvailableTables([]);
    setShowTableSelection(false);
    setSelectedTableMeta(null);
    setIsDragOver(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return {
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
    handleClear
  };
}
