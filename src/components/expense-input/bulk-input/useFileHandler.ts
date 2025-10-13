'use client'

import { useState, useCallback, useRef } from 'react'
import { useToast } from '@/hooks/useToast'
import {
  parseBankStatementFile,
  analyzeHTML,
  parseCSV,
  parseHTML,
  prepareParsedDataset,
  type TableInfo
} from '@/lib/utils/bankStatementParsers'
import type { ParsedBankData } from '@/types'
import type { SelectedTableMeta } from './types'

interface UseFileHandlerProps {
  appendSingleColumnExpenses: (rows: string[][], hasHeader: boolean, sourceLabel: string) => number
  onDatasetReady: (data: string[][], hasHeader: boolean) => void
  resetDataset: () => void
  setIsColumnMappingOpen: (isOpen: boolean) => void
  setIsEditingColumnMapping: (value: boolean) => void
}

export function useFileHandler({
  appendSingleColumnExpenses,
  onDatasetReady,
  resetDataset,
  setIsColumnMappingOpen,
  setIsEditingColumnMapping
}: UseFileHandlerProps) {
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isFileLoading, setIsFileLoading] = useState(false)
  const [fileName, setFileName] = useState('')
  const [fileContent, setFileContent] = useState<string | null>(null)

  const [availableTables, setAvailableTables] = useState<TableInfo[]>([])
  const [showTableSelection, setShowTableSelection] = useState(false)
  const [selectedTableMeta, setSelectedTableMeta] = useState<SelectedTableMeta | null>(null)
  const [savedTableIndex, setSavedTableIndex] = useState<number | null>(null)

  const [isDragOver, setIsDragOver] = useState(false)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [previewedTable, setPreviewedTable] = useState<{ description: string; rows: string[][] } | null>(null)

  const loadSavedTableIndex = useCallback(() => {
    try {
      const saved = localStorage.getItem('bulkExpenseTableIndex')
      if (saved) {
        const tableIndex = parseInt(saved, 10)
        setSavedTableIndex(tableIndex)
        return tableIndex
      }
    } catch (error) {
      console.warn('Ошибка загрузки сохраненного индекса таблицы:', error)
    }
    return null
  }, [])

  const saveTableIndex = useCallback((tableIndex: number) => {
    try {
      localStorage.setItem('bulkExpenseTableIndex', tableIndex.toString())
      setSavedTableIndex(tableIndex)
    } catch (error) {
      console.warn('Ошибка сохранения индекса таблицы:', error)
    }
  }, [])

  const clearSavedTableIndex = useCallback(() => {
    try {
      localStorage.removeItem('bulkExpenseTableIndex')
      setSavedTableIndex(null)
      setSelectedTableMeta(null)
    } catch (error) {
      console.warn('Ошибка очистки индекса таблицы:', error)
    }
  }, [])

  const processTableSelection = useCallback(
    async (tableIndex: number, currentFileContent: string, currentFileName: string, tableInfo?: TableInfo) => {
      setIsFileLoading(true)
      saveTableIndex(tableIndex)

      const resolvedInfo =
        tableInfo ?? availableTables.find(table => table.index === tableIndex) ?? availableTables[tableIndex]

      if (resolvedInfo) {
        setSelectedTableMeta({
          index: resolvedInfo.index,
          description: resolvedInfo.description,
          rowCount: resolvedInfo.rowCount,
          columnCount: resolvedInfo.columnCount,
          hasHeaders: resolvedInfo.hasHeaders
        })
      }

      try {
        const parsed = await parseBankStatementFile(new File([currentFileContent], currentFileName), tableIndex)
        const prepared = prepareParsedDataset(parsed)
        const dataset = prepared.rows

        if (dataset.length === 0) {
          showToast('Выбранная таблица не содержит данных', 'error')
          return
        }

        const dataRows = prepared.hasHeader ? dataset.slice(1) : dataset
        if (dataRows.length === 0) {
          showToast('Выбранная таблица содержит только заголовки', 'warning')
          return
        }

        if (dataRows[0].length > 1) {
          onDatasetReady(dataset, prepared.hasHeader)
          setIsEditingColumnMapping(false)
          setIsColumnMappingOpen(true)
          showToast(`Загружено ${dataRows.length} строк из выбранной таблицы`, 'success')
        } else {
          appendSingleColumnExpenses(dataset, prepared.hasHeader, 'выбранной таблицы')
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Ошибка обработки таблицы', 'error')
      } finally {
        setShowTableSelection(false)
        setIsFileLoading(false)
      }
    },
    [appendSingleColumnExpenses, availableTables, onDatasetReady, saveTableIndex, setIsColumnMappingOpen, setIsEditingColumnMapping, showToast]
  )

  const handleTableSelection = useCallback(
    async (tableIndex: number, tableInfo?: TableInfo) => {
      if (!fileContent || !fileName) {
        showToast('Сначала загрузите файл с выпиской', 'error')
        return
      }
      await processTableSelection(tableIndex, fileContent, fileName, tableInfo)
    },
    [fileContent, fileName, processTableSelection, showToast]
  )

  const openDatasetFromParsed = useCallback(
    (parsed: ParsedBankData, sourceLabel: string) => {
      const prepared = prepareParsedDataset(parsed)
      const dataset = prepared.rows

      if (dataset.length === 0) {
        showToast(`${sourceLabel} пуст`, 'error')
        return false
      }

      const dataRows = prepared.hasHeader ? dataset.slice(1) : dataset
      if (dataRows.length === 0) {
        showToast(`${sourceLabel} содержит только заголовки`, 'warning')
        return false
      }

      if (dataRows[0].length > 1) {
        onDatasetReady(dataset, prepared.hasHeader)
        setIsEditingColumnMapping(false)
        setIsColumnMappingOpen(true)
        const label = sourceLabel.startsWith('вставлен') ? 'вставленные данные' : sourceLabel
        showToast(`Получены ${dataRows.length} строк из ${label}. Проверьте соответствие столбцов.`, 'success')
      } else {
        appendSingleColumnExpenses(dataset, prepared.hasHeader, sourceLabel)
      }

      return true
    },
    [appendSingleColumnExpenses, onDatasetReady, setIsColumnMappingOpen, setIsEditingColumnMapping, showToast]
  )

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      setIsFileLoading(true)
      try {
        const fileText = await file.text()
        setFileName(file.name)
        setFileContent(fileText)
        setSelectedTableMeta(null)
        setAvailableTables([])

        const fileExtension = file.name.split('.').pop()?.toLowerCase()

        if (fileExtension === 'html' || fileExtension === 'htm') {
          const analysis = analyzeHTML(fileText)
          if (analysis.tables.length === 0) {
            showToast('В HTML файле не найдено таблиц с данными', 'error')
            setIsFileLoading(false)
            return
          }

          setAvailableTables(analysis.tables)
          if (analysis.tables.length === 1) {
            await processTableSelection(0, fileText, file.name, analysis.tables[0])
          } else {
            const savedIdx = loadSavedTableIndex()
            if (savedIdx !== null && savedIdx >= 0 && savedIdx < analysis.tables.length) {
              await processTableSelection(savedIdx, fileText, file.name, analysis.tables[savedIdx])
            } else {
              setShowTableSelection(true)
              setIsFileLoading(false)
            }
          }
          return
        }

        const parsed = await parseBankStatementFile(file)
        openDatasetFromParsed(parsed, 'файла')
      } catch (error) {
        showToast('Ошибка при загрузке файла', 'error')
      } finally {
        setIsFileLoading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [
      loadSavedTableIndex,
      openDatasetFromParsed,
      processTableSelection,
      showToast
    ]
  )

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent) => {
      event.preventDefault()

      setSelectedTableMeta(null)
      setAvailableTables([])
      setFileContent(null)
      setFileName('')
      resetDataset()

      try {
        const htmlData = event.clipboardData.getData('text/html')
        if (htmlData && htmlData.includes('<table')) {
          try {
            const parsedFromHtml = parseHTML(htmlData)
            if (openDatasetFromParsed(parsedFromHtml, 'вставленной таблицы')) {
              return
            }
          } catch (htmlError) {
            console.warn('Не удалось обработать HTML из буфера обмена', htmlError)
          }
        }

        const pastedText = event.clipboardData.getData('text')
        if (!pastedText) {
          showToast('Буфер обмена пуст', 'warning')
          return
        }

        const parsed = parseCSV(pastedText)
        openDatasetFromParsed(parsed, 'буфера обмена')
      } catch (error) {
        console.error('Ошибка при вставке данных', error)
        showToast('Ошибка при вставке данных', 'error')
      }
    },
    [openDatasetFromParsed, resetDataset, showToast]
  )

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setIsDragOver(false)
      const files = event.dataTransfer.files
      if (files && files.length > 0) {
        const syntheticEvent = { target: { files } } as unknown as React.ChangeEvent<HTMLInputElement>
        void handleFileUpload(syntheticEvent)
      }
    },
    [handleFileUpload]
  )

  const handlePreviewTable = useCallback(
    (tableIndex: number) => {
      if (!fileContent) return

      try {
        const parsedTable = parseHTML(fileContent, tableIndex)
        const allRows = parsedTable.headers && parsedTable.headers.length > 0
          ? [parsedTable.headers, ...parsedTable.rows]
          : parsedTable.rows

        setPreviewedTable({
          description: availableTables[tableIndex]?.description || `Таблица ${tableIndex + 1}`,
          rows: allRows
        })
        setIsPreviewModalOpen(true)
      } catch (error) {
        console.error('Ошибка предпросмотра таблицы', error)
        showToast('Не удалось загрузить предпросмотр таблицы', 'error')
      }
    },
    [availableTables, fileContent, showToast]
  )

  const handleFileStateReset = useCallback(() => {
    setFileName('')
    setFileContent(null)
    setAvailableTables([])
    setShowTableSelection(false)
    setSelectedTableMeta(null)
    setIsDragOver(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

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
    handleFileStateReset
  }
}
