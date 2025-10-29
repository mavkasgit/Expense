import { getCurrentDateISO } from '@/lib/utils/dateUtils';
import {
  parseAmount,
  parseDateAndTime,
  parseTimeValue,
} from '@/lib/utils/bankStatementParsers';
import type { ColumnMapping } from '@/types';
import type { CityOption } from '@/lib/utils/cityOptions';
import type { BulkExpenseRowData } from '@/lib/validations/expenses';
import { sanitizeColumnMapping, isColumnMappingField } from './columnMapping';
import { getColumnLabel, hasMeaningfulData, normalizeRow } from './dataset';
import type {
  BuildExpensesResult,
  BuildExpensesStats,
  RowProcessingError,
} from '../types';

// Проверка содержит ли строка исключающее слово
function containsExclusion(rowData: string[], exclusions: string[]): boolean {
  if (exclusions.length === 0) return false;
  
  const fullRowText = rowData.join(' ').toLowerCase();
  return exclusions.some(exclusion => 
    exclusion.trim() && fullRowText.includes(exclusion.toLowerCase())
  );
}

interface BuildExpensesArgs {
  mapping: ColumnMapping[];
  dataset: string[][];
  hasHeaderRow: boolean;
  resolveCityByInput: (value: string) => CityOption | null;
  exclusions?: string[];
  duplicateIndices?: Set<number>;
}

export function buildExpensesFromMappedData({
  mapping,
  dataset,
  hasHeaderRow,
  resolveCityByInput,
  exclusions = [],
  duplicateIndices = new Set(),
}: BuildExpensesArgs): BuildExpensesResult {
  const stats: BuildExpensesStats = {
    totalRows: 0,
    importedRows: 0,
    skippedRows: 0,
    excludedRows: 0,
    duplicateRows: 0,
    autoDetectedCities: 0,
    manualCities: 0,
    detectedTimes: 0,
    manualTimes: 0,
  };

  const rowErrors: RowProcessingError[] = []; // Initialize errors array

  if (dataset.length === 0) {
    return { expenses: [], stats, reviewItems: [], errors: rowErrors }; // Return errors
  }

  const headerRow = hasHeaderRow ? dataset[0] : null;
  const mappingWithMeta = sanitizeColumnMapping(mapping).map((column) => ({
    ...column,
    columnIndex: column.sourceIndex,
    columnLabel: getColumnLabel(column.sourceIndex, headerRow),
    targetFields: Array.isArray(column.targetFields)
      ? column.targetFields.filter(isColumnMappingField)
      : [],
  }));

  const allRows = (hasHeaderRow ? dataset.slice(1) : dataset)
    .map(normalizeRow)
    .filter(hasMeaningfulData);

  stats.totalRows = allRows.length;

  // Фильтруем исключенные строки и дубликаты
  const rowsToProcess: string[][] = [];
  let excludedCount = 0;
  let duplicateCount = 0;
  
  allRows.forEach((row, originalIndex) => {
    // Сначала проверяем исключения
    if (containsExclusion(row, exclusions)) {
      excludedCount++;
      return;
    }
    
    // Затем проверяем дубликаты (по оригинальному индексу)
    if (duplicateIndices.has(originalIndex)) {
      duplicateCount++;
      return;
    }
    
    // Если прошли все фильтры - добавляем в обработку
    rowsToProcess.push(row);
  });
  
  stats.excludedRows = excludedCount;
  stats.duplicateRows = duplicateCount;

  const newExpenses: BulkExpenseRowData[] = [];

  rowsToProcess.forEach((row, dataRowIndex) => {
    const expenseData: Partial<BulkExpenseRowData> & { expense_time?: string | null } = {
      tempId: crypto.randomUUID(),
    };

    const currentRowOriginalIndex = hasHeaderRow ? dataRowIndex + 1 : dataRowIndex; // Adjust for header row

    mappingWithMeta.forEach(column => {
      if (column.hidden || !column.enabled || column.targetFields.length === 0) {
        return;
      }

      const cellValue = row[column.columnIndex]?.trim() || '';

      // Проверяем есть ли кастомное разделение для этого столбца
      const hasCustomSplit = column.customSplitSeparator && column.customSplitParts && Object.keys(column.customSplitParts).length > 0;
      const splitValues: Record<string, string> = {};
      
      if (hasCustomSplit && column.customSplitSeparator && column.customSplitParts) {
        // Применяем кастомное разделение
        const parts = cellValue.split(column.customSplitSeparator).map(s => s.trim()).filter(s => s);
        Object.entries(column.customSplitParts).forEach(([field, partIndex]) => {
          if (partIndex < parts.length) {
            splitValues[field] = parts[partIndex];
          }
        });
      }

      column.targetFields.forEach(targetField => {
        const fieldValue = hasCustomSplit ? (splitValues[targetField] || '') : cellValue;

        switch (targetField) {
          case 'amount': {
            try {
              const parsedAmount = parseAmount(fieldValue);
              const normalizedAmount = Math.abs(parsedAmount);
              if (normalizedAmount > 0) {
                expenseData.amount = normalizedAmount;
              } else {
                if (fieldValue.trim() !== '') { 
                    rowErrors.push({
                        rowIndex: currentRowOriginalIndex,
                        columnLabel: column.columnLabel,
                        field: 'amount',
                        message: `Не удалось распознать сумму из значения "${fieldValue}"`, 
                    });
                }
              }
            } catch (error) {
              rowErrors.push({
                rowIndex: currentRowOriginalIndex,
                columnLabel: column.columnLabel,
                field: 'amount',
                message: `Не удалось распарсить сумму из значения "${fieldValue}"`, 
              });
            }
            break;
          }
          case 'description':
            expenseData.description = fieldValue;
            break;
          case 'city':
            expenseData.city = fieldValue;
            break;
          case 'expense_date': {
            const dateTimeResult = parseDateAndTime(fieldValue);
            if (dateTimeResult.date) {
                expenseData.expense_date = dateTimeResult.date;
            } else {
                rowErrors.push({
                    rowIndex: currentRowOriginalIndex,
                    columnLabel: column.columnLabel,
                    field: 'expense_date',
                    message: `Не удалось распознать дату из значения "${fieldValue}"`, 
                });
            }
            if (dateTimeResult.time && !expenseData.expense_time) {
              expenseData.expense_time = dateTimeResult.time;
              stats.detectedTimes += 1;
            }
            break;
          }
          case 'expense_time': {
            if (expenseData.expense_time) {
              break;
            }
            const parsedTime = parseTimeValue(fieldValue);
            if (parsedTime) {
              expenseData.expense_time = parsedTime;
              stats.manualTimes += 1;
            } else if (fieldValue.trim() !== '') { 
                rowErrors.push({
                    rowIndex: currentRowOriginalIndex,
                    columnLabel: column.columnLabel,
                    field: 'expense_time',
                    message: `Не удалось распознать время из значения "${fieldValue}"`, 
                });
            }
            break;
          }
          case 'notes':
            expenseData.notes = fieldValue;
            break;
        }
      });
    });

    // Post-processing and validation for required fields
    const description = expenseData.description?.trim() || '';
    const notes = expenseData.notes?.trim() || '';

    // Check for required fields (amount and description are typically required)
    if (!expenseData.amount || expenseData.amount <= 0) {
        rowErrors.push({
            rowIndex: currentRowOriginalIndex,
            field: 'amount',
            message: 'Сумма является обязательным полем и должна быть больше нуля.',
        });
    }
    if (!description) {
        rowErrors.push({
            rowIndex: currentRowOriginalIndex,
            field: 'description',
            message: 'Описание является обязательным полем.',
        });
    }
    if (!expenseData.expense_date) {
        rowErrors.push({
            rowIndex: currentRowOriginalIndex,
            field: 'expense_date',
            message: 'Дата является обязательным полем.',
        });
    }


    const providedCity = expenseData.city?.trim() || '';
    let finalCity = providedCity;
    let resolvedCityId: string | null = null;

    if (providedCity) {
      stats.manualCities += 1;
      const resolved = resolveCityByInput(providedCity);
      if (resolved) {
        finalCity = resolved.cityName;
        resolvedCityId = resolved.cityId;
      }
    }

    newExpenses.push({
      amount: expenseData.amount || 0,
      description,
      notes,
      category_id: '',
      expense_date: expenseData.expense_date || getCurrentDateISO(),
      expense_time: expenseData.expense_time || null,
      city: finalCity,
      city_id: resolvedCityId,
      tempId: expenseData.tempId!,
    });
  });

  stats.importedRows = newExpenses.length;
  stats.skippedRows = Math.max(stats.totalRows - stats.importedRows, 0);

  return { expenses: newExpenses, stats, reviewItems: [], errors: rowErrors };
}

export function buildSingleColumnExpenses(rows: string[][], hasHeaderRow: boolean): BulkExpenseRowData[] {
  const dataRows = (hasHeaderRow ? rows.slice(1) : rows)
    .map(normalizeRow)
    .filter(row => row[0] && row[0].trim());

  return dataRows.map(row => ({
    amount: 0,
    description: row[0].trim(),
    notes: '',
    category_id: '',
    expense_date: getCurrentDateISO(),
    expense_time: '',
    city: '',
    city_id: null,
    tempId: crypto.randomUUID(),
  }));
}
