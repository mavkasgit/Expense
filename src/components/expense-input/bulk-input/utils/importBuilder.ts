import { getCurrentDateISO } from '@/lib/utils/dateUtils';
import {
  parseAmount,
  parseDateAndTime,
  parseTimeValue,
} from '@/lib/utils/bankStatementParsers';
import { extractCityFromDescription } from '@/lib/utils/cityParser';
import type { ColumnMapping } from '@/types';
import type { CityOption } from '@/lib/utils/cityOptions';
import type { BulkExpenseRowData } from '@/lib/validations/expenses';
import { sanitizeColumnMapping, isColumnMappingField } from './columnMapping';
import { getColumnLabel, hasMeaningfulData, normalizeRow } from './dataset';
import type {
  AutoExtractionReviewItem,
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
  const mappingWithMeta = sanitizeColumnMapping(mapping).map((column, columnIndex) => ({
    ...column,
    columnIndex,
    columnLabel: getColumnLabel(columnIndex, headerRow),
    targetFields: Array.isArray(column.targetFields)
      ? column.targetFields.filter(isColumnMappingField)
      : [],
  }));

  const rowsToProcess = (hasHeaderRow ? dataset.slice(1) : dataset)
    .map(normalizeRow)
    .filter(hasMeaningfulData);

  stats.totalRows = rowsToProcess.length;

  const newExpenses: BulkExpenseRowData[] = [];
  const reviewItems: AutoExtractionReviewItem[] = [];

  rowsToProcess.forEach((row, dataRowIndex) => {
    const expenseData: Partial<BulkExpenseRowData> & { expense_time?: string | null } = {
      tempId: crypto.randomUUID(),
    };

    let descriptionColumnLabel: string | null = null;
    let descriptionSourceValue = '';
    let descriptionColumnIndex: number | null = null;

    mappingWithMeta.forEach(column => {
      if (column.hidden || !column.enabled || column.targetFields.length === 0) {
        return;
      }

      const cellValue = row[column.columnIndex]?.trim() || '';
      if (!cellValue) {
        return;
      }

      column.targetFields.forEach(targetField => {
        switch (targetField) {
          case 'amount': {
            try {
              const parsedAmount = parseAmount(cellValue);
              const normalizedAmount = Math.abs(parsedAmount);
              if (normalizedAmount > 0) {
                expenseData.amount = normalizedAmount;
              }
            } catch (error) {
              console.warn('Не удалось распарсить сумму из столбца', cellValue, error);
            }
            break;
          }
          case 'description':
            expenseData.description = cellValue;
            descriptionColumnLabel = column.columnLabel;
            descriptionSourceValue = cellValue;
            descriptionColumnIndex = column.columnIndex;
            break;
          case 'city':
            expenseData.city = cellValue;
            break;
          case 'expense_date': {
            const dateTimeResult = parseDateAndTime(cellValue);
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
            const parsedTime = parseTimeValue(cellValue);
            if (parsedTime) {
              expenseData.expense_time = parsedTime;
              stats.manualTimes += 1;
            }
            break;
          }
          case 'notes':
            expenseData.notes = cellValue;
            break;
        }
      });
    });

    if (!expenseData.amount || !expenseData.description) {
      return;
    }

    let cleanDescription = expenseData.description.trim();
    let notes = expenseData.notes?.trim() || '';
    let detectedCity: string | null = null;

    if (cleanDescription) {
      const cityParseResult = extractCityFromDescription(cleanDescription);
      if (cityParseResult.confidence > 0.6) {
        cleanDescription = cityParseResult.cleanDescription;
        if (!expenseData.city && cityParseResult.displayCity) {
          detectedCity = cityParseResult.displayCity;
        }
      }
    }

    const providedCity = expenseData.city?.trim();
    let finalCity = providedCity || detectedCity || '';
    let resolvedCityId: string | null = null;

    if (providedCity) {
      stats.manualCities += 1;
      const resolved = resolveCityByInput(providedCity);
      if (resolved) {
        finalCity = resolved.cityName;
        resolvedCityId = resolved.cityId;
      }
    } else if (detectedCity) {
      stats.autoDetectedCities += 1;
      const resolved = resolveCityByInput(detectedCity);
      if (resolved) {
        finalCity = resolved.cityName;
        resolvedCityId = resolved.cityId;
      }

      const reviewNote = `Автодетект города: ${finalCity || detectedCity}`;
      if (!notes.includes(reviewNote)) {
        notes = notes ? `${notes}\n${reviewNote}` : reviewNote;
      }

      reviewItems.push({
        type: 'city-from-description',
        rowIndex: dataRowIndex + 1,
        columnLabel: descriptionColumnLabel || getColumnLabel(descriptionColumnIndex ?? 0, headerRow),
        sourceValue: descriptionSourceValue,
        extractedCity: finalCity || detectedCity,
        cleanedDescription: cleanDescription,
      });
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
      tempId: expenseData.tempId!,
    });
  });

  stats.importedRows = newExpenses.length;
  stats.skippedRows = Math.max(stats.totalRows - stats.importedRows, 0);

  return { expenses: newExpenses, stats, reviewItems };
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
