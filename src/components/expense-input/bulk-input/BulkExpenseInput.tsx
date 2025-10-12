'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/hooks/useToast'
import { BulkExpenseTable } from './BulkExpenseTable'
import { BulkExpensePreview } from './BulkExpensePreview'
import { ColumnMappingModal } from './ColumnMappingModal'

import { createBulkExpenses } from '@/lib/actions/expenses'
import { createBankStatement } from '@/lib/actions/bankStatements'
import { getCurrentDateISO } from '@/lib/utils/dateUtils'
import {
  parseBankStatementFile,
  analyzeHTML,
  parseDateAndTime,
  parseCSV,
  parseHTML,
  parseAmount,
  parseTimeValue
} from '@/lib/utils/bankStatementParsers'
import { extractCityFromDescription } from '@/lib/utils/cityParser'
import type {
  Category,
  CreateExpenseData,
  ColumnMapping,
  ColumnMappingField,
  ParsedBankData
} from '@/types'
import type { BulkExpenseRowData } from '@/lib/validations/expenses'
import type { TableInfo } from '@/lib/utils/bankStatementParsers'
import { useCitySynonyms } from '@/hooks/useCitySynonyms'
import { buildCityOptions, type CityOption } from '@/lib/utils/cityOptions'

type SelectedTableMeta = Pick<
  TableInfo,
  'index' | 'description' | 'rowCount' | 'columnCount' | 'hasHeaders'
>

const HEADER_KEYWORDS = [
  'amount',
  'сумм',
  'sum',
  'debet',
  'credit',
  'дата',
  'date',
  'опис',
  'description',
  'city',
  'город',
  'time',
  'время',
  'note',
  'примеч'
]

type AutoExtractionReviewItem = {
  type: 'city-from-description'
  rowIndex: number
  columnLabel: string
  sourceValue: string
  extractedCity: string
  cleanedDescription: string
}

type CityReviewItem = AutoExtractionReviewItem

interface BuildExpensesStats {
  totalRows: number
  importedRows: number
  skippedRows: number
  autoDetectedCities: number
  manualCities: number
  detectedTimes: number
  manualTimes: number
}

interface BuildExpensesResult {
  expenses: BulkExpenseRowData[]
  stats: BuildExpensesStats
  reviewItems: AutoExtractionReviewItem[]
}

function normalizeRow(row: string[] = []): string[] {
  return row.map(cell => (cell ?? '').trim())
}

function removeEmptyRows(rows: string[][], preserveFirstRow = false): string[][] {
  return rows.filter((row, index) => {
    if (preserveFirstRow && index === 0) {
      return true
    }
    return row.some(cell => cell && cell.trim().length > 0)
  })
}

function detectHeaderRow(headerRow: string[], firstDataRow?: string[]): boolean {
  if (!headerRow || headerRow.length === 0) {
    return false
  }

  const normalizedHeader = headerRow.map(cell => cell.trim().toLowerCase())
  const headerHasKeywords = normalizedHeader.some(cell =>
    HEADER_KEYWORDS.some(keyword => cell.includes(keyword))
  )
  if (headerHasKeywords) {
    return true
  }

  const headerHasDigits = headerRow.some(cell => /\d/.test(cell))
  const dataHasDigits = firstDataRow ? firstDataRow.some(cell => /\d/.test(cell)) : false

  return !headerHasDigits && dataHasDigits
}

function prepareParsedDataset(parsed: ParsedBankData): { rows: string[][]; hasHeader: boolean } {
  const headerRow = normalizeRow(parsed.headers || [])
  const dataRows = (parsed.rows || []).map(normalizeRow)
  const firstDataRow = dataRows[0]

  const headerHasContent = headerRow.some(cell => cell.length > 0)
  const hasHeader = headerHasContent && detectHeaderRow(headerRow, firstDataRow)

  if (hasHeader) {
    return {
      rows: removeEmptyRows([headerRow, ...dataRows], true),
      hasHeader: true
    }
  }

  if (headerHasContent) {
    return {
      rows: removeEmptyRows([headerRow, ...dataRows]),
      hasHeader: false
    }
  }

  return {
    rows: removeEmptyRows(dataRows),
    hasHeader: false
  }
}

interface BulkExpenseInputProps {
  categories: Category[]
}

export function BulkExpenseInput({ categories }: BulkExpenseInputProps) {
  const [expenses, setExpenses] = useState<BulkExpenseRowData[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isColumnMappingOpen, setIsColumnMappingOpen] = useState(false)
  const [pastedData, setPastedData] = useState<string[][]>([])
  const [hasHeaderRow, setHasHeaderRow] = useState(false)
  const [autoRedirect, setAutoRedirect] = useState(false) // Изначально выключен
  const [savedColumnMapping, setSavedColumnMapping] = useState<ColumnMapping[] | null>(null)
  const [isEditingColumnMapping, setIsEditingColumnMapping] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [showTableSelection, setShowTableSelection] = useState(false)
  const [availableTables, setAvailableTables] = useState<TableInfo[]>([])
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [savedTableIndex, setSavedTableIndex] = useState<number | null>(null)
  const [selectedTableMeta, setSelectedTableMeta] = useState<SelectedTableMeta | null>(null)
  const [reviewModalState, setReviewModalState] = useState<{
    mode: 'append' | 'directSave'
    result: BuildExpensesResult
  } | null>(null)
  const [isReviewProcessing, setIsReviewProcessing] = useState(false)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewedTable, setPreviewedTable] = useState<{ description: string; rows: string[][] } | null>(null);
  const [isFileLoading, setIsFileLoading] = useState(false)
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { synonyms: citySynonyms } = useCitySynonyms()

  const { cityOptions, cityLookupBySynonym, cityLookupById } = useMemo(
    () => buildCityOptions(citySynonyms),
    [citySynonyms]
  )

  const resolveCityByInput = useCallback(
    (value: string): CityOption | null => {
      const normalized = value.trim().toLowerCase()
      if (!normalized) {
        return null
      }
      return cityLookupBySynonym.get(normalized) ?? null
    },
    [cityLookupBySynonym]
  )

  // Загрузка сохраненной схемы столбцов при инициализации
  const loadSavedColumnMapping = useCallback(() => {
    try {
      const saved = localStorage.getItem('bulkExpenseColumnMapping')
      if (saved) {
        const parsed = JSON.parse(saved)
        const normalized = normalizeColumnMapping(parsed)
        setSavedColumnMapping(normalized.length > 0 ? normalized : null)
        return normalized
      }
    } catch (error) {
      console.warn('Ошибка загрузки сохраненной схемы столбцов:', error)
    }
    setSavedColumnMapping(null)
    return []
  }, [])

  // Сохранение схемы столбцов
  const saveColumnMapping = useCallback((mapping: ColumnMapping[]) => {
    try {
      const sanitized = sanitizeColumnMapping(mapping)
      localStorage.setItem('bulkExpenseColumnMapping', JSON.stringify(sanitized))
      setSavedColumnMapping(sanitized.length > 0 ? sanitized : null)
    } catch (error) {
      console.warn('Ошибка сохранения схемы столбцов:', error)
    }
  }, [])

  // Загрузка сохраненного индекса таблицы
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

  // Сохранение индекса таблицы
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

  // Загружаем сохраненные настройки при первом рендере
  useEffect(() => {
    setIsMounted(true)
    loadSavedColumnMapping()
    loadSavedTableIndex()
  }, [loadSavedColumnMapping, loadSavedTableIndex])

  // Добавить новую строку
  const addRow = useCallback(() => {
    const newRow: BulkExpenseRowData = {
      amount: 0,
      description: '',
      notes: '',
      category_id: '',
      expense_date: getCurrentDateISO(),
      expense_time: '',
      city: '',
      city_id: null,
      tempId: crypto.randomUUID()
    }
    setExpenses(prev => [...prev, newRow])
  }, [])

  // Удалить строку
  const removeRow = useCallback((tempId: string) => {
    setExpenses(prev => prev.filter(expense => expense.tempId !== tempId))
    setValidationErrors(prev => {
      const newErrors = { ...prev }
      Object.keys(newErrors).forEach(key => {
        if (key.startsWith(`${tempId}-`)) {
          delete newErrors[key]
        }
      })
      return newErrors
    })
  }, [])

  // Обновить строку
  const updateRow = useCallback((tempId: string, field: keyof BulkExpenseRowData, value: any) => {
    setExpenses(prev => prev.map(expense =>
      expense.tempId === tempId
        ? { ...expense, [field]: value }
        : expense
    ))

    // Очистить ошибку валидации для этого поля
    const errorKey = `${tempId}-${field}`
    if (validationErrors[errorKey]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[errorKey]
        return newErrors
      })
    }
  }, [validationErrors])

  // Валидация данных
  const validateExpenses = useCallback(() => {
    const errors: Record<string, string> = {}
    let hasErrors = false

    expenses.forEach((expense, index) => {
      const prefix = expense.tempId || index.toString()

      if (!expense.amount || expense.amount <= 0) {
        errors[`${prefix}-amount`] = 'Сумма должна быть больше 0'
        hasErrors = true
      }

      if (!expense.description?.trim()) {
        errors[`${prefix}-description`] = 'Описание обязательно'
        hasErrors = true
      }

      if (!expense.expense_date) {
        errors[`${prefix}-expense_date`] = 'Дата обязательна'
        hasErrors = true
      }

      if (expense.expense_time && expense.expense_time.trim()) {
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
        if (!timeRegex.test(expense.expense_time.trim())) {
          errors[`${prefix}-expense_time`] = 'Время должно быть в формате ЧЧ:ММ'
          hasErrors = true
        }
      }
    })

    setValidationErrors(errors)
    return !hasErrors
  }, [expenses])

  const appendSingleColumnExpenses = useCallback((rows: string[][], hasHeader: boolean, sourceLabel: string) => {
    const dataRows = (hasHeader ? rows.slice(1) : rows)
      .map(normalizeRow)
      .filter(row => row[0] && row[0].trim())

    if (dataRows.length === 0) {
      showToast('Не найдены значения для описания', 'warning')
      return 0
    }

    const newExpenses: BulkExpenseRowData[] = dataRows.map(row => ({
      amount: 0,
      description: row[0].trim(),
      city: '',
      city_id: null,
      notes: '',
      category_id: '',
      expense_date: getCurrentDateISO(),
      expense_time: '',
      tempId: crypto.randomUUID()
    }))

    setExpenses(prev => [...prev, ...newExpenses])
    showToast(`Добавлено ${newExpenses.length} описаний из ${sourceLabel}`, 'success')
    return newExpenses.length
  }, [showToast])

  // Обработка вставки из буфера обмена
  const handlePaste = useCallback(async (event: React.ClipboardEvent) => {
    event.preventDefault()

    setSelectedTableMeta(null)
    setAvailableTables([])
    setFileContent(null)
    setFileName('')

    try {
      const htmlData = event.clipboardData.getData('text/html')
      if (htmlData && htmlData.includes('<table')) {
        try {
          const parsedFromHtml = parseHTML(htmlData)
          const prepared = prepareParsedDataset(parsedFromHtml)
          const dataset = prepared.rows

          if (dataset.length === 0) {
            showToast('Вставленная таблица не содержит данных', 'error')
            return
          }

          const dataRows = prepared.hasHeader ? dataset.slice(1) : dataset
          if (dataRows.length === 0) {
            showToast('Вставленная таблица содержит только заголовки', 'warning')
            return
          }

          if (dataRows[0].length > 1) {
            setPastedData(dataset)
            setHasHeaderRow(prepared.hasHeader)
            setIsEditingColumnMapping(false)
            setIsColumnMappingOpen(true)
            showToast(`Обнаружена таблица (${dataRows.length} строк). Назначьте столбцы и проверьте данные.`, 'success')
            return
          }

          appendSingleColumnExpenses(dataset, prepared.hasHeader, 'вставленной таблицы')
          setHasHeaderRow(false)
          return
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
      const prepared = prepareParsedDataset(parsed)
      const dataset = prepared.rows

      if (dataset.length === 0) {
        showToast('Вставленные данные пусты', 'error')
        return
      }

      const dataRows = prepared.hasHeader ? dataset.slice(1) : dataset
      if (dataRows.length === 0) {
        showToast('Не найдены строки с данными', 'error')
        return
      }

      if (dataRows[0].length > 1) {
        setPastedData(dataset)
        setHasHeaderRow(prepared.hasHeader)
        setIsEditingColumnMapping(false)
        setIsColumnMappingOpen(true)
        showToast(`Получены данные (${dataRows.length} строк). Проверьте соответствие столбцов.`, 'success')
        return
      }

      appendSingleColumnExpenses(dataset, prepared.hasHeader, 'буфера обмена')
      setHasHeaderRow(false)
    } catch (error) {
      console.error('Ошибка при вставке данных', error)
      showToast('Ошибка при вставке данных', 'error')
    }
  }, [showToast, appendSingleColumnExpenses])



  const buildExpensesFromMappedData = useCallback((mapping: ColumnMapping[]): BuildExpensesResult => {
    const stats: BuildExpensesStats = {
      totalRows: 0,
      importedRows: 0,
      skippedRows: 0,
      autoDetectedCities: 0,
      manualCities: 0,
      detectedTimes: 0,
      manualTimes: 0
    }

    if (pastedData.length === 0) {
      return { expenses: [] as BulkExpenseRowData[], stats, reviewItems: [] }
    }

    const headerRow = hasHeaderRow ? pastedData[0] : null
    const getColumnLabel = (index: number) => {
      const headerValue = headerRow?.[index]?.trim()
      if (headerValue) {
        return headerValue
      }

      if (index >= 0 && index < 26) {
        return `Столбец ${String.fromCharCode(65 + index)}`
      }

      return `Столбец ${index + 1}`
    }

    const mappingWithMeta = sanitizeColumnMapping(mapping).map((column, columnIndex) => ({
      ...column,
      columnIndex,
      columnLabel: getColumnLabel(columnIndex),
      targetFields: Array.isArray(column.targetFields)
        ? column.targetFields.filter(isColumnMappingField)
        : [],
      hidden: Boolean(column.hidden)
    }))

    const rowsToProcess = (hasHeaderRow ? pastedData.slice(1) : pastedData)
      .map(normalizeRow)
      .filter(row => row.some(cell => cell && cell.trim().length > 0))

    stats.totalRows = rowsToProcess.length

    const newExpenses: BulkExpenseRowData[] = []
    const reviewItems: AutoExtractionReviewItem[] = []

    rowsToProcess.forEach((row, dataRowIndex) => {
      const expenseData: Partial<BulkExpenseRowData> & { expense_time?: string | null } = {
        tempId: crypto.randomUUID()
      }

      let descriptionColumnLabel: string | null = null
      let descriptionSourceValue = ''
      let descriptionColumnIndex: number | null = null

      mappingWithMeta.forEach(column => {
        if (column.hidden) {
          return
        }

        if (!column.enabled || column.targetFields.length === 0) return

        const cellValue = row[column.columnIndex]?.trim() || ''
        if (!cellValue) return

        column.targetFields.forEach(targetField => {
          switch (targetField) {
            case 'amount': {
              try {
                const parsedAmount = parseAmount(cellValue)
                const normalizedAmount = Math.abs(parsedAmount)
                if (normalizedAmount > 0) {
                  expenseData.amount = normalizedAmount
                }
              } catch (error) {
                console.warn('Не удалось распарсить сумму из столбца', cellValue, error)
              }
              break
            }
            case 'description':
              expenseData.description = cellValue
              descriptionColumnLabel = column.columnLabel
              descriptionSourceValue = cellValue
              descriptionColumnIndex = column.columnIndex
              break
            case 'city':
              expenseData.city = cellValue
              break
            case 'expense_date': {
              const dateTimeResult = parseDateAndTime(cellValue)
              expenseData.expense_date = dateTimeResult.date
              if (dateTimeResult.time && !expenseData.expense_time) {
                expenseData.expense_time = dateTimeResult.time
                stats.detectedTimes += 1
              }
              break
            }
            case 'expense_time': {
              if (expenseData.expense_time) {
                break
              }
              const parsedTime = parseTimeValue(cellValue)
              if (parsedTime) {
                expenseData.expense_time = parsedTime
                stats.manualTimes += 1
              }
              break
            }
            case 'notes':
              expenseData.notes = cellValue
              break
          }
        })
      })

      if (expenseData.amount && expenseData.description) {
        let cleanDescription = expenseData.description.trim()
        let notes = expenseData.notes?.trim() || ''
        let detectedCity: string | null = null

        if (cleanDescription) {
          const cityParseResult = extractCityFromDescription(cleanDescription)
          if (cityParseResult.confidence > 0.6) {
            cleanDescription = cityParseResult.cleanDescription
            if (!expenseData.city && cityParseResult.displayCity) {
              detectedCity = cityParseResult.displayCity
            }
          }
        }

        const providedCity = expenseData.city?.trim()
        let finalCity = providedCity || detectedCity || ''
        let resolvedCityId: string | null = null

        if (providedCity) {
          stats.manualCities += 1
          const resolved = resolveCityByInput(providedCity)
          if (resolved) {
            finalCity = resolved.cityName
            resolvedCityId = resolved.cityId
          }
        } else if (detectedCity) {
          stats.autoDetectedCities += 1
          const resolved = resolveCityByInput(detectedCity)
          if (resolved) {
            finalCity = resolved.cityName
            resolvedCityId = resolved.cityId
          }
          const reviewNote = `Автодетект города: ${finalCity || detectedCity}`
          if (!notes.includes(reviewNote)) {
            notes = notes ? `${notes}\n${reviewNote}` : reviewNote
          }
          reviewItems.push({
            type: 'city-from-description',
            rowIndex: dataRowIndex + 1,
            columnLabel:
              descriptionColumnLabel || getColumnLabel(descriptionColumnIndex ?? 0),
            sourceValue: descriptionSourceValue,
            extractedCity: finalCity || detectedCity,
            cleanedDescription: cleanDescription
          })
        }

        newExpenses.push({
          amount: expenseData.amount,
          description: cleanDescription,
          notes,
          category_id: '',
          expense_date: expenseData.expense_date || getCurrentDateISO(),
          expense_time: expenseData.expense_time || null,
          city: finalCity,
          city_id: resolvedCityId,
          tempId: expenseData.tempId!
        })
      }
    })

    stats.importedRows = newExpenses.length
    stats.skippedRows = Math.max(stats.totalRows - stats.importedRows, 0)

    return { expenses: newExpenses, stats, reviewItems }
  }, [pastedData, hasHeaderRow, resolveCityByInput])

  const appendExpensesWithStats = useCallback((result: BuildExpensesResult) => {
    const { expenses: newExpenses, stats } = result

    setExpenses(prev => [...prev, ...newExpenses])
    setPastedData([])
    setHasHeaderRow(false)

    showToast(`Добавлено ${newExpenses.length} из ${stats.totalRows} записей`, 'success')

    if (stats.autoDetectedCities > 0 || stats.detectedTimes > 0 || stats.manualTimes > 0) {
      const details: string[] = []
      if (stats.autoDetectedCities > 0) {
        details.push(`автогорода: ${stats.autoDetectedCities}`)
      }
      if (stats.manualTimes + stats.detectedTimes > 0) {
        details.push(`время: ${stats.manualTimes + stats.detectedTimes}`)
      }
      const suffix = details.length > 0 ? ` (${details.join(', ')})` : ''
      showToast(`Пожалуйста, подтвердите автоматически заполненные поля${suffix}.`, 'info')
    } else {
      showToast('Проверьте импортированные данные перед сохранением.', 'info')
    }
  }, [showToast])

  const saveImportedExpenses = useCallback(async (result: BuildExpensesResult) => {
    const { expenses: newExpenses, stats } = result

    let batchId: string | undefined = undefined;
    if (fileName) {
        batchId = crypto.randomUUID();
        const fileType = fileName.split('.').pop()?.toLowerCase() || 'unknown';
        
        const statementResult = await createBankStatement({
            id: batchId,
            filename: fileName,
            file_type: fileType,
            total_records: newExpenses.length,
        });

        if (statementResult.error) {
            showToast(`Ошибка создания записи о выписке: ${statementResult.error}`, 'error');
            return false;
        }
    }

    const expensesToCreate: CreateExpenseData[] = newExpenses.map(expense => ({
      amount: expense.amount,
      description: expense.description,
      notes: expense.notes,
      category_id: expense.category_id || undefined,
      expense_date: expense.expense_date,
      expense_time: expense.expense_time || null,
      city_id: expense.city_id || undefined,
      city_input: expense.city?.trim() || undefined,
      input_method: 'bulk_table' as const,
      batch_id: batchId
    }))

    const resultAction = await createBulkExpenses(expensesToCreate)

    if (resultAction.error) {
      showToast(resultAction.error, 'error')
      return false
    }

    if (resultAction.success && resultAction.stats) {
      const { success, failed, uncategorized, total } = resultAction.stats

      let message = `Создано ${success} из ${total} расходов`
      if (failed > 0) {
        message += `, ${failed} с ошибками`
      }
      if (uncategorized > 0) {
        message += `, ${uncategorized} без категории`
      }

      showToast(message, success > 0 ? 'success' : 'error')

      if (success > 0) {
        setPastedData([])
        setHasHeaderRow(false)
        setFileName('')

        if (stats.autoDetectedCities > 0 || stats.detectedTimes > 0 || stats.manualTimes > 0) {
          const details: string[] = []
          if (stats.autoDetectedCities > 0) {
            details.push(`автогорода: ${stats.autoDetectedCities}`)
          }
          if (stats.manualTimes + stats.detectedTimes > 0) {
            details.push(`время: ${stats.manualTimes + stats.detectedTimes}`)
          }
          const suffix = details.length > 0 ? ` (${details.join(', ')})` : ''
          showToast(`Автоматически заполненные поля сохранены${suffix}. Проверьте их в списке расходов.`, 'info')
        }

        if (autoRedirect) {
          router.push('/expenses')
        }
      }

      return success > 0
    }

    return false
  }, [showToast, autoRedirect, router, fileName])

  // Применение настроек столбцов
  const handleColumnMappingApply = useCallback((mapping: ColumnMapping[]) => {
    try {
      // Сохраняем схему столбцов для будущего использования
      saveColumnMapping(mapping)

      // В режиме редактирования только сохраняем настройки
      if (isEditingColumnMapping) {
        showToast('Настройки столбцов сохранены', 'success')
        return
      }

      const result = buildExpensesFromMappedData(mapping)

      if (result.expenses.length > 0) {
        if (result.reviewItems.length > 0) {
          setReviewModalState({
            mode: 'append',
            result
          })
          showToast('Найдены автоматически выделенные поля. Подтвердите импорт.', 'info')
        } else {
          appendExpensesWithStats(result)
        }
      } else {
        showToast('Не удалось обработать данные с текущими настройками столбцов', 'error')
      }
    } catch (error) {
      console.error('Ошибка при обработке данных маппинга', error)
      showToast('Ошибка при обработке данных', 'error')
    }
  }, [
    saveColumnMapping,
    isEditingColumnMapping,
    showToast,
    buildExpensesFromMappedData,
    appendExpensesWithStats
  ])

  // Применение настроек столбцов и прямое сохранение
  const handleColumnMappingApplyAndSave = useCallback(async (mapping: ColumnMapping[]) => {
    try {
      // Сохраняем схему столбцов для будущего использования
      saveColumnMapping(mapping)

      const result = buildExpensesFromMappedData(mapping)

      if (result.expenses.length === 0) {
        showToast('Не удалось обработать данные с текущими настройками столбцов', 'error')
        return
      }

      if (result.reviewItems.length > 0) {
        setReviewModalState({
          mode: 'directSave',
          result
        })
        showToast('Найдены автоматически выделенные поля. Подтвердите сохранение.', 'info')
        return
      }

      await saveImportedExpenses(result)

    } catch (error) {
      showToast('Ошибка при сохранении расходов', 'error')
    }
  }, [saveColumnMapping, buildExpensesFromMappedData, showToast, saveImportedExpenses])

  const reviewSummary = useMemo(() => {
    if (!reviewModalState) {
      return { cityItems: [] as CityReviewItem[] }
    }

    const cityItems = reviewModalState.result.reviewItems.filter(
      (item): item is CityReviewItem => item.type === 'city-from-description'
    )

    return { cityItems }
  }, [reviewModalState])

  const hasPendingDataset = pastedData.length > 0

  const handleReviewCancel = useCallback(() => {
    if (!reviewModalState) {
      return
    }

    if (reviewModalState.mode === 'append') {
      showToast('Импорт отменён. При необходимости скорректируйте назначение столбцов.', 'info')
      if (hasPendingDataset) {
        setIsEditingColumnMapping(false)
        setIsColumnMappingOpen(true)
      }
    } else {
      showToast('Прямое сохранение отменено.', 'info')
    }

    setReviewModalState(null)
  }, [
    reviewModalState,
    showToast,
    hasPendingDataset,
    setIsEditingColumnMapping,
    setIsColumnMappingOpen
  ])

  const handleReviewConfirm = useCallback(async () => {
    if (!reviewModalState) {
      return
    }

    if (reviewModalState.mode === 'append') {
      const resultToApply = reviewModalState.result
      setReviewModalState(null)
      appendExpensesWithStats(resultToApply)
      return
    }

    const resultToSave = reviewModalState.result
    setIsReviewProcessing(true)
    try {
      const success = await saveImportedExpenses(resultToSave)
      if (success) {
        setReviewModalState(null)
      }
    } finally {
      setIsReviewProcessing(false)
    }
  }, [reviewModalState, appendExpensesWithStats, saveImportedExpenses])

  const totalReviewCount = reviewSummary.cityItems.length
  const cityPreview = reviewSummary.cityItems.slice(0, 6)
  const cityOverflow = reviewSummary.cityItems.length - cityPreview.length
  const reviewPrimaryLabel = reviewModalState?.mode === 'directSave'
    ? (isReviewProcessing ? 'Сохранение...' : 'Подтвердить и сохранить')
    : 'Подтвердить импорт'

  const processTableSelection = useCallback(
    async (tableIndex: number, currentFileContent: string, currentFileName: string, tableInfo?: TableInfo) => {
      setIsFileLoading(true)

      // Сохраняем выбранный индекс таблицы
      saveTableIndex(tableIndex)

      const resolvedInfo =
        tableInfo ??
        availableTables.find(table => table.index === tableIndex) ??
        availableTables[tableIndex]

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
          setPastedData(dataset)
          setHasHeaderRow(prepared.hasHeader)
          setIsEditingColumnMapping(false)
          setIsColumnMappingOpen(true)
          showToast(`Загружено ${dataRows.length} строк из выбранной таблицы`, 'success')
        } else {
          appendSingleColumnExpenses(dataset, prepared.hasHeader, 'выбранной таблицы')
          setHasHeaderRow(false)
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Ошибка обработки таблицы', 'error')
      } finally {
        setShowTableSelection(false)
        setIsFileLoading(false)
      }
    },
    [appendSingleColumnExpenses, availableTables, saveTableIndex, showToast]
  )

  // Обработка выбора таблицы из HTML файла
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



  const handlePreviewTable = (tableIndex: number) => {
    if (!fileContent) return;

    try {
      const parsedTable = parseHTML(fileContent, tableIndex);
      const allRows = parsedTable.headers && parsedTable.headers.length > 0 
        ? [parsedTable.headers, ...parsedTable.rows] 
        : parsedTable.rows;

      setPreviewedTable({
        description: availableTables[tableIndex]?.description || `Таблица ${tableIndex + 1}`,
        rows: allRows,
      });
      setIsPreviewModalOpen(true);
    } catch (error) {
      console.error("Error previewing table:", error);
      showToast("Не удалось загрузить предпросмотр таблицы", "error");
    }
  };

  // Загрузка из файла
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsFileLoading(true)
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase()
      const content = await file.text()

      // Сохраняем информацию о файле
      setFileName(file.name)
      setFileContent(content)
      setSelectedTableMeta(null)
      setAvailableTables([])

      // Для HTML файлов показываем выбор таблицы
      if (fileExtension === 'html' || fileExtension === 'htm') {
        try {
          const analysis = analyzeHTML(content)

          if (analysis.tables.length === 0) {
            showToast('В HTML файле не найдено таблиц с данными', 'error')
            setIsFileLoading(false)
            return
          }

          setAvailableTables(analysis.tables)

          if (analysis.tables.length === 1) {
            // Если только одна таблица, используем её сразу
            await processTableSelection(0, content, file.name, analysis.tables[0])
          } else {
            // Проверяем, есть ли сохраненный индекс таблицы и подходит ли он
            const savedIdx = loadSavedTableIndex()
            if (savedIdx !== null &&
                savedIdx >= 0 &&
                savedIdx < analysis.tables.length) {
              // Используем сохраненную таблицу автоматически
              await processTableSelection(savedIdx, content, file.name, analysis.tables[savedIdx])
            } else {
              // Показываем выбор таблицы
              setShowTableSelection(true)
              setIsFileLoading(false)
            }
          }
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'Ошибка анализа HTML файла', 'error')
          setIsFileLoading(false)
        }
      } else {
        const parsed = await parseBankStatementFile(file)
        const prepared = prepareParsedDataset(parsed)
        const dataset = prepared.rows

        if (dataset.length === 0) {
          showToast('Файл пуст', 'error')
          setIsFileLoading(false)
          return
        }

        const dataRows = prepared.hasHeader ? dataset.slice(1) : dataset
        if (dataRows.length === 0) {
          showToast('В файле найдены только заголовки без данных', 'warning')
          setIsFileLoading(false)
          return
        }

        if (dataRows[0].length > 1) {
          setPastedData(dataset)
          setHasHeaderRow(prepared.hasHeader)
          setIsEditingColumnMapping(false)
          setIsColumnMappingOpen(true)
          showToast(`Загружено ${dataRows.length} строк из файла`, 'success')
        } else {
          appendSingleColumnExpenses(dataset, prepared.hasHeader, 'файла')
          setHasHeaderRow(false)
        }
        setIsFileLoading(false)
      }
    } catch (error) {
      showToast('Ошибка при загрузке файла', 'error')
      setIsFileLoading(false)
    } finally {
      // Очищаем input для возможности повторной загрузки того же файла
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [showToast, processTableSelection, loadSavedTableIndex, appendSingleColumnExpenses])

  // Прямое сохранение без предпросмотра
  const handleDirectSave = useCallback(async () => {
    if (expenses.length === 0) {
      showToast('Добавьте хотя бы один расход', 'error')
      return
    }

    if (!validateExpenses()) {
      showToast('Исправьте ошибки в данных', 'error')
      return
    }

    setIsSubmitting(true)

    try {
      let batchId: string | undefined = undefined;
      if (fileName) {
          batchId = crypto.randomUUID();
          const fileType = fileName.split('.').pop()?.toLowerCase() || 'unknown';
          
          const statementResult = await createBankStatement({
              id: batchId,
              filename: fileName,
              file_type: fileType,
              total_records: expenses.length,
          });

          if (statementResult.error) {
              showToast(`Ошибка создания записи о выписке: ${statementResult.error}`, 'error');
              setIsSubmitting(false);
              return;
          }
      }

      // Преобразуем данные для отправки
      const expensesToCreate: CreateExpenseData[] = expenses.map(expense => ({
        amount: expense.amount,
        description: expense.description,
        notes: expense.notes,
        category_id: expense.category_id || undefined,
        expense_date: expense.expense_date,
        expense_time: expense.expense_time || null,
        city_id: expense.city_id || undefined,
        city_input: expense.city?.trim() || undefined,
        input_method: 'bulk_table' as const,
        batch_id: batchId
      }))

      const result = await createBulkExpenses(expensesToCreate)

      if (result.error) {
        showToast(result.error, 'error')
        return
      }

      if (result.success && result.stats) {
        const { success, failed, uncategorized, total } = result.stats

        let message = `Создано ${success} из ${total} расходов`
        if (failed > 0) {
          message += `, ${failed} с ошибками`
        }
        if (uncategorized > 0) {
          message += `, ${uncategorized} без категории`
        }

        showToast(message, success > 0 ? 'success' : 'error')

        // Очищаем форму при успехе
        if (success > 0) {
          setExpenses([])
          setFileName('')

          // Перенаправляем на страницу расходов только если включен автопереход
          if (autoRedirect) {
            router.push('/expenses')
          }
        }
      }
    } catch (error) {
      showToast('Произошла ошибка при сохранении', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }, [expenses, validateExpenses, showToast, router, autoRedirect, fileName])

  // Очистить все данные
  const handleClear = useCallback(() => {
    setExpenses([])
    setValidationErrors({})
    setSelectedTableMeta(null)
    setAvailableTables([])
    setFileContent(null)
    setFileName('')
  }, [])

  const handleRequestTableReplacement = useCallback(() => {
    if (!fileContent) {
      showToast('Не найдено данных из файла для смены таблицы.', 'warning');
      return;
    }
    setIsColumnMappingOpen(false);
    setShowTableSelection(true);
  }, [fileContent, showToast]);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex-1">
            Массовый ввод и банковские выписки
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            {/* Переключатель автоперехода */}
            <div
              className="flex items-center gap-2 cursor-pointer select-none"
              onClick={() => setAutoRedirect(!autoRedirect)}
            >
              <span className="text-sm text-gray-700">Автопереход</span>
              <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoRedirect ? 'bg-blue-600' : 'bg-gray-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoRedirect ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
            </div>

            <div className="h-6 w-px bg-gray-300"></div> {/* Разделитель */}
            <Button
              variant="outline"
              size="sm"
              onClick={addRow}
            >
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

            {isFileLoading && (
              <div
                className="flex items-center gap-2 text-sm text-blue-700 basis-full sm:basis-auto"
                aria-live="polite"
              >
                <span className="h-3 w-3 animate-spin rounded-full border border-blue-400 border-t-transparent" />
                <span>
                  {fileName ? `Обрабатываем «${fileName}»...` : 'Подготавливаем данные файла...'}
                </span>
              </div>
            )}

            {fileContent && availableTables.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTableSelection(true)}
                disabled={isFileLoading}
                className={isFileLoading ? 'cursor-wait opacity-80' : undefined}
              >
                📊 Выбрать таблицу
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Проверяем, есть ли сохраненная схема
                const savedMapping = loadSavedColumnMapping()

                if (savedMapping.length > 0) {
                  // Создаем только заголовки столбцов на основе сохраненной схемы
                  const sampleData = [
                    savedMapping.map((_item: ColumnMapping, index: number) => `Столбец ${String.fromCharCode(65 + index)}`)
                  ]
                  setPastedData(sampleData)
                } else {
                  // Создаем стандартные заголовки столбцов
                  const sampleData = [
                    ['Столбец A', 'Столбец B', 'Столбец C', 'Столбец D']
                  ]
                  setPastedData(sampleData)
                }
                setHasHeaderRow(false)
                setIsEditingColumnMapping(true)
                setIsColumnMappingOpen(true)
              }}
              title="Настроить порядок столбцов для вставки данных"
            >
              ⚙️ Настройка столбцов <span className={`ml-1 text-xs ${isMounted && (savedColumnMapping || savedTableIndex !== null) ? 'opacity-100' : 'opacity-0'}`}>●</span>
            </Button>

            {isMounted && savedTableIndex !== null && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearSavedTableIndex()
                  showToast('Сохраненный выбор таблицы очищен', 'info')
                }}
              >
                ♻️ Сбросить выбор таблицы
              </Button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="*/*"
              onChange={handleFileUpload}
              className="hidden"
            />

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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                >
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
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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



        {expenses.length === 0 ? (
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center"
            onPaste={handlePaste}
            tabIndex={0}
          >
            <div className="text-gray-500">
              <p className="text-lg mb-2">Нет данных для ввода</p>
              <p className="text-sm">
                Добавьте строку, загрузите файл или вставьте данные из буфера обмена
              </p>
            </div>
          </div>
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

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Как использовать:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Добавляйте строки кнопкой &quot;Добавить строку&quot;</li>
            <li>• Копируйте данные из Excel/Google Sheets и вставляйте (Ctrl+V)</li>
            <li>• Загружайте файлы любых форматов: CSV, HTML, XLSX, OFX и другие</li>
            <li>• Для HTML файлов (банковские выписки) система найдет все таблицы и предложит выбрать нужную</li>
            <li>• <strong>Выбор таблицы запоминается</strong> - при следующей загрузке будет использована та же таблица</li>
            <li>• Используйте &quot;Настройка столбцов&quot; для изменения порядка полей</li>
            <li>• Система автоматически определит категории по описанию</li>
          </ul>
        </div>
      </Card>

      {/* Модальное окно подтверждения автоизвлечения */}
      <Modal
        isOpen={Boolean(reviewModalState)}
        onClose={handleReviewCancel}
        title="Проверка автоматически выделенных полей"
        size="xl"
      >
        {reviewModalState && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                Система выделила дополнительные данные в {totalReviewCount}{' '}
                {totalReviewCount === 1 ? 'строке' : 'строках'}. Проверьте результаты и подтвердите, что всё выглядит корректно.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {reviewSummary.cityItems.length > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 text-blue-800 px-3 py-1 text-sm">
                  📍 Города из описания: {reviewSummary.cityItems.length}
                </span>
              )}
            </div>

            {reviewSummary.cityItems.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Города, извлечённые из описания</h4>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Строка</th>
                          <th className="px-3 py-2 text-left">Столбец</th>
                          <th className="px-3 py-2 text-left">Исходное значение</th>
                          <th className="px-3 py-2 text-left">Описание после очистки</th>
                          <th className="px-3 py-2 text-left">Автоопределённый город</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {cityPreview.map((item, index) => (
                          <tr key={`city-${index}-${item.rowIndex}`} className="bg-white">
                            <td className="px-3 py-2 align-top text-gray-500">{item.rowIndex}</td>
                            <td className="px-3 py-2 align-top text-gray-700">{item.columnLabel}</td>
                            <td className="px-3 py-2 align-top text-gray-900 whitespace-pre-wrap break-words">
                              {item.sourceValue || '—'}
                            </td>
                            <td className="px-3 py-2 align-top text-gray-900 whitespace-pre-wrap break-words">
                              {item.cleanedDescription || '—'}
                            </td>
                            <td className="px-3 py-2 align-top text-blue-700 font-semibold">
                              {item.extractedCity}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {cityOverflow > 0 && (
                    <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50">
                      и ещё {cityOverflow} {cityOverflow === 1 ? 'строка' : 'строк'} с автоопределением города
                    </div>
                  )}
                </div>
              </div>
            )}


            <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">
                Подтверждение применит назначенные столбцы и перенесёт данные в таблицу расходов.
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={handleReviewCancel}
                  disabled={isReviewProcessing}
                >
                  Вернуться
                </Button>
                <Button
                  variant="primary"
                  onClick={handleReviewConfirm}
                  disabled={isReviewProcessing}
                >
                  {reviewModalState.mode === 'directSave' && isReviewProcessing ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {reviewPrimaryLabel}
                    </span>
                  ) : (
                    reviewPrimaryLabel
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Модальное окно выбора таблицы */}
      <Modal
        isOpen={showTableSelection}
        onClose={() => {
          setShowTableSelection(false)
          setIsFileLoading(false)
          if (!selectedTableMeta) {
            setAvailableTables([])
            setFileContent(null)
            setFileName('')
          }
        }}
        title="Выбор таблицы"
        size="xl"
      >
        {availableTables.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Найдено {availableTables.length} таблиц. Выберите таблицу для импорта:
            </div>



            <div className="space-y-3 max-h-96 overflow-y-auto">
              {availableTables.map((table, index) => (
                <div
                  key={index}
                  className={`p-4 border rounded-lg transition-colors ${
                    (savedTableIndex !== null && savedTableIndex === index) || (savedTableIndex === null && index === 0)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  } ${isFileLoading ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}
                  tabIndex={isFileLoading ? -1 : 0}
                  aria-disabled={isFileLoading}
                  onClick={() => {
                    handleTableSelection(index)
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleTableSelection(index)
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {table.description}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {table.rowCount} строк, {table.columnCount} столбцов
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {table.hasHeaders ? 'Содержит строку заголовков' : 'Без отдельной строки заголовков'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {savedTableIndex === index && (
                        <div className="text-blue-600 text-sm font-medium">
                          ✓ Ранее
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviewTable(index);
                        }}
                      >
                        Предпросмотр
                      </Button>
                    </div>
                  </div>

                  {table.preview.length > 0 && (
                    <div className="mt-3 overflow-hidden rounded-md border bg-white">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-xs">
                          <tbody className="divide-y divide-gray-100">
                            {table.preview.map((previewRow, previewIndex) => (
                              <tr key={previewIndex} className="bg-white">
                                {previewRow.map((cell, cellIndex) => (
                                  <td
                                    key={cellIndex}
                                    className={`px-3 py-2 whitespace-nowrap ${
                                      previewIndex === 0 ? 'font-medium text-gray-900' : 'text-gray-600'
                                    }`}
                                  >
                                    {cell || '—'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowTableSelection(false)
                  setAvailableTables([])
                  setFileContent(null)
                  setFileName('')
                }}
              >
                Отмена
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Модальное окно предпросмотра таблицы */}
      <Modal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title={`Предпросмотр: ${previewedTable?.description || ''}`}
        size="xl"
      >
        {previewedTable && (
          <div className="max-h-[70vh] overflow-auto border border-gray-200 rounded-lg">
            <table className="min-w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-gray-100 z-10">
                {previewedTable.rows[0] && (
                  <tr>
                    {previewedTable.rows[0].map((cell, cellIndex) => (
                      <th key={cellIndex} className="border-b border-gray-300 p-2 text-left font-semibold text-gray-700">{cell}</th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {previewedTable.rows.slice(1).map((row, rowIndex) => (
                  <tr key={rowIndex} className="even:bg-gray-50">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="border-b border-gray-200 p-2">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Модальное окно настройки столбцов */}
      <ColumnMappingModal
        isOpen={isColumnMappingOpen}
        onClose={() => {
          setIsColumnMappingOpen(false)
          setPastedData([])
          setHasHeaderRow(false)
          setIsEditingColumnMapping(false)
        }}
        onApply={handleColumnMappingApply}
        onApplyAndSave={handleColumnMappingApplyAndSave}
        sampleData={pastedData}
        savedMapping={savedColumnMapping}
        isEditingMode={isEditingColumnMapping}
        tableDescription={selectedTableMeta?.description}
        onReplaceTable={handleRequestTableReplacement}
      />
    </div>
  )
}

const COLUMN_MAPPING_FIELDS: ColumnMappingField[] = [
  'amount',
  'description',
  'city',
  'expense_date',
  'expense_time',
  'notes'
]

const COLUMN_MAPPING_FIELD_SET = new Set<ColumnMappingField>(COLUMN_MAPPING_FIELDS)

function isColumnMappingField(value: unknown): value is ColumnMappingField {
  return typeof value === 'string' && COLUMN_MAPPING_FIELD_SET.has(value as ColumnMappingField)
}

function normalizeColumnMapping(raw: unknown): ColumnMapping[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.map((item, index) => {
    const candidate = item as Partial<ColumnMapping> & { targetField?: unknown }

    const directTargets = Array.isArray(candidate?.targetFields)
      ? candidate.targetFields.filter(isColumnMappingField)
      : []

    const legacyTarget = isColumnMappingField(candidate?.targetField)
      ? [candidate.targetField]
      : []

    const combinedTargets = [...directTargets, ...legacyTarget]
    const uniqueTargets = Array.from(new Set(combinedTargets))

    const normalizedTargets = uniqueTargets.filter(isColumnMappingField)

    const normalizedEnabled = typeof candidate?.enabled === 'boolean'
      ? candidate.enabled && normalizedTargets.length > 0
      : normalizedTargets.length > 0

    return {
      sourceIndex: typeof candidate?.sourceIndex === 'number' ? candidate.sourceIndex : index,
      targetFields: normalizedEnabled ? normalizedTargets : [],
      enabled: normalizedEnabled && normalizedTargets.length > 0,
      preview: typeof candidate?.preview === 'string' ? candidate.preview : '',
      hidden: Boolean(candidate?.hidden)
    }
  })
}

function sanitizeColumnMapping(mapping: ColumnMapping[]): ColumnMapping[] {
  return normalizeColumnMapping(mapping)
}
