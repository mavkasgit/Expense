import type { ColumnMapping, ColumnMappingField } from '@/types';
import type { TableInfo } from '@/lib/utils/bankStatementParsers';
import type { BulkExpenseRowData } from '@/lib/validations/expenses';

export type SelectedTableMeta = Pick<
  TableInfo,
  'index' | 'description' | 'rowCount' | 'columnCount' | 'hasHeaders'
>;

export interface BuildExpensesStats {
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  excludedRows: number;
  duplicateRows: number;
  autoDetectedCities: number;
  manualCities: number;
  detectedTimes: number;
  manualTimes: number;
}

export type AutoExtractionReviewItem = {
  type: 'city-from-description';
  rowIndex: number;
  columnLabel: string;
  sourceValue: string;
  extractedCity: string;
  cleanedDescription: string;
};

export interface RowProcessingError {
  rowIndex: number; // Original index in the dataset
  columnLabel?: string; // Label of the column where error occurred
  field?: ColumnMappingField; // Field that failed to parse/validate
  message: string; // Detailed error message
}

export type BuildExpensesResult = {
  expenses: BulkExpenseRowData[];
  stats: BuildExpensesStats;
  reviewItems: AutoExtractionReviewItem[];
  errors: RowProcessingError[]; // New: list of errors per row/field
};

export type ReviewModalState = {
  mode: 'append' | 'directSave';
  result: BuildExpensesResult;
};

export type PreviewedTable = {
  description: string;
  rows: string[][];
};

export type ColumnMappingWithMeta = ColumnMapping & {
  columnIndex: number;
  columnLabel: string;
};
