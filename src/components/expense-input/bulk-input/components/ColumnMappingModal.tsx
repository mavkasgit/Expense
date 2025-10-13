'use client'

import { useState, useCallback, useMemo, useEffect, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { ColumnMapping, ColumnMappingField } from '@/types'
import { parseDateAndTime, parseTimeValue } from '@/lib/utils/bankStatementParsers'
import { extractCityFromDescription } from '@/lib/utils/cityParser'

// Компонент подсказки
function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  return (
    <div className="relative group">
      {children}
      {/* Tooltip справа от элемента */}
      <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-4 py-3 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[10000] break-words shadow-lg" style={{maxWidth: '400px', width: 'max-content', minWidth: '200px'}}>
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
  onApply: (mapping: ColumnMapping[]) => void
  onApplyAndSave?: (mapping: ColumnMapping[]) => void // Новый проп для прямого сохранения
  sampleData: string[][] // Первые несколько строк для предпросмотра
  savedMapping?: ColumnMapping[] | null // Сохраненная схема столбцов
  isEditingMode?: boolean // Режим редактирования сохраненной схемы
  tableDescription?: string | null
  onReplaceTable?: () => void
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

const COLUMN_FIELD_OPTIONS: Array<{ field: ColumnMappingField; label: string; icon: string }> = (
  Object.keys(FIELD_LABELS) as ColumnMappingField[]
).map(field => ({
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
  onApplyAndSave,
  sampleData,
  savedMapping,
  isEditingMode = false,
  tableDescription,
  onReplaceTable
}: ColumnMappingModalProps) {
  // Инициализируем порядок столбцов (только индексы)
  const [columnOrder, setColumnOrder] = useState<number[]>([])

  // Инициализируем назначения полей
  const [fieldAssignments, setFieldAssignments] = useState<FieldAssignment[]>([])
  const [openColumnPicker, setOpenColumnPicker] = useState<number | null>(null)
  const [hiddenColumns, setHiddenColumns] = useState<Set<number>>(() => new Set())
  const [isHiddernColumnsVisible, setIsHiddernColumnsVisible] = useState(true)
  const [pickerPosition, setPickerPosition] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
  const columnPickerRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const dropdownContainerRef = useRef<HTMLDivElement | null>(null)
  
  // Состояние для тестовой строки и проверки комбинации
  const [selectedTestRow, setSelectedTestRow] = useState(0)
  const [checkingColumn, setCheckingColumn] = useState<number | null>(null)
  
  // Настройки разделения для комбинаций
  const [splitSettings, setSplitSettings] = useState<{
    separator: string
    customSeparator: string
    parts: Record<string, number> // field -> part index (0, 1, 2...)
  }>({
    separator: ' ',
    customSeparator: '',
    parts: {}
  })
  
  // Состояние для примера разделения
  const [exampleSource, setExampleSource] = useState<'data' | 'manual'>('data')
  const [exampleRowIndex, setExampleRowIndex] = useState(0)
  const [manualExample, setManualExample] = useState('')
  const manualExampleTextareaRef = useRef<HTMLInputElement>(null)
  
  // Для случайного выбора строк в проверке данных
  const [dataCheckRowIndices, setDataCheckRowIndices] = useState<number[]>([0, 1])
  const [showOnlyErrors, setShowOnlyErrors] = useState(false)

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

    if (savedMapping && savedMapping.length === columnCount) {
      savedMapping.forEach((column, index) => {
        const originalIndex = defaultOrder[index]
        if (column?.hidden) {
          nextHiddenColumns.add(originalIndex)
          return
        }

        const targets = Array.isArray(column.targetFields)
          ? column.targetFields.filter(isColumnMappingField)
          : []

        targets.forEach(targetField => {
          const assignment = baseAssignments.find(item => item.field === targetField)
          if (assignment) {
            assignment.assignedColumn = originalIndex
          }
        })
      })
    }

    setFieldAssignments(baseAssignments)
    setHiddenColumns(nextHiddenColumns)
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
    const mapping: ColumnMapping[] = columnOrder.map((originalIndex, newIndex) => ({
      sourceIndex: newIndex,
      targetFields: [],
      enabled: false,
      preview: sampleData[0]?.[originalIndex] || '',
      hidden: hiddenColumns.has(originalIndex)
    }))

    // Назначаем поля
    fieldAssignments.forEach(assignment => {
      if (assignment.assignedColumn !== null && !hiddenColumns.has(assignment.assignedColumn)) {
        const orderIndex = columnOrder.indexOf(assignment.assignedColumn)
        if (orderIndex !== -1) {
          const targets = mapping[orderIndex].targetFields
          if (!targets.includes(assignment.field)) {
            targets.push(assignment.field)
          }
          mapping[orderIndex].enabled = true
        }
      }
    })

    return mapping
  }, [columnOrder, fieldAssignments, sampleData, hiddenColumns])

  // Применение настроек для редактирования
  const handleApply = useCallback(() => {
    // В режиме редактирования не требуем обязательные поля
    if (!isEditingMode) {
      // Проверяем обязательные поля только при обработке данных
      const amountField = fieldAssignments.find(f => f.field === 'amount')
      const descriptionField = fieldAssignments.find(f => f.field === 'description')
      
      if (!amountField?.assignedColumn || !descriptionField?.assignedColumn) {
        // В обычном режиме требуем обязательные поля
        return
      }
    }

    const mapping = createMapping()
    onApply(mapping)
    onClose()
  }, [createMapping, onApply, onClose, isEditingMode, fieldAssignments])

  // Применение и прямое сохранение
  const handleApplyAndSave = useCallback(() => {
    // Проверяем обязательные поля
    const amountField = fieldAssignments.find(f => f.field === 'amount')
    const descriptionField = fieldAssignments.find(f => f.field === 'description')

    if (!amountField?.assignedColumn || !descriptionField?.assignedColumn) {
      return
    }

    if (onApplyAndSave) {
      const confirmed = window.confirm('Сохранить все расходы с текущим назначением столбцов? Пожалуйста, убедитесь, что данные верны.')
      if (!confirmed) {
        return
      }
    }

    const mapping = createMapping()
    if (onApplyAndSave) {
      onApplyAndSave(mapping)
    }
    onClose()
  }, [createMapping, onApplyAndSave, onClose, fieldAssignments])

  // Вычисляем предпросмотр данных в реальном времени с реальным парсингом
  const previewData = useMemo(() => {
    if (sampleData.length === 0) return []

    const amountField = fieldAssignments.find(f => f.field === 'amount')
    const descriptionField = fieldAssignments.find(f => f.field === 'description')
    const cityField = fieldAssignments.find(f => f.field === 'city')
    const dateField = fieldAssignments.find(f => f.field === 'expense_date')
    const timeField = fieldAssignments.find(f => f.field === 'expense_time')
    const notesField = fieldAssignments.find(f => f.field === 'notes')

    // В режиме редактирования не требуем обязательные поля для предпросмотра
    if (!isEditingMode && (amountField?.assignedColumn === null || amountField?.assignedColumn === undefined ||
        descriptionField?.assignedColumn === null || descriptionField?.assignedColumn === undefined)) {
      return []
    }

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
  }, [sampleData, fieldAssignments, isEditingMode])

  // Сброс к значениям по умолчанию
  const handleReset = useCallback(() => {
    if (sampleData.length === 0) return

    const columnCount = Math.max(...sampleData.map(row => row.length))

    setColumnOrder(Array.from({ length: columnCount }, (_, index) => index))
    setFieldAssignments(createDefaultFieldAssignments())
    setHiddenColumns(new Set())
  }, [sampleData])

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
        {/* Информация о режиме редактирования */}
        {isEditingMode && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-blue-800 font-medium">
                Режим редактирования сохраненной схемы
              </span>
            </div>
            <p className="text-xs text-blue-700 mt-1">
              Изменения будут сохранены и применены к будущим массовым вводам
            </p>
          </div>
        )}

        {/* Таблица с данными и кликабельными заголовками */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900">Ваши данные</h3>
              <Tooltip content="Кликните на заголовок столбца чтобы назначить ему поле">
                <div className="w-4 h-4 bg-gray-400 text-white rounded-full flex items-center justify-center text-xs cursor-help">
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

          <p className="mb-3 text-xs text-gray-500">
            Можно выбрать несколько полей для одного столбца — например, одновременно отметить дату и время или описание и город.
          </p>

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
                          <th key={originalIndex} className="p-2 align-top">
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
                              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                {columnLabel}
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
                                  className={`flex w-full items-center justify-between rounded-md border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                    assignedFields.length > 0
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
                                    className={`ml-2 text-gray-400 transition-transform ${
                                      isOpen ? 'rotate-180' : ''
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
                                        <div className="max-h-56 overflow-y-auto p-2 space-y-1">
                                          {COLUMN_FIELD_OPTIONS.map(option => {
                                            const fieldMeta = fieldAssignments.find(item => item.field === option.field)
                                            const isChecked = assignedFields.includes(option.field)
                                            const isRequired = Boolean(fieldMeta?.required) && fieldMeta?.assignedColumn === null
                                            const assignedColumnIndex = fieldMeta?.assignedColumn
                                            const isAssignedElsewhere =
                                              typeof assignedColumnIndex === 'number' &&
                                              assignedColumnIndex !== originalIndex
                                            const assignedDisplayLabel =
                                              isAssignedElsewhere && typeof assignedColumnIndex === 'number'
                                                ? getColumnDisplayLabel(assignedColumnIndex)
                                                : null

                                            return (
                                              <label
                                                key={option.field}
                                                className="flex items-start gap-2 rounded-md px-2 py-1 text-xs hover:bg-gray-50"
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  onChange={() => toggleFieldForColumn(option.field, originalIndex)}
                                                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <div className="flex flex-col">
                                                  <span className="flex items-center gap-2 text-gray-700">
                                                    <span aria-hidden>{option.icon}</span>
                                                    <span>{option.label}</span>
                                                  </span>
                                                  {isAssignedElsewhere && assignedDisplayLabel && (
                                                    <span className="pl-6 text-[11px] text-amber-600">
                                                      Уже назначено: {assignedDisplayLabel}
                                                    </span>
                                                  )}
                                                  {isRequired && (
                                                    <span className="pl-6 text-[11px] text-red-600">
                                                      Обязательное поле
                                                    </span>
                                                  )}
                                                </div>
                                              </label>
                                            )
                                          })}
                                        </div>
                                        <div className="border-t border-gray-100 px-3 py-2 text-xs text-gray-600">
                                          <button
                                            type="button"
                                            onClick={() => toggleColumnHidden(originalIndex)}
                                            className="flex items-center gap-2 text-left text-gray-700 hover:text-blue-600"
                                          >
                                            <span aria-hidden>{hiddenColumns.has(originalIndex) ? '👀' : '🙈'}</span>
                                            <span>
                                              {hiddenColumns.has(originalIndex)
                                                ? 'Показать столбец'
                                                : 'Скрыть столбец'}
                                            </span>
                                          </button>
                                          <p className="mt-1 text-[11px] text-gray-400">
                                            Скрытые столбцы не будут мешать, вы всегда можете вернуть их ниже.
                                          </p>
                                        </div>
                                      </div>
                                    ),
                                    document.body
                                  )
                                : null}
                              <div className="flex min-h-[24px] flex-col items-center gap-2">
                                {assignedFields.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setOpenColumnPicker(null)
                                      setCheckingColumn(originalIndex)
                                    }}
                                    className="rounded bg-orange-100 px-2 py-1 text-[11px] font-medium text-orange-700 hover:bg-orange-200 transition-colors"
                                  >
                                    🔍 Проверить
                                  </button>
                                )}
                                <div className="flex flex-wrap justify-center gap-1">
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
                                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${FIELD_COLORS[field]}`}
                                        >
                                          <span aria-hidden>{FIELD_ICONS[field]}</span>
                                          <span>{FIELD_LABELS[field]}</span>
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
                          <td key={originalIndex} className="px-4 py-3 text-gray-900 whitespace-nowrap">
                            {row[originalIndex] || '—'}
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
              <div className="px-4 py-2 bg-gray-50 text-sm text-gray-600 text-center">
                ... и еще {sampleData.length - 5} записей
              </div>
            )}
          </div>

          {hiddenColumnOrder.length > 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setIsHiddernColumnsVisible(!isHiddernColumnsVisible)}
              >
                <div className="flex items-center gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Скрытые столбцы ({hiddenColumnOrder.length})
                  </div>
                </div>
                <div className="flex items-center gap-2">
                    <p className="text-[11px] text-gray-500 hidden sm:block">
                      Мы запомним их позиции и автоматически спрячем при следующем импорте.
                    </p>
                    <span className={`ml-2 text-gray-400 transition-transform ${isHiddernColumnsVisible ? 'rotate-180' : ''}`} aria-hidden>
                        ▾
                    </span>
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

        {/* Тестовая строка - детальный разбор */}
        {previewData.length > 0 && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg" aria-hidden>🔬</span>
                <h3 className="text-sm font-semibold text-gray-800">Тестовая строка (детальный разбор)</h3>
                <Tooltip content="Подробный анализ того, как будет обработана выбранная строка ваших данных">
                  <div className="w-4 h-4 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs cursor-help">
                    ?
                  </div>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="test-row-select" className="text-xs text-gray-700">Строка:</label>
                <select
                  id="test-row-select"
                  value={selectedTestRow}
                  onChange={(e) => setSelectedTestRow(Number(e.target.value))}
                  className="rounded border border-amber-300 bg-white px-2 py-1 text-xs text-gray-700"
                >
                  {sampleData.map((_, index) => (
                    <option key={index} value={index}>
                      {index + 1}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              {visibleColumnOrder.map((originalIndex, idx) => {
                const assignedFields = getAssignedFields(originalIndex)
                if (assignedFields.length === 0) return null

                const columnLabel = getColumnDisplayLabel(originalIndex)
                const rawValue = sampleData[selectedTestRow]?.[originalIndex] || ''
                const preview = previewData[selectedTestRow]

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
          </div>
        )}

        {/* Предпросмотр результата */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-medium text-gray-900">Предпросмотр результата</h3>
            <Tooltip content="Посмотрите как будут обработаны ваши данные с текущими настройками">
              <div className="w-4 h-4 bg-gray-400 text-white rounded-full flex items-center justify-center text-xs cursor-help">
                ?
              </div>
            </Tooltip>
          </div>
          
          {previewData.length > 0 ? (
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 whitespace-nowrap">💰 Сумма</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 whitespace-nowrap">📝 Описание</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 whitespace-nowrap">📍 Город</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 whitespace-nowrap">📅 Дата</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 whitespace-nowrap">⏰ Время</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 whitespace-nowrap">📋 Примечания</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 5).map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-green-700 whitespace-nowrap">
                          {row.amount || '—'}
                        </td>
                        <td className="px-4 py-3 text-blue-700 whitespace-nowrap">
                          {row.description || '—'}
                        </td>
                        <td className="px-4 py-3 text-indigo-700 whitespace-nowrap">
                          {row.city || '—'}
                        </td>
                        <td className="px-4 py-3 text-purple-700 whitespace-nowrap">
                          {row.expense_date || '—'}
                        </td>
                        <td className="px-4 py-3 text-teal-700 whitespace-nowrap">
                          {row.expense_time || '—'}
                        </td>
                        <td className="px-4 py-3 text-yellow-700 whitespace-nowrap">
                          {row.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewData.length > 5 && (
                <div className="px-4 py-2 bg-gray-50 text-sm text-gray-600 text-center">
                  ... и еще {previewData.length - 5} записей
                </div>
              )}
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <div className="text-yellow-600">⚠️</div>
                <div className="text-sm text-yellow-800">
                  Назначьте хотя бы поля &quot;Сумма&quot; и &quot;Описание&quot; для предпросмотра данных
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Модальное окно проверки комбинации */}
        {checkingColumn !== null && (() => {
          const assignedFields = getAssignedFields(checkingColumn)
          const columnLabel = getColumnDisplayLabel(checkingColumn)
          const description = getCombinationDescription(assignedFields)
          
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
                    onClick={() => setCheckingColumn(null)}
                  >
                    Закрыть
                  </Button>
                </div>
              </div>
            </Modal>
          )
        })()}

        {/* Кнопки действий */}
        <div className="flex justify-between items-center pt-6 border-t">
          <div className="flex space-x-3">
            <Tooltip content="Вернуть настройки к значениям по умолчанию">
              <Button
                variant="outline"
                onClick={handleReset}
                className="text-gray-600"
              >
                🔄 Сбросить
              </Button>
            </Tooltip>
          </div>
          
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Отмена
            </Button>
            
            {isEditingMode ? (
              <Tooltip content="Сохранить новые настройки столбцов">
                <Button
                  variant="primary"
                  onClick={handleApply}
                >
                  ✅ Применить новые настройки
                </Button>
              </Tooltip>
            ) : (
              <>
                <Tooltip content="Применить настройки и продолжить редактирование">
                  <Button
                    variant="outline"
                    onClick={handleApply}
                    disabled={previewData.length === 0}
                  >
                    📝 Применить и редактировать
                  </Button>
                </Tooltip>
                
                {onApplyAndSave && (
                  <Tooltip content="Применить настройки и сразу сохранить все расходы">
                    <Button
                      variant="primary"
                      onClick={handleApplyAndSave}
                      disabled={previewData.length === 0}
                    >
                      💾 Применить и сохранить
                    </Button>
                  </Tooltip>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}