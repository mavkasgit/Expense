import type { TableInfo } from '@/lib/utils/bankStatementParsers'
import type { BulkExpenseRowData } from '@/lib/validations/expenses'
import type { ColumnMapping, ColumnMappingField } from '@/types'

export type SelectedTableMeta = Pick<
  TableInfo,
  'index' | 'description' | 'rowCount' | 'columnCount' | 'hasHeaders'
>

export type AutoExtractionReviewItem = {
  type: 'city-from-description'
  rowIndex: number
  columnLabel: string
  sourceValue: string
  extractedCity: string
  cleanedDescription: string
}

export type CityReviewItem = AutoExtractionReviewItem

export interface BuildExpensesStats {
  totalRows: number
  importedRows: number
  skippedRows: number
  autoDetectedCities: number
  manualCities: number
  detectedTimes: number
  manualTimes: number
}

export interface BuildExpensesResult {
  expenses: BulkExpenseRowData[]
  stats: BuildExpensesStats
  reviewItems: AutoExtractionReviewItem[]
}

export type ColumnMappingWithMeta = ColumnMapping & {
  columnIndex: number
  columnLabel: string
  targetFields: ColumnMappingField[]
  hidden: boolean
}
