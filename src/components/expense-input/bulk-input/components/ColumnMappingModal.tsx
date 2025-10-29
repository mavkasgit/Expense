'use client'

import { useState, useCallback, useMemo, useEffect, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { ColumnMapping, ColumnMappingField } from '@/types'
import { parseDateAndTime, parseTimeValue } from '@/lib/utils/bankStatementParsers'
import { extractCityFromDescription } from '@/lib/utils/cityParser'
import { loadAllFormatMappings, deleteColumnMapping, loadSkipFirstRow, saveSkipFirstRow } from '../utils/storage'
import { useToast } from '@/hooks/useToast'
import { TablePreviewModal } from './TablePreviewModal'
import { ExclusionSettings } from './ExclusionSettings'
import { DuplicateDetection } from './DuplicateDetection'

// Компонент подсказки
function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  return (
    <div className="relative group">
      {children}
      {/* Tooltip справа от элемента */}
      <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-4 py-3 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[10000] break-words shadow-lg" style={{ maxWidth: '400px', width: 'max-content', minWidth: '200px' }}>
        {content}
        {/* Стрелка слева */}
        <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
      </div>
    </div>
  )
}

// ColumnMapping импортирован из @/types

interface FieldAssignment {
  field: ColumnMappingField
  assignedColumn: number | null
  required: boolean
}

interface ColumnMappingModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (mapping: ColumnMapping[], exclusions?: string[], duplicateIndices?: Set<number>, skipFirstRow?: boolean) => void

  sampleData: string[][] // Первые несколько строк для предпросмотра
  savedMapping?: ColumnMapping[] | null // Сохраненная схема столбцов
  isEditingMode?: boolean // Режим редактирования сохраненной схемы
  tableDescription?: string | null
  onReplaceTable?: () => void
  currentFormat?: 'csv' | 'xlsx' | 'xls' | 'html' | 'clipboard' | 'unknown' | null
  onFormatChange?: (format: 'csv' | 'xlsx' | 'xls' | 'html' | 'clipboard' | 'unknown') => void
}

const FIELD_ICONS: Record<ColumnMappingField, string> = {
  amount: '💰',
  description: '📝',
  city: '📍',
  expense_date: '📅',
  expense_time: '⏰',
  notes: '📋'
}

const FIELD_LABELS: Record<ColumnMappingField, string> = {
  amount: 'Сумма',
  description: 'Описание',
  city: 'Город',
  expense_date: 'Дата',
  expense_time: 'Время',
  notes: 'Примечания'
}

const FIELD_COLORS: Record<ColumnMappingField, string> = {
  amount: 'bg-green-100 border-green-300 text-green-800',
  description: 'bg-blue-100 border-blue-300 text-blue-800',
  city: 'bg-indigo-100 border-indigo-300 text-indigo-800',
  expense_date: 'bg-purple-100 border-purple-300 text-purple-800',
  expense_time: 'bg-teal-100 border-teal-300 text-teal-800',
  notes: 'bg-yellow-100 border-yellow-300 text-yellow-800'
}

// Порядок полей в выпадающем списке
const FIELD_ORDER: ColumnMappingField[] = [
  'expense_date',
  'expense_time',
  'amount',
  'description',
  'city',
  'notes'
]

const COLUMN_FIELD_OPTIONS: Array<{ field: ColumnMappingField; label: string; icon: string }> =
  FIELD_ORDER.map(field => ({
    field,
    label: FIELD_LABELS[field],
    icon: FIELD_ICONS[field]
  }))

const COLUMN_FIELD_SET = new Set<ColumnMappingField>(COLUMN_FIELD_OPTIONS.map(option => option.field))

function isColumnMappingField(value: unknown): value is ColumnMappingField {
  return typeof value === 'string' && COLUMN_FIELD_SET.has(value as ColumnMappingField)
}

function createDefaultFieldAssignments(): FieldAssignment[] {
  return [
    { field: 'amount', assignedColumn: null, required: true },
    { field: 'description', assignedColumn: null, required: true },
    { field: 'city', assignedColumn: null, required: false },
    { field: 'expense_date', assignedColumn: null, required: false },
    { field: 'expense_time', assignedColumn: null, required: false },
    { field: 'notes', assignedColumn: null, required: false }
  ]
}

// Описания комбинаций полей для модального окна проверки
function getCombinationDescription(fields: ColumnMappingField[]): string | null {
  if (fields.length <= 1) return null

  const sortedFields = [...fields].sort()
  const key = sortedFields.join('+')

  const descriptions: Record<string, string> = {
    'expense_date+expense_time': '📅⏰ Ожидается формат: "01.01.2024 10:30" или раздельно в одной ячейке',
    'city+description': '📝📍 Город будет извлечён из текста, остальное останется в описании',
    'description+notes': '📝📋 Текст будет использован для обоих полей одновременно',
    'city+notes': '📍📋 Город будет извлечён, весь текст попадёт в примечания',
    'city+description+notes': '📍📝📋 Город извлекается, текст идёт в описание и примечания',
    'amount+description': '💰📝 Число для суммы, остальной текст в описание',
    'amount+city': '💰📍 Число для суммы, город будет извлечён из оставшегося текста',
    'amount+notes': '💰📋 Число для суммы, остальное в примечания',
    'city+expense_date': '📍📅 Город и дата из одной ячейки (дата в формате ДД.ММ.ГГГГ)',
    'city+expense_time': '📍⏰ Город и время из одной ячейки (время в формате ЧЧ:ММ)',
    'expense_date+notes': '📅📋 Дата и дополнительный текст в примечания',
    'expense_time+notes': '⏰📋 Время и дополнительный текст в примечания',
  }

  return descriptions[key] || `🔗 Комбинация: ${fields.map(f => FIELD_LABELS[f]).join(' + ')}`
}

// Функция разделения данных с кастомными настройками
function splitCellValue(
  cellValue: string,
  separator: string,
  customSeparator: string
): string[] {
  if (!cellValue) return []

  const actualSeparator = separator === 'custom' ? customSeparator : separator
  if (!actualSeparator) return [cellValue]

  return cellValue.split(actualSeparator).map(s => s.trim()).filter(s => s)
}

// Применение кастомного разделения к комбинации
function applyCustomSplit(
  cellValue: string,
  fields: ColumnMappingField[],
  separator: string,
  customSeparator: string,
  partMapping: Record<string, number>
): Record<string, string> {
  const parts = splitCellValue(cellValue, separator, customSeparator)
  const result: Record<string, string> = {}

  fields.forEach(field => {
    const partIndex = partMapping[field]
    if (partIndex !== undefined && parts[partIndex]) {
      result[field] = parts[partIndex]
    } else {
      result[field] = ''
    }
  })

  return result
}

export function ColumnMappingModal({
  isOpen,
  onClose,
  onApply,
  sampleData,
  savedMapping,
  isEditingMode = false,
  tableDescription,
  onReplaceTable,
  currentFormat,
  onFormatChange
}: ColumnMappingModalProps) {
  const { showToast } = useToast()

  // Состояние для предпросмотра таблицы
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  // Инициализируем порядок столбцов (только индексы)
  const [columnOrder, setColumnOrder] = useState<number[]>([])

  // Инициализируем назначения полей
  const [fieldAssignments, setFieldAssignments] = useState<FieldAssignment[]>([])
  const [openColumnPicker, setOpenColumnPicker] = useState<number | null>(null)
  const [hiddenColumns, setHiddenColumns] = useState<Set<number>>(() => new Set())
  const [isHiddernColumnsVisible, setIsHiddernColumnsVisible] = useState(false)
  const [pickerPosition, setPickerPosition] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
  const columnPickerRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const dropdownContainerRef = useRef<HTMLDivElement | null>(null)

  // Состояние для тестовой строки и проверки комбинации
  const [selectedTestRow, setSelectedTestRow] = useState(0)

  const [testRowStatusFilter, setTestRowStatusFilter] = useState('all');

  // Состояние для исключений
  const [exclusions, setExclusions] = useState<string[]>([])

  // Состояние для дубликатов
  const [duplicateIndices, setDuplicateIndices] = useState<Set<number>>(new Set())

  // Состояние для пропуска первой строки (заголовков)
  const [skipFirstRow, setSkipFirstRow] = useState(() => {
    // Сначала пытаемся загрузить сохраненное значение для текущего формата
    if (currentFormat) {
      const savedValue = loadSkipFirstRow(currentFormat);
      if (savedValue !== undefined) {
        return savedValue;
      }
    }

    // Если нет сохраненного значения, автоматически определяем по содержимому
    if (sampleData.length === 0) return false;

    const firstRow = sampleData[0];
    const headerKeywords = [
      'дата', 'date', 'время', 'time', 'сумма', 'amount', 'описание', 'description',
      'город', 'city', 'примечание', 'notes', 'категория', 'category',
      'операция', 'operation', 'тип', 'type', 'валюта', 'currency', 'счет', 'account'
    ];

    // Проверяем, содержит ли первая строка ключевые слова заголовков
    const hasHeaderKeywords = firstRow.some(cell => {
      const normalized = cell.toLowerCase().trim();
      return headerKeywords.some(keyword => normalized.includes(keyword));
    });

    return hasHeaderKeywords;
  })

  // Filter and select a random row when the status filter changes
  useEffect(() => {
    const filteredIndices = sampleData.map((_, index) => index).filter(index => {
      const isExcludedByWord = exclusions.some(e => sampleData[index].join(' ').toLowerCase().includes(e.toLowerCase()));
      const isDuplicate = duplicateIndices.has(index);
      const isSkipped = index === 0 && skipFirstRow;
      const isExcluded = isExcludedByWord || isSkipped;
      const isReady = !isExcluded && !isDuplicate;

      if (testRowStatusFilter === 'all') return true;
      if (testRowStatusFilter === 'ready') return isReady;
      if (testRowStatusFilter === 'excluded') return isExcluded;
      if (testRowStatusFilter === 'duplicate') return isDuplicate;
      return true;
    });

    if (filteredIndices.length > 0) {
      const randomIndex = filteredIndices[Math.floor(Math.random() * filteredIndices.length)];
      setSelectedTestRow(randomIndex);
    } else {
      // If no rows match the filter, you might want to reset to a default value or show a message
      setSelectedTestRow(0); // Or -1 to indicate no selection
    }
  }, [testRowStatusFilter, exclusions, duplicateIndices, skipFirstRow, sampleData]);

  // Calculate counts for each status
  const statusCounts = useMemo(() => {
    const counts = { all: sampleData.length, ready: 0, excluded: 0, duplicate: 0 };
    sampleData.forEach((row, index) => {
      const isExcludedByWord = exclusions.some(e => row.join(' ').toLowerCase().includes(e.toLowerCase()));
      const isDuplicate = duplicateIndices.has(index);
      const isSkipped = index === 0 && skipFirstRow;
      const isExcluded = isExcludedByWord || isSkipped;

      if (isExcluded) {
        counts.excluded++;
      } else if (isDuplicate) {
        counts.duplicate++;
      } else {
        counts.ready++;
      }
    });
    return counts;
  }, [sampleData, exclusions, duplicateIndices, skipFirstRow]);

  const [checkingColumn, setCheckingColumn] = useState<number | null>(null)
  const [checkedColumns, setCheckedColumns] = useState<Set<number>>(new Set())

  // Настройки разделения для комбинаций (для текущего проверяемого столбца)
  const [splitSettings, setSplitSettings] = useState<{
    separator: string
    customSeparator: string
    parts: Record<string, number> // field -> part index (0, 1, 2...)
  }>({
    separator: ' ',
    customSeparator: '',
    parts: {}
  })

  // Сохраненные настройки разделения для каждого столбца
  const [savedSplitSettings, setSavedSplitSettings] = useState<Record<number, {
    separator: string
    customSeparator: string
    parts: Record<string, number>
    example?: string
  }>>({})

  // Состояние для примера разделения
  const [exampleSource, setExampleSource] = useState<'data' | 'manual'>('data')
  const [exampleRowIndex, setExampleRowIndex] = useState(0)
  const [manualExample, setManualExample] = useState('')
  const manualExampleTextareaRef = useRef<HTMLInputElement>(null)

  // Для случайного выбора строк в проверке данных
  const [dataCheckRowIndices, setDataCheckRowIndices] = useState<number[]>([0, 1])
  const [showOnlyErrors, setShowOnlyErrors] = useState(false)

  // Состояния для сворачиваемых секций
  const [isDataSectionCollapsed, setIsDataSectionCollapsed] = useState(false)
  const [isTestSectionCollapsed, setIsTestSectionCollapsed] = useState(true)
  const [isHiddenSectionCollapsed, setIsHiddenSectionCollapsed] = useState(true)
  const [isExclusionSectionCollapsed, setIsExclusionSectionCollapsed] = useState(true)

  const [isDuplicateSectionCollapsed, setIsDuplicateSectionCollapsed] = useState(true)

  // Сохранение состояний секций в localStorage
  useEffect(() => {
    localStorage.setItem('columnMapping_dataSectionCollapsed', String(isDataSectionCollapsed))
  }, [isDataSectionCollapsed])

  useEffect(() => {
    localStorage.setItem('columnMapping_testSectionCollapsed', String(isTestSectionCollapsed))
  }, [isTestSectionCollapsed])

  useEffect(() => {
    localStorage.setItem('columnMapping_hiddenSectionCollapsed', String(isHiddenSectionCollapsed))
  }, [isHiddenSectionCollapsed])

  useEffect(() => {
    localStorage.setItem('columnMapping_exclusionSectionCollapsed', String(isExclusionSectionCollapsed))
  }, [isExclusionSectionCollapsed])

  useEffect(() => {
    localStorage.setItem('columnMapping_duplicateSectionCollapsed', String(isDuplicateSectionCollapsed))
  }, [isDuplicateSectionCollapsed])

  useEffect(() => {
    localStorage.setItem('columnMapping_hiddenColumnsVisible', String(isHiddernColumnsVisible))
  }, [isHiddernColumnsVisible])

  // Загрузка состояний из localStorage после монтирования
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hiddenColumnsVisible = localStorage.getItem('columnMapping_hiddenColumnsVisible');
      if (hiddenColumnsVisible !== null) {
        setIsHiddernColumnsVisible(hiddenColumnsVisible === 'true');
      }

      const dataSectionCollapsed = localStorage.getItem('columnMapping_dataSectionCollapsed');
      if (dataSectionCollapsed !== null) {
        setIsDataSectionCollapsed(dataSectionCollapsed === 'true');
      }

      const testSectionCollapsed = localStorage.getItem('columnMapping_testSectionCollapsed');
      if (testSectionCollapsed !== null) {
        setIsTestSectionCollapsed(testSectionCollapsed === 'true');
      }

      const hiddenSectionCollapsed = localStorage.getItem('columnMapping_hiddenSectionCollapsed');
      if (hiddenSectionCollapsed !== null) {
        setIsHiddenSectionCollapsed(hiddenSectionCollapsed === 'true');
      }

      const exclusionSectionCollapsed = localStorage.getItem('columnMapping_exclusionSectionCollapsed');
      if (exclusionSectionCollapsed !== null) {
        setIsExclusionSectionCollapsed(exclusionSectionCollapsed === 'true');
      }

      const duplicateSectionCollapsed = localStorage.getItem('columnMapping_duplicateSectionCollapsed');
      if (duplicateSectionCollapsed !== null) {
        setIsDuplicateSectionCollapsed(duplicateSectionCollapsed === 'true');
      }
    }
  }, []);

  // Обновление skipFirstRow при смене формата
  useEffect(() => {
    if (currentFormat) {
      const savedValue = loadSkipFirstRow(currentFormat);
      setSkipFirstRow(savedValue);
    }
  }, [currentFormat]);

  // Автофокус на textarea при переключении на ручной ввод
  useEffect(() => {
    if (exampleSource === 'manual' && manualExampleTextareaRef.current) {
      manualExampleTextareaRef.current.focus()
    }
  }, [exampleSource])

  // Обновляем состояние при изменении sampleData
  useEffect(() => {
    if (sampleData.length === 0) {
      setColumnOrder([])
      setFieldAssignments([])
      setHiddenColumns(new Set())
      return
    }

    const columnCount = Math.max(...sampleData.map(row => row.length))

    const defaultOrder = Array.from({ length: columnCount }, (_, index) => index)
    setColumnOrder(defaultOrder)

    const baseAssignments = createDefaultFieldAssignments()
    const nextHiddenColumns = new Set<number>()

    const nextSplitSettings: Record<number, {
      separator: string
      customSeparator: string
      parts: Record<string, number>
      example?: string
    }> = {}

    if (savedMapping && savedMapping.length > 0) {
      savedMapping.forEach((column) => {
        const columnIndex = column.sourceIndex
        // Проверяем что такой столбец существует в данных
        if (columnIndex >= columnCount) {
          return
        }

        // Восстанавливаем состояние скрытости столбца
        if (column?.hidden) {
          nextHiddenColumns.add(columnIndex)
        }

        // Восстанавливаем назначения полей (даже для скрытых столбцов)
        const targets = Array.isArray(column.targetFields)
          ? column.targetFields.filter(isColumnMappingField)
          : []

        targets.forEach(targetField => {
          const assignment = baseAssignments.find(item => item.field === targetField)
          if (assignment) {
            assignment.assignedColumn = columnIndex
          }
        })

        // Восстанавливаем настройки кастомного разделения
        if (column.customSplitSeparator && column.customSplitParts && Object.keys(column.customSplitParts).length > 0) {
          nextSplitSettings[columnIndex] = {
            separator: 'custom',
            customSeparator: column.customSplitSeparator,
            parts: column.customSplitParts,
            example: column.customSplitExample // Восстанавливаем пример строки
          }
        }
      })
    }

    setFieldAssignments(baseAssignments)
    setHiddenColumns(nextHiddenColumns)
    setSavedSplitSettings(nextSplitSettings)

    // Помечаем столбцы с сохраненными настройками разделения как проверенные
    const checkedCols = new Set<number>()
    Object.keys(nextSplitSettings).forEach(key => {
      const columnIndex = parseInt(key, 10)
      if (!isNaN(columnIndex)) {
        checkedCols.add(columnIndex)
      }
    })
    setCheckedColumns(checkedCols)
  }, [sampleData, savedMapping])

  useEffect(() => {
    if (!isOpen) {
      setOpenColumnPicker(null)
    }
  }, [isOpen])

  useEffect(() => {
    setOpenColumnPicker(null)
  }, [columnOrder])

  useEffect(() => {
    if (openColumnPicker !== null && hiddenColumns.has(openColumnPicker)) {
      setOpenColumnPicker(null)
    }
  }, [hiddenColumns, openColumnPicker])

  const updatePickerPosition = useCallback(() => {
    if (openColumnPicker === null) {
      setPickerPosition(null)
      return
    }

    const anchor = columnPickerRefs.current[openColumnPicker]
    if (!anchor) {
      setPickerPosition(null)
      return
    }

    const rect = anchor.getBoundingClientRect()
    const viewportWidth = typeof window !== 'undefined'
      ? window.innerWidth || document.documentElement.clientWidth || rect.width
      : rect.width
    const dropdownWidth = Math.max(rect.width, 240)
    const maxLeft = Math.max(viewportWidth - dropdownWidth - 8, 8)
    const left = Math.min(Math.max(rect.left, 8), maxLeft)

    setPickerPosition({
      top: Math.max(rect.bottom + 4, 8),
      left,
      width: dropdownWidth
    })
  }, [openColumnPicker])

  useLayoutEffect(() => {
    if (openColumnPicker === null) {
      setPickerPosition(null)
      return
    }

    updatePickerPosition()

    const handleScroll = () => updatePickerPosition()
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [openColumnPicker, updatePickerPosition])

  useEffect(() => {
    if (openColumnPicker === null) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      const container = columnPickerRefs.current[openColumnPicker]
      const dropdown = dropdownContainerRef.current
      const target = event.target as Node
      if (container && container.contains(target)) {
        return
      }
      if (dropdown && dropdown.contains(target)) {
        return
      }
      if (container && !container.contains(target)) {
        setOpenColumnPicker(null)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenColumnPicker(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [openColumnPicker])

  // Назначение поля на столбец с предотвращением дублирования
  const toggleFieldForColumn = useCallback((field: ColumnMappingField, columnIndex: number) => {
    setFieldAssignments(prev =>
      prev.map(assignment => {
        if (assignment.field !== field) {
          return assignment
        }

        if (assignment.assignedColumn === columnIndex) {
          return { ...assignment, assignedColumn: null }
        }

        return { ...assignment, assignedColumn: columnIndex }
      })
    )
  }, [])

  const toggleColumnHidden = useCallback((columnIndex: number) => {
    setHiddenColumns(prev => {
      const next = new Set(prev)
      if (next.has(columnIndex)) {
        next.delete(columnIndex)
      } else {
        next.add(columnIndex)
      }
      return next
    })

    setFieldAssignments(prev =>
      prev.map(assignment =>
        assignment.assignedColumn === columnIndex
          ? { ...assignment, assignedColumn: null }
          : assignment
      )
    )

    setOpenColumnPicker(null)
  }, [])

  const getAssignedFields = useCallback(
    (columnIndex: number): ColumnMappingField[] =>
      fieldAssignments.filter(assignment => assignment.assignedColumn === columnIndex).map(assignment => assignment.field),
    [fieldAssignments]
  )

  const visibleColumnOrder = useMemo(
    () => columnOrder.filter(index => !hiddenColumns.has(index)),
    [columnOrder, hiddenColumns]
  )

  const hiddenColumnOrder = useMemo(
    () => columnOrder.filter(index => hiddenColumns.has(index)),
    [columnOrder, hiddenColumns]
  )

  const getColumnDisplayLabel = useCallback(
    (originalIndex: number) => {
      const displayIndex = columnOrder.indexOf(originalIndex)
      if (displayIndex === -1) {
        return `Столбец ${originalIndex + 1}`
      }

      if (displayIndex >= 0 && displayIndex < 26) {
        return `Столбец ${String.fromCharCode(65 + displayIndex)}`
      }

      return `Столбец ${displayIndex + 1}`
    },
    [columnOrder]
  )

  // Создание маппинга из текущих настроек
  const createMapping = useCallback(() => {
    const mapping: ColumnMapping[] = columnOrder.map((originalIndex) => {
      const baseMapping: ColumnMapping = {
        sourceIndex: originalIndex, // Сохраняем реальный индекс столбца
        targetFields: [],
        enabled: false,
        preview: sampleData[0]?.[originalIndex] || '',
        hidden: hiddenColumns.has(originalIndex)
      }

      // Добавляем кастомные настройки разделения если они есть
      const splitSettings = savedSplitSettings[originalIndex]
      if (splitSettings && Object.keys(splitSettings.parts).length > 0) {
        const separator = splitSettings.separator === 'custom' ? splitSettings.customSeparator : splitSettings.separator
        baseMapping.customSplitSeparator = separator
        baseMapping.customSplitParts = splitSettings.parts
        // Сохраняем пример строки из настроек (была выбрана/введена в окне проверки)
        if (splitSettings.example) {
          baseMapping.customSplitExample = splitSettings.example
        }
      }

      return baseMapping
    })

    // Назначаем поля
    fieldAssignments.forEach(assignment => {
      if (assignment.assignedColumn !== null && !hiddenColumns.has(assignment.assignedColumn)) {
        const mappingItem = mapping.find(m => m.sourceIndex === assignment.assignedColumn)
        if (mappingItem) {
          if (!mappingItem.targetFields.includes(assignment.field)) {
            mappingItem.targetFields.push(assignment.field)
          }
          mappingItem.enabled = true
        }
      }
    })

    return mapping
  }, [columnOrder, fieldAssignments, sampleData, hiddenColumns, savedSplitSettings])

  // Применение настроек для редактирования
  const handleApply = useCallback(() => {
    // Убрали проверку обязательных полей - импортируем все данные
    // Валидация будет происходить только перед сохранением
    const mapping = createMapping()

    // Сохраняем настройку skipFirstRow для текущего формата
    if (currentFormat) {
      saveSkipFirstRow(skipFirstRow, currentFormat)
    }

    onApply(mapping, exclusions, duplicateIndices, skipFirstRow)
    onClose()
  }, [createMapping, onApply, onClose, exclusions, duplicateIndices, skipFirstRow, currentFormat])

  // Применение и прямое сохранение
  const handleApplyAndSave = useCallback(() => {
    // Убрали проверку обязательных полей - импортируем все данные
    // Валидация будет происходить только перед сохранением
    const mapping = createMapping()

    // Сохраняем настройку skipFirstRow для текущего формата
    if (currentFormat) {
      saveSkipFirstRow(skipFirstRow, currentFormat)
    }

    onApply(mapping, exclusions, duplicateIndices, skipFirstRow)
    onClose()
  }, [createMapping, onApply, onClose, exclusions, duplicateIndices, skipFirstRow, currentFormat])

  // Вычисляем предпросмотр данных в реальном времени с реальным парсингом
  const previewData = useMemo(() => {
    if (sampleData.length === 0) return []

    const amountField = fieldAssignments.find(f => f.field === 'amount')
    const descriptionField = fieldAssignments.find(f => f.field === 'description')
    const cityField = fieldAssignments.find(f => f.field === 'city')
    const dateField = fieldAssignments.find(f => f.field === 'expense_date')
    const timeField = fieldAssignments.find(f => f.field === 'expense_time')
    const notesField = fieldAssignments.find(f => f.field === 'notes')

    // Убрали проверку обязательных полей - показываем предпросмотр для всех данных

    // Обрабатываем каждую строку с реальным парсингом
    return sampleData.map(row => {
      const result: Record<string, string> = {
        amount: '',
        description: '',
        city: '',
        expense_date: '',
        expense_time: '',
        notes: ''
      }

      // Получаем сырые значения из столбцов
      const amountRaw = amountField?.assignedColumn !== null && amountField?.assignedColumn !== undefined
        ? row[amountField.assignedColumn]?.trim() || '' : ''
      const descriptionRaw = descriptionField?.assignedColumn !== null && descriptionField?.assignedColumn !== undefined
        ? row[descriptionField.assignedColumn]?.trim() || '' : ''
      const cityRaw = cityField?.assignedColumn !== null && cityField?.assignedColumn !== undefined
        ? row[cityField.assignedColumn]?.trim() || '' : ''
      const dateRaw = dateField?.assignedColumn !== null && dateField?.assignedColumn !== undefined
        ? row[dateField.assignedColumn]?.trim() || '' : ''
      const timeRaw = timeField?.assignedColumn !== null && timeField?.assignedColumn !== undefined
        ? row[timeField.assignedColumn]?.trim() || '' : ''
      const notesRaw = notesField?.assignedColumn !== null && notesField?.assignedColumn !== undefined
        ? row[notesField.assignedColumn]?.trim() || '' : ''

      // Простые поля
      result.amount = amountRaw
      result.notes = notesRaw

      // Парсинг даты и времени (может быть в одном столбце)
      if (dateRaw) {
        const dateTimeResult = parseDateAndTime(dateRaw)
        result.expense_date = dateTimeResult.date || dateRaw
        if (dateTimeResult.time && !timeRaw) {
          result.expense_time = dateTimeResult.time
        }
      }

      // Парсинг времени отдельно, если есть
      if (timeRaw && !result.expense_time) {
        const parsedTime = parseTimeValue(timeRaw)
        result.expense_time = parsedTime || timeRaw
      }

      // Парсинг города из описания
      let cleanDescription = descriptionRaw
      if (descriptionRaw && !cityRaw) {
        const cityParseResult = extractCityFromDescription(descriptionRaw)
        if (cityParseResult.confidence > 0.6 && cityParseResult.displayCity) {
          result.city = cityParseResult.displayCity
          cleanDescription = cityParseResult.cleanDescription
        }
      } else if (cityRaw) {
        result.city = cityRaw
      }

      result.description = cleanDescription

      return result
    })
  }, [sampleData, fieldAssignments])

  // Удаление сохраненных настроек для текущего формата
  const handleDeleteSettings = useCallback(() => {
    if (!currentFormat) {
      showToast('Не удалось определить формат данных', 'error')
      return
    }

    const formatLabels: Record<string, string> = {
      csv: 'CSV',
      xlsx: 'Excel (XLSX)',
      xls: 'Excel (XLS)',
      html: 'HTML',
      clipboard: 'Буфер обмена',
      unknown: 'Неизвестный формат'
    }

    deleteColumnMapping(currentFormat)
    showToast(`Настройки для формата "${formatLabels[currentFormat]}" удалены`, 'success')
    onClose()
  }, [currentFormat, showToast, onClose])

  // Получаем список всех сохраненных форматов
  const availableFormats = useMemo(() => {
    const allMappings = loadAllFormatMappings();
    return Object.keys(allMappings) as Array<'csv' | 'xlsx' | 'xls' | 'html' | 'clipboard' | 'unknown'>;
  }, []);

  const formatLabels: Record<string, string> = {
    csv: 'CSV',
    xlsx: 'Excel (XLSX)',
    xls: 'Excel (XLS)',
    html: 'HTML',
    clipboard: 'Буфер обмена',
    unknown: 'Неизвестный формат'
  };

  const formatIcons: Record<string, string> = {
    csv: '📄',
    xlsx: '📊',
    xls: '📊',
    html: '🌐',
    clipboard: '📋',
    unknown: '❓'
  };

  if (sampleData.length === 0) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Настройка столбцов"
        size="lg"
      >
        <div className="text-center py-8">
          <div className="text-gray-500">
            <p className="text-lg mb-2">Нет данных для настройки</p>
            <p className="text-sm">Сначала вставьте или загрузите данные</p>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          isEditingMode
            ? "Редактирование сохраненной схемы столбцов"
            : savedMapping && savedMapping.length === columnOrder.length
              ? "Настройка столбцов (применена сохраненная схема)"
              : "Настройка столбцов"
        }
        size="lg"
      >
        <div className="space-y-6">
          {/* Индикатор формата данных */}
          {currentFormat && onFormatChange && (
            <div className="flex items-center justify-between p-2 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg min-h-[44px]">
              <div className="flex items-center gap-3 w-full">
                <div className="flex items-center gap-2 min-w-[140px]">
                  <span className="text-base">{formatIcons[currentFormat]}</span>
                  <span className="text-xs text-gray-700 min-w-[110px]">
                    <span className="font-medium text-indigo-700">{formatLabels[currentFormat]}</span>
                  </span>
                </div>
                {availableFormats.length > 0 && (
                  <div className="flex items-center gap-1 pl-3 border-l border-indigo-300 flex-1">
                    <span className="text-[10px] text-gray-600 whitespace-nowrap">Сохранено:</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {availableFormats.map(format => (
                        <span
                          key={format}
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded whitespace-nowrap ${format === currentFormat
                            ? 'bg-indigo-600 text-white font-medium'
                            : 'bg-indigo-100 text-indigo-700 cursor-pointer hover:bg-indigo-200'
                            }`}
                          onClick={() => format !== currentFormat && onFormatChange(format)}
                          title={format === currentFormat ? 'Текущий' : `Переключиться на ${formatLabels[format]}`}
                        >
                          <span>{formatIcons[format]}</span>
                          <span>{formatLabels[format]}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Таблица с данными и кликабельными заголовками */}
          <div className="mb-8">
            <div
              className="flex items-center justify-between gap-4 mb-2 cursor-pointer hover:bg-blue-100 p-3 rounded-lg bg-blue-50 border border-blue-200"
              onClick={() => setIsDataSectionCollapsed(!isDataSectionCollapsed)}
            >
              <div className="flex items-center gap-2">
                <span className="text-blue-500 text-lg transition-transform" style={{ transform: isDataSectionCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                  ▼
                </span>
                <span className="text-lg" aria-hidden>📊</span>
                <h3 className="font-medium text-blue-900">Ваши данные</h3>
                <Tooltip content="Кликните на заголовок столбца чтобы назначить ему поле">
                  <div className="w-4 h-4 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs cursor-help">
                    ?
                  </div>
                </Tooltip>
              </div>
              {tableDescription && onReplaceTable && !isEditingMode && (
                <div className="flex items-center gap-2 text-sm">
                  <span>📝</span>
                  <span className="font-semibold text-gray-700" title={tableDescription}>
                    {tableDescription}
                  </span>
                  <Button variant="primary" size="sm" onClick={onReplaceTable}>
                    Заменить
                  </Button>
                </div>
              )}
            </div>

            {!isDataSectionCollapsed && (<>
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="text-xs text-gray-500">
                  Можно выбрать несколько полей для одного столбца — например, одновременно отметить дату и время или описание и город.
                </p>
              </div>

              <div className="bg-white border rounded-lg overflow-hidden mb-4">
                {visibleColumnOrder.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="text-sm" style={{ width: 'auto', minWidth: '100%' }}>
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          {visibleColumnOrder.map(originalIndex => {
                            const assignedFields = getAssignedFields(originalIndex)
                            const columnLabel = getColumnDisplayLabel(originalIndex)
                            const isOpen = openColumnPicker === originalIndex

                            return (
                              <th key={originalIndex} className="p-2 align-top" style={{ minWidth: '180px', width: '180px' }}>
                                <div
                                  className="flex flex-col items-center gap-2"
                                  ref={node => {
                                    if (node) {
                                      columnPickerRefs.current[originalIndex] = node
                                    } else {
                                      delete columnPickerRefs.current[originalIndex]
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    <span>{columnLabel}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleColumnHidden(originalIndex)
                                      }}
                                      className="relative group"
                                      title="Скрыть столбец"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                      </svg>
                                    </button>
                                  </div>
                                  <div className="w-full max-w-[240px]">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenColumnPicker(prev =>
                                          prev === originalIndex ? null : originalIndex
                                        )
                                      }
                                      aria-expanded={isOpen}
                                      className={`flex w-full h-[32px] items-center justify-between rounded-md border px-3 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${assignedFields.length > 0
                                        ? 'border-gray-300 bg-white text-gray-700 hover:border-blue-300 hover:text-blue-700'
                                        : 'border-dashed border-gray-300 bg-white text-gray-400 hover:border-blue-300 hover:text-blue-600'
                                        }`}
                                    >
                                      <span>
                                        {assignedFields.length > 0
                                          ? 'Изменить выбор'
                                          : 'Выбрать поля'}
                                      </span>
                                      <span
                                        className={`ml-2 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''
                                          }`}
                                        aria-hidden
                                      >
                                        ▾
                                      </span>
                                    </button>
                                  </div>
                                  {isOpen && pickerPosition && typeof window !== 'undefined'
                                    ? createPortal(
                                      (
                                        <div
                                          ref={node => {
                                            dropdownContainerRef.current = node
                                          }}
                                          className="z-[2000] rounded-md border border-gray-200 bg-white shadow-xl"
                                          style={{
                                            position: 'fixed',
                                            top: pickerPosition.top,
                                            left: pickerPosition.left,
                                            width: pickerPosition.width
                                          }}
                                        >
                                          <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
                                            {COLUMN_FIELD_OPTIONS.filter(option => {
                                              // Скрываем уже выбранные для этого столбца поля
                                              if (assignedFields.includes(option.field)) {
                                                return false;
                                              }
                                              // Скрываем поля, назначенные другим столбцам
                                              const fieldMeta = fieldAssignments.find(item => item.field === option.field)
                                              const assignedColumnIndex = fieldMeta?.assignedColumn
                                              const isAssignedElsewhere =
                                                typeof assignedColumnIndex === 'number' &&
                                                assignedColumnIndex !== originalIndex
                                              return !isAssignedElsewhere;
                                            }).map(option => {
                                              const fieldMeta = fieldAssignments.find(item => item.field === option.field)
                                              const isChecked = assignedFields.includes(option.field)
                                              const isRequired = Boolean(fieldMeta?.required) && fieldMeta?.assignedColumn === null

                                              return (
                                                <button
                                                  key={option.field}
                                                  type="button"
                                                  onClick={() => toggleFieldForColumn(option.field, originalIndex)}
                                                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs hover:bg-blue-50 text-gray-700 hover:text-blue-700 transition-colors w-full text-left"
                                                >
                                                  <span aria-hidden>{option.icon}</span>
                                                  <span>{option.label}</span>
                                                </button>
                                              )
                                            })}
                                            {COLUMN_FIELD_OPTIONS.filter(option => {
                                              if (assignedFields.includes(option.field)) {
                                                return false;
                                              }
                                              const fieldMeta = fieldAssignments.find(item => item.field === option.field)
                                              const assignedColumnIndex = fieldMeta?.assignedColumn
                                              const isAssignedElsewhere =
                                                typeof assignedColumnIndex === 'number' &&
                                                assignedColumnIndex !== originalIndex
                                              return !isAssignedElsewhere;
                                            }).length === 0 && (
                                                <div className="px-3 py-2 text-xs text-gray-500 text-center">
                                                  Все доступные поля выбраны
                                                </div>
                                              )}
                                          </div>
                                        </div>
                                      ),
                                      document.body
                                    )
                                    : null}
                                  <div className="flex min-h-[36px] flex-col items-center gap-2 justify-center">
                                    {assignedFields.length > 1 && (
                                      <div className="flex items-center gap-1">
                                        <div className="relative">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setOpenColumnPicker(null)
                                              // Загружаем сохраненные настройки если они есть
                                              const saved = savedSplitSettings[originalIndex]
                                              if (saved) {
                                                setSplitSettings({ ...saved })
                                              } else {
                                                setSplitSettings({ separator: ' ', customSeparator: '', parts: {} })
                                              }
                                              setCheckingColumn(originalIndex)
                                            }}
                                            className={`rounded bg-orange-100 px-2 py-1 text-[11px] font-medium text-orange-700 hover:bg-orange-200 transition-all hover:scale-105 h-[26px] flex items-center ${!checkedColumns.has(originalIndex) && !savedSplitSettings[originalIndex] ? 'ring-2 ring-orange-400 ring-offset-1 animate-[pulse_3s_ease-in-out_infinite]' : ''
                                              }`}
                                          >
                                            🔍 Проверить
                                          </button>
                                          {!checkedColumns.has(originalIndex) && !savedSplitSettings[originalIndex] && (
                                            <span className="absolute -top-2 -right-2 flex h-3 w-3">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                              <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                                            </span>
                                          )}
                                        </div>
                                        {checkedColumns.has(originalIndex) && (
                                          <span className="text-green-600 text-sm" title="Проверено">✓</span>
                                        )}
                                      </div>
                                    )}
                                    <div className="flex flex-col items-center gap-1 min-h-[60px] justify-center">
                                      {assignedFields.length > 0 ? (
                                        <>
                                          {assignedFields.length > 1 && (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-2 py-0.5 text-[11px] text-orange-700">
                                              🔗
                                            </span>
                                          )}
                                          {assignedFields.map(field => (
                                            <span
                                              key={field}
                                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${FIELD_COLORS[field]} group`}
                                            >
                                              <span aria-hidden>{FIELD_ICONS[field]}</span>
                                              <span>{FIELD_LABELS[field]}</span>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  toggleFieldForColumn(field, originalIndex)
                                                }}
                                                className="ml-1 flex items-center justify-center h-3.5 w-3.5 rounded-full hover:bg-black/10 transition-colors"
                                                title="Удалить"
                                              >
                                                <span className="text-xs leading-none">✕</span>
                                              </button>
                                            </span>
                                          ))}
                                        </>
                                      ) : (
                                        <span className="text-xs text-gray-400">Поля не выбраны</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {sampleData.slice(0, 5).map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-b hover:bg-gray-50">
                            {visibleColumnOrder.map(originalIndex => (
                              <td key={originalIndex} className="px-4 py-3 text-gray-900 whitespace-nowrap" style={{ minWidth: '180px', width: '180px', maxWidth: '180px' }}>
                                <div className="overflow-hidden text-ellipsis">
                                  {row[originalIndex] || '—'}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-6 py-8 text-center text-sm text-gray-500">
                    Все столбцы скрыты. Раскройте хотя бы один, чтобы продолжить настройку.
                  </div>
                )}
                {sampleData.length > 5 && visibleColumnOrder.length > 0 && (
                  <div className="px-4 py-2 bg-gray-50 border-t">
                    <button
                      type="button"
                      onClick={() => setIsPreviewOpen(true)}
                      className="w-full text-sm text-indigo-600 hover:text-indigo-800 font-medium hover:underline transition-colors"
                    >
                      📊 Показать все записи ({sampleData.length} строк)
                    </button>
                  </div>
                )}
              </div>
            </>)}

            {!isDataSectionCollapsed && hiddenColumnOrder.length > 0 && (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setIsHiddernColumnsVisible(!isHiddernColumnsVisible)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-gray-400 text-lg transition-transform"
                      style={{ transform: isHiddernColumnsVisible ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                    >
                      ▾
                    </span>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Скрытые столбцы ({hiddenColumnOrder.length})
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] text-gray-500 hidden sm:block">
                      Мы запомним их позиции и автоматически спрячем при следующем импорте.
                    </p>
                  </div>
                </div>
                {isHiddernColumnsVisible && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {hiddenColumnOrder.map(originalIndex => {
                      const columnLabel = getColumnDisplayLabel(originalIndex)
                      const sampleValue = sampleData[0]?.[originalIndex] || ''
                      return (
                        <div
                          key={originalIndex}
                          className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 shadow-sm"
                        >
                          <div className="text-xs font-medium text-gray-700">{columnLabel}</div>
                          {sampleValue && (
                            <div
                              className="max-w-[140px] truncate text-[11px] text-gray-400"
                              title={sampleValue}
                            >
                              {sampleValue}
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleColumnHidden(originalIndex)}
                          >
                            Показать
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Секция исключающих слов */}
          <ExclusionSettings
            sampleData={sampleData}
            onExclusionsChange={setExclusions}
            isCollapsed={isExclusionSectionCollapsed}
            onToggleCollapsed={() => setIsExclusionSectionCollapsed(!isExclusionSectionCollapsed)}
            skipFirstRow={skipFirstRow}
            onSkipFirstRowChange={setSkipFirstRow}
          />

          {/* Секция поиска дубликатов */}
          {previewData.length > 1 && (
            <DuplicateDetection
              expenses={previewData.slice(1).map((preview, index) => ({
                amount: parseFloat((preview.amount || '0').replace(',', '.')) || 0,
                description: preview.description || '',
                expense_date: preview.expense_date || new Date().toISOString().split('T')[0],
                city: preview.city || null,
                expense_time: preview.expense_time || null,
                notes: preview.notes || '',
                category_id: '',
                city_id: null,
                tempId: `temp-${index + 1}`
              }))}
              onDuplicatesFound={setDuplicateIndices}
              isCollapsed={isDuplicateSectionCollapsed}
              onToggleCollapsed={() => setIsDuplicateSectionCollapsed(!isDuplicateSectionCollapsed)}
            />
          )}

          {/* Тестовая строка - детальный разбор */}
          {previewData.length > 0 && (
            <div className="mb-6">
              <div
                className={`flex items-center justify-between gap-4 cursor-pointer hover:bg-amber-100 p-3 ${isTestSectionCollapsed
                  ? 'rounded-lg bg-amber-50 border border-amber-200 mb-2'
                  : 'rounded-t-lg bg-amber-50 border border-amber-200 border-b-0'
                  }`}
                onClick={() => setIsTestSectionCollapsed(!isTestSectionCollapsed)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-amber-500 text-lg transition-transform" style={{ transform: isTestSectionCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                    ▼
                  </span>
                  <span className="text-lg" aria-hidden>🔬</span>
                  <h3 className="font-medium text-amber-900">Тестовая строка (детальный разбор)</h3>
                  <Tooltip content="Проверьте как система распознает данные из выбранной строки.">
                    <div className="w-4 h-4 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs cursor-help">
                      ?
                    </div>
                  </Tooltip>
                </div>
                {!isTestSectionCollapsed && (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <label htmlFor="test-row-status-filter" className="text-xs text-amber-700">Статус:</label>
                    <select
                      id="test-row-status-filter"
                      value={testRowStatusFilter}
                      onChange={(e) => setTestRowStatusFilter(e.target.value)}
                      className="rounded border border-amber-300 bg-white px-2 py-1 text-xs text-amber-700"
                    >
                      <option value="all">🌐 Все ({statusCounts.all})</option>
                      <option value="ready">✅ Готовые ({statusCounts.ready})</option>
                      <option value="excluded">🚫 Исключенные ({statusCounts.excluded})</option>
                      <option value="duplicate">🔍 Дубликаты ({statusCounts.duplicate})</option>
                    </select>
                    <label htmlFor="test-row-input" className="text-xs text-amber-700">Строка:</label>
                    <input
                      type="number"
                      id="test-row-input"
                      value={selectedTestRow + 1}
                      onChange={(e) => {
                        const value = Number(e.target.value) - 1;
                        if (value >= 0 && value < sampleData.length) {
                          setSelectedTestRow(value);
                        }
                      }}
                      className="rounded border border-amber-300 bg-white px-2 py-1 text-xs text-amber-700 w-16"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedTestRow(Math.floor(Math.random() * sampleData.length))}
                      className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
                      title="Выбрать случайную строку"
                    >
                      🎲
                    </button>
                  </div>
                )}
              </div>
              {!isTestSectionCollapsed && (
                <div className="space-y-2 p-4 bg-amber-50 border border-amber-200 rounded-lg border-t-0 rounded-t-none">
                  <div className="rounded-md bg-white border border-amber-200 p-3 text-xs">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-700">Статус строки:</span>
                            {(() => {
                                const isExcludedByWord = exclusions.some(e => sampleData[selectedTestRow].join(' ').toLowerCase().includes(e.toLowerCase()));
                                const isDuplicate = duplicateIndices.has(selectedTestRow);
                                const isSkipped = selectedTestRow === 0 && skipFirstRow;

                                if (isSkipped) {
                                return <span className="font-medium text-red-600">🚫 Исключено (первая строка)</span>;
                                } else if (isExcludedByWord) {
                                return <span className="font-medium text-red-600">🚫 Исключено по слову</span>;
                                } else if (isDuplicate) {
                                return <span className="font-medium text-orange-600">🔍 Найден дубликат</span>;
                                } else {
                                return <span className="font-medium text-green-600">✅ Готово к импорту</span>;
                                }
                            })()}
                        </div>
                    </div>
                  </div>
                  {visibleColumnOrder.map((originalIndex, idx) => {
                    const assignedFields = getAssignedFields(originalIndex)
                    if (assignedFields.length === 0) return null

                    const columnLabel = getColumnDisplayLabel(originalIndex)
                    const rawValue = sampleData[selectedTestRow]?.[originalIndex] || ''

                    // Проверяем есть ли сохраненные настройки разделения для этого столбца
                    const columnSplitSettings = savedSplitSettings[originalIndex]
                    let preview: Record<string, string> = {}

                    if (columnSplitSettings && Object.keys(columnSplitSettings.parts).length > 0) {
                      // Применяем кастомное разделение
                      preview = applyCustomSplit(
                        rawValue,
                        assignedFields,
                        columnSplitSettings.separator,
                        columnSplitSettings.customSeparator,
                        columnSplitSettings.parts
                      )
                    } else {
                      // Используем стандартный парсинг
                      preview = previewData[selectedTestRow] || {}
                    }

                    return (
                      <div key={originalIndex} className="rounded-md bg-white border border-amber-200 p-3 text-xs">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-gray-700">{columnLabel}</span>
                          <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-gray-600">
                            &ldquo;{rawValue}&rdquo;
                          </span>
                        </div>
                        <div className="space-y-1 pl-4">
                          {assignedFields.map(field => {
                            const parsedValue = preview?.[field] || ''
                            const hasValue = Boolean(parsedValue)
                            const statusIcon = hasValue ? '✅' : '⚠️'
                            const statusColor = hasValue ? 'text-green-600' : 'text-amber-600'

                            return (
                              <div key={field} className="flex items-center gap-2">
                                <span aria-hidden>{statusIcon}</span>
                                <span className="text-gray-600">{FIELD_ICONS[field]} {FIELD_LABELS[field]}:</span>
                                <span className={`font-medium ${statusColor}`}>
                                  {parsedValue || '(не распознано)'}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Итоговая статистика импорта */}
          {previewData.length > 0 && (
            <div className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl" aria-hidden>📊</span>
                <h3 className="text-lg font-semibold text-indigo-900">Итоговая статистика импорта</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-3 border border-indigo-100">
                  <div className="text-xs text-gray-600 mb-1">Всего строк</div>
                  <div className="text-2xl font-bold text-gray-900">{sampleData.length}</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-red-100">
                  <div className="text-xs text-gray-600 mb-1">🚫 Исключено</div>
                  <div className="text-2xl font-bold text-red-600">
                    {sampleData.filter((row, index) => {
                      if (index === 0 && skipFirstRow) return true;
                      const fullRowText = row.join(' ').toLowerCase();
                      return exclusions.some(exclusion =>
                        exclusion.trim() && fullRowText.includes(exclusion.toLowerCase())
                      );
                    }).length}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-orange-100">
                  <div className="text-xs text-gray-600 mb-1">🔍 Найдено дубликатов</div>
                  <div className="text-2xl font-bold text-orange-600">{duplicateIndices.size}</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <div className="text-xs text-gray-600 mb-1">✅ Будет импортировано</div>
                  <div className="text-2xl font-bold text-green-600">
                    {sampleData.length - sampleData.filter((row, index) => {
                      if (index === 0 && skipFirstRow) return true;
                      const fullRowText = row.join(' ').toLowerCase();
                      return exclusions.some(exclusion =>
                        exclusion.trim() && fullRowText.includes(exclusion.toLowerCase())
                      );
                    }).length - duplicateIndices.size}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Модальное окно проверки комбинации */}
          {checkingColumn !== null && (() => {
            const assignedFields = getAssignedFields(checkingColumn)
            const columnLabel = getColumnDisplayLabel(checkingColumn)
            const description = getCombinationDescription(assignedFields)

            // Сохраненные настройки для этого столбца
            const savedSettings = savedSplitSettings[checkingColumn]

            // Пример для демонстрации разделения
            const sampleCellValue = exampleSource === 'manual'
              ? manualExample
              : (sampleData[exampleRowIndex]?.[checkingColumn] || '')
            const splitParts = splitCellValue(sampleCellValue, splitSettings.separator, splitSettings.customSeparator)

            // Функция для выбора случайной строки для примера
            const handleRandomRow = () => {
              const randomIndex = Math.floor(Math.random() * sampleData.length)
              setExampleRowIndex(randomIndex)
              setExampleSource('data')
            }

            // Функция для выбора случайных строк для проверки данных
            const handleRandomDataCheck = () => {
              const count = Math.min(2, sampleData.length)
              const randomIndices: number[] = []
              const availableIndices = Array.from({ length: sampleData.length }, (_, i) => i)

              for (let i = 0; i < count; i++) {
                const randomIdx = Math.floor(Math.random() * availableIndices.length)
                randomIndices.push(availableIndices[randomIdx])
                availableIndices.splice(randomIdx, 1)
              }

              setDataCheckRowIndices(randomIndices.sort((a, b) => a - b))
              setShowOnlyErrors(false) // Возвращаемся к режиму случайных примеров
            }

            return (
              <Modal
                isOpen={true}
                onClose={() => {
                  setCheckingColumn(null)
                  setSplitSettings({ separator: ' ', customSeparator: '', parts: {} })
                  setExampleSource('data')
                  setExampleRowIndex(0)
                  setManualExample('')
                  setDataCheckRowIndices([0, 1])
                }}
                title={`Проверка комбинации: ${columnLabel}`}
                size="lg"
              >
                <div className="space-y-3">
                  <div className="rounded-lg bg-orange-50 border border-orange-200 p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base" aria-hidden>🔗</span>
                      <span className="text-xs font-medium text-gray-700">Комбинация полей:</span>
                      <div className="flex flex-wrap gap-2">
                        {assignedFields.map(field => (
                          <span
                            key={field}
                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${FIELD_COLORS[field]}`}
                          >
                            <span aria-hidden>{FIELD_ICONS[field]}</span>
                            <span>{FIELD_LABELS[field]}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Показываем сохраненный пример если есть */}
                  {savedSettings && (
                    <div className="rounded-lg bg-green-50 border border-green-200 p-2.5">
                      <div className="flex items-start gap-2">
                        <span className="text-base" aria-hidden>💾</span>
                        <div className="flex-1 space-y-1">
                          <div className="text-xs font-semibold text-gray-800">Сохраненная настройка разделения</div>
                          <div className="text-xs text-gray-600">
                            Разделитель: <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-green-300">
                              {savedSettings.separator === 'custom'
                                ? `"${savedSettings.customSeparator}"`
                                : savedSettings.separator === ' ' ? 'Пробел' : `"${savedSettings.separator}"`}
                            </span>
                          </div>
                          {/* Показываем сохраненный пример */}
                          {savedSettings.example && (
                            <div className="text-xs text-gray-600">
                              Пример: <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-green-300 break-all">
                                {savedSettings.example}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base" aria-hidden>⚙️</span>
                      <h4 className="text-sm font-semibold text-gray-800">Настройка разделения</h4>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          Строка для примера
                        </label>

                        <div className="flex items-start gap-3">
                          {/* Левая часть - отображение/ввод строки и разделитель */}
                          <div className="flex-1 space-y-1.5">
                            {exampleSource === 'manual' ? (
                              <input
                                ref={manualExampleTextareaRef}
                                type="text"
                                value={manualExample}
                                onChange={(e) => setManualExample(e.target.value)}
                                placeholder="Введите пример текста для разделения..."
                                className="w-full h-[33px] rounded border-2 border-blue-400 bg-white px-2 py-1.5 font-mono text-xs text-gray-800 focus:outline-none focus:border-blue-600"
                              />
                            ) : (
                              <div className="w-full h-[33px] rounded border-2 border-blue-200 bg-white px-2 py-1.5 flex items-center">
                                <div className="font-mono text-xs text-gray-800 truncate">
                                  {sampleCellValue || <span className="text-gray-400">Пусто</span>}
                                </div>
                              </div>
                            )}

                            {/* Разделитель прямо под примером */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-700 whitespace-nowrap">Разделитель:</span>
                              <select
                                value={splitSettings.separator}
                                onChange={(e) => setSplitSettings(prev => ({ ...prev, separator: e.target.value }))}
                                className="flex-1 rounded border border-blue-300 bg-white px-2 py-1.5 text-xs h-[33px]"
                              >
                                <option value=" ">Пробел</option>
                                <option value=",">Запятая (,)</option>
                                <option value=";">Точка с запятой (;)</option>
                                <option value="|">Вертикальная черта (|)</option>
                                <option value="\t">Табуляция</option>
                                <option value="custom">Свой символ</option>
                              </select>
                              {splitSettings.separator === 'custom' && (
                                <input
                                  type="text"
                                  value={splitSettings.customSeparator}
                                  onChange={(e) => setSplitSettings(prev => ({ ...prev, customSeparator: e.target.value }))}
                                  placeholder="Символ"
                                  className="w-20 h-[33px] rounded border border-blue-300 px-2 py-1.5 text-xs"
                                  maxLength={3}
                                />
                              )}
                            </div>
                          </div>

                          {/* Правая часть - контролы */}
                          <div className="flex flex-col gap-2" style={{ width: '160px', minWidth: '160px' }}>
                            {/* Toggle переключатель */}
                            <div className="flex items-center gap-2 rounded border border-blue-300 bg-white px-2 py-1.5">
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={exampleSource === 'manual'}
                                  onChange={(e) => setExampleSource(e.target.checked ? 'manual' : 'data')}
                                  className="sr-only peer"
                                />
                                <div className="relative w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-blue-600 transition-colors">
                                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
                                </div>
                                <span className="ml-2 text-xs font-medium text-gray-700">
                                  {exampleSource === 'manual' ? 'Ручной ввод' : 'Из данных'}
                                </span>
                              </label>
                            </div>

                            {/* Контролы для выбора строки - всегда занимают место */}
                            <select
                              value={exampleRowIndex}
                              onChange={(e) => setExampleRowIndex(Number(e.target.value))}
                              disabled={exampleSource === 'manual'}
                              className={`rounded border border-blue-300 bg-white px-2 py-1.5 text-xs max-w-full h-[33px] ${exampleSource === 'manual' ? 'opacity-0 pointer-events-none' : ''}`}
                            >
                              {sampleData.map((row, index) => {
                                const cellValue = row[checkingColumn] || ''
                                const displayValue = cellValue.length > 30
                                  ? cellValue.substring(0, 30) + '...'
                                  : cellValue
                                return (
                                  <option key={index} value={index}>
                                    {displayValue || `(пустая строка ${index + 1})`}
                                  </option>
                                )
                              })}
                            </select>
                            <button
                              type="button"
                              onClick={handleRandomRow}
                              disabled={exampleSource === 'manual'}
                              className={`rounded bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors h-[33px] ${exampleSource === 'manual' ? 'opacity-0 pointer-events-none' : ''}`}
                              title="Случайная строка"
                            >
                              🎲 Случайная
                            </button>
                          </div>
                        </div>
                      </div>

                      {splitParts.length > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-2">
                            Результат разделения: {splitParts.length} {splitParts.length === 1 ? 'часть' : splitParts.length < 5 ? 'части' : 'частей'}
                          </label>
                          <div className="space-y-1.5">
                            {splitParts.map((part, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <span className="w-20 text-xs text-gray-600">Часть {index + 1}:</span>
                                <span className="flex-1 rounded bg-white border border-blue-200 px-2 py-0.5 font-mono text-xs">
                                  {part}
                                </span>
                                <select
                                  value={Object.entries(splitSettings.parts).find(([_, idx]) => idx === index)?.[0] || ''}
                                  onChange={(e) => {
                                    const newParts = { ...splitSettings.parts }
                                    // Убираем старое назначение этого поля
                                    Object.keys(newParts).forEach(key => {
                                      if (newParts[key] === index) delete newParts[key]
                                    })
                                    // Добавляем новое
                                    if (e.target.value) {
                                      newParts[e.target.value] = index
                                    }
                                    setSplitSettings(prev => ({ ...prev, parts: newParts }))
                                  }}
                                  className="w-36 rounded border border-blue-300 bg-white px-2 py-1 text-xs"
                                >
                                  <option value="">Не использовать</option>
                                  {assignedFields.map(field => (
                                    <option key={field} value={field}>
                                      {FIELD_ICONS[field]} {FIELD_LABELS[field]}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <h4 className="text-sm font-semibold text-gray-800">Примеры из ваших данных:</h4>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-green-700 font-medium">
                            <span>✅</span>
                            <span>{(() => {
                              let successCount = 0
                              sampleData.forEach((row, rowIndex) => {
                                if (!row) return
                                const rawValue = row[checkingColumn] || ''
                                const hasCustomMapping = Object.keys(splitSettings.parts).length > 0
                                let parsedValues: Record<string, string> = {}
                                if (hasCustomMapping) {
                                  parsedValues = applyCustomSplit(rawValue, assignedFields, splitSettings.separator, splitSettings.customSeparator, splitSettings.parts)
                                } else {
                                  parsedValues = previewData[rowIndex] || {}
                                }
                                const allFieldsRecognized = assignedFields.every(field => parsedValues[field])
                                if (allFieldsRecognized) successCount++
                              })
                              return successCount
                            })()}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowOnlyErrors(!showOnlyErrors)}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition-all ${showOnlyErrors ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400' : 'bg-amber-50 text-amber-600 hover:bg-amber-100 cursor-pointer'}`}
                            title={showOnlyErrors ? "Показать случайные примеры" : "Показать только с ошибками"}
                          >
                            <span>⚠️</span>
                            <span>{(() => {
                              let errorCount = 0
                              sampleData.forEach((row, rowIndex) => {
                                if (!row) return
                                const rawValue = row[checkingColumn] || ''
                                const hasCustomMapping = Object.keys(splitSettings.parts).length > 0
                                let parsedValues: Record<string, string> = {}
                                if (hasCustomMapping) {
                                  parsedValues = applyCustomSplit(rawValue, assignedFields, splitSettings.separator, splitSettings.customSeparator, splitSettings.parts)
                                } else {
                                  parsedValues = previewData[rowIndex] || {}
                                }
                                const hasErrors = assignedFields.some(field => !parsedValues[field])
                                if (hasErrors) errorCount++
                              })
                              return errorCount
                            })()}</span>
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRandomDataCheck}
                        className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                        title={showOnlyErrors ? "Вернуться к случайным примерам" : "Выбрать другие случайные строки"}
                      >
                        🎲 Случайные строки
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {(showOnlyErrors ? sampleData.map((_, i) => i) : dataCheckRowIndices).map((rowIndex) => {
                        const row = sampleData[rowIndex]
                        if (!row) return null
                        const rawValue = row[checkingColumn] || ''

                        // Применяем кастомное разделение, если настроено
                        const hasCustomMapping = Object.keys(splitSettings.parts).length > 0
                        let parsedValues: Record<string, string> = {}

                        if (hasCustomMapping) {
                          parsedValues = applyCustomSplit(
                            rawValue,
                            assignedFields,
                            splitSettings.separator,
                            splitSettings.customSeparator,
                            splitSettings.parts
                          )
                        } else {
                          // Используем стандартный парсинг из previewData
                          parsedValues = previewData[rowIndex] || {}
                        }

                        // Проверяем, есть ли ошибки в строке
                        const hasErrors = assignedFields.some(field => !parsedValues[field])

                        // В режиме ошибок показываем только строки с ошибками
                        if (showOnlyErrors && !hasErrors) return null

                        return (
                          <div key={rowIndex} className="rounded bg-white border border-gray-200 p-2 text-xs">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-semibold text-gray-600">Строка {rowIndex + 1}:</span>
                              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-700">
                                &ldquo;{rawValue}&rdquo;
                              </span>
                            </div>
                            <div className="space-y-0.5 pl-3">
                              {assignedFields.map(field => {
                                const parsedValue = parsedValues[field] || ''
                                const hasValue = Boolean(parsedValue)
                                const statusIcon = hasValue ? '✅' : '⚠️'
                                const statusColor = hasValue ? 'text-green-600' : 'text-amber-600'

                                return (
                                  <div key={field} className="flex items-center gap-2 text-xs">
                                    <span aria-hidden>{statusIcon}</span>
                                    <span className="text-gray-600">{FIELD_ICONS[field]} {FIELD_LABELS[field]}:</span>
                                    <span className={`font-medium ${statusColor}`}>
                                      {parsedValue || '(не распознано)'}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end pt-3">
                    <Button
                      variant="primary"
                      onClick={() => {
                        if (checkingColumn !== null) {
                          setCheckedColumns(prev => new Set(prev).add(checkingColumn))
                          // Сохраняем настройки разделения для этого столбца
                          if (Object.keys(splitSettings.parts).length > 0) {
                            // Получаем текущий пример из окна проверки
                            const currentExample = exampleSource === 'manual'
                              ? manualExample
                              : (sampleData[exampleRowIndex]?.[checkingColumn] || '')

                            setSavedSplitSettings(prev => ({
                              ...prev,
                              [checkingColumn]: {
                                ...splitSettings,
                                example: currentExample // Сохраняем пример строки
                              }
                            }))
                          }
                        }
                        setCheckingColumn(null)
                      }}
                    >
                      Применить
                    </Button>
                  </div>
                </div>
              </Modal>
            )
          })()}

          {/* Кнопки действий */}
          <div className="flex justify-between items-center pt-6 border-t">
            <div className="flex space-x-3">
              {currentFormat && (
                <Tooltip content={`Удалить сохраненные настройки для формата ${formatLabels[currentFormat]}`}>
                  <Button
                    variant="outline"
                    onClick={handleDeleteSettings}
                    className="text-red-600 hover:bg-red-50 hover:border-red-300"
                  >
                    🗑️ Удалить настройки
                  </Button>
                </Tooltip>
              )}
            </div>

            <div className="flex space-x-3">
              <Button
                variant="danger"
                onClick={onClose}
              >
                Отмена
              </Button>

              {isEditingMode ? (
                <Tooltip content="Сохранить новые настройки столбцов">
                  <Button
                    variant="success"
                    onClick={handleApply}
                  >
                    ✅ Применить новые настройки
                  </Button>
                </Tooltip>
              ) : (
                <>
                  <Button
                    variant="success"
                    onClick={handleApply}
                    disabled={previewData.length === 0}
                  >
                    Применить
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Модалка предпросмотра всех данных */}
      {isPreviewOpen && sampleData.length > 0 && (
        <TablePreviewModal
          isOpen={isPreviewOpen}
          table={{
            description: `Все данные (${sampleData.length} строк)`,
            rows: [
              // Создаем заголовки как "Столбец A", "Столбец B" и т.д.
              Array.from({ length: Math.max(...sampleData.map(row => row.length)) }, (_, i) =>
                getColumnDisplayLabel(i)
              ),
              // Затем все данные
              ...sampleData
            ]
          }}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}
    </>
  )
}