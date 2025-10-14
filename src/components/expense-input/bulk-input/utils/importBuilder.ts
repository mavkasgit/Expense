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
} from '../types';

interface BuildExpensesArgs {
  mapping: ColumnMapping[];
  dataset: string[][];
  hasHeaderRow: boolean;
  resolveCityByInput: (value: string) => CityOption | null;
}

export function buildExpensesFromMappedData({
  mapping,
  dataset,
  hasHeaderRow,
  resolveCityByInput,
}: BuildExpensesArgs): BuildExpensesResult {
  const stats: BuildExpensesStats = {
    totalRows: 0,
    importedRows: 0,
    skippedRows: 0,
    autoDetectedCities: 0,
    manualCities: 0,
    detectedTimes: 0,
    manualTimes: 0,
  };

  if (dataset.length === 0) {
    return { expenses: [], stats, reviewItems: [] };
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

  const rowsToProcess = (hasHeaderRow ? dataset.slice(1) : dataset)
    .map(normalizeRow)
    .filter(hasMeaningfulData);

  stats.totalRows = rowsToProcess.length;

  const newExpenses: BulkExpenseRowData[] = [];

  rowsToProcess.forEach((row, dataRowIndex) => {
    const expenseData: Partial<BulkExpenseRowData> & { expense_time?: string | null } = {
      tempId: crypto.randomUUID(),
    };

    mappingWithMeta.forEach(column => {
      if (column.hidden || !column.enabled || column.targetFields.length === 0) {
        return;
      }

      const cellValue = row[column.columnIndex]?.trim() || '';
      if (!cellValue) {
        return;
      }

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
        // Если есть кастомное разделение, используем ТОЛЬКО значения из splitValues
        // Если для поля нет значения в splitValues - значит разделение не дало результата для этого поля
        const fieldValue = hasCustomSplit ? (splitValues[targetField] || '') : cellValue;
        switch (targetField) {
          case 'amount': {
            try {
              const parsedAmount = parseAmount(fieldValue);
              const normalizedAmount = Math.abs(parsedAmount);
              if (normalizedAmount > 0) {
                expenseData.amount = normalizedAmount;
              }
            } catch (error) {
              console.warn('Не удалось распарсить сумму из столбца', fieldValue, error);
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
            expenseData.expense_date = dateTimeResult.date;
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
            }
            break;
          }
          case 'notes':
            expenseData.notes = fieldValue;
            break;
        }
      });
    });

    if (!expenseData.amount || !expenseData.description) {
      return;
    }

    const description = expenseData.description.trim();
    const notes = expenseData.notes?.trim() || '';

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
      amount: expenseData.amount,
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

  return { expenses: newExpenses, stats, reviewItems: [] };
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
