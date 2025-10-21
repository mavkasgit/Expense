import type { ColumnMapping } from '@/types';
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

export type BuildExpensesResult = {
  expenses: BulkExpenseRowData[];
  stats: BuildExpensesStats;
  reviewItems: AutoExtractionReviewItem[];
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
