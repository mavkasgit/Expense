'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

function getPluralizedMappings(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) {
    return 'Настройка';
  }
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return 'Настройки';
  }
  return 'Настроек';
}

interface BulkImportHeaderProps {
  onOpenColumnMapping: () => void;
  onOpenColumnMappingWithData: () => void;
  onOpenTableSelection: () => void;
  onAddRows: (count: number) => void;
  isFileLoading: boolean;
  canChooseTable: boolean;
  hasSelectedTable: boolean;
  hasSavedColumnMapping: boolean;
  savedMappingCount?: number;
  hasExpenses: boolean;
  onClear: () => void;
  onDirectSave: () => void;
  isSubmitting: boolean;
  hasFileLoaded: boolean;
}

export function BulkImportHeader({
  onOpenColumnMapping,
  onOpenColumnMappingWithData,
  onOpenTableSelection,
  onAddRows,
  isFileLoading,
  canChooseTable,
  hasSelectedTable,
  hasSavedColumnMapping,
  savedMappingCount = 0,
  hasExpenses,
  onClear,
  onDirectSave,
  isSubmitting,
  hasFileLoaded,
}: BulkImportHeaderProps) {
  const [addCount, setAddCount] = useState(1);
  const canAddRows = !hasExpenses;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 space-y-1">
          <h2 className="text-xl font-semibold text-gray-900">Массовый ввод и банковские выписки</h2>
          <p className="text-sm text-gray-500">
            Загружайте таблицы, настраивайте соответствие столбцов и сохраняйте расходы за несколько кликов.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-lg border bg-gray-50 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-24">
                <Input
                  type="number"
                  min="1"
                  value={addCount}
                  onChange={e => setAddCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  aria-label="Количество строк для добавления"
                  className="text-sm"
                  disabled={!canAddRows}
                />
              </div>
              <Button
                onClick={() => onAddRows(addCount)}
                size="sm"
                disabled={!canAddRows}
                className={cn(!canAddRows && 'cursor-not-allowed opacity-70')}
              >
                {canAddRows ? '+ Добавить строки' : 'Строки добавлены'}
              </Button>
              {hasFileLoaded && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenColumnMappingWithData}
                  title="Открыть настройку столбцов с данными"
                  className="transition-all duration-200"
                >
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden>🔧</span>
                    <span>Настроить таблицу</span>
                  </span>
                </Button>
              )}
            </div>
            {!canAddRows && (
              <p className="text-xs text-gray-500">Добавьте новые строки через таблицу или очистите текущий список.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-gray-50 p-4">
            {canChooseTable && (
              <div className="relative inline-flex">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenTableSelection}
                  disabled={isFileLoading}
                  className={cn(
                    'pr-10 transition-all duration-200',
                    hasSelectedTable &&
                      'border-green-500 bg-green-50 text-green-700 shadow-[0_0_0_2px_rgba(34,197,94,0.18)] hover:bg-green-100',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden>📊</span>
                    <span>{hasSelectedTable ? 'Таблица выбрана' : 'Выбрать таблицу'}</span>
                  </span>
                </Button>
                {hasSelectedTable && (
                  <span className="pointer-events-none absolute -top-2 right-1 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-600 shadow-sm">
                    ✓ Готово
                  </span>
                )}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onOpenColumnMapping}
              title="Настроить соответствие столбцов для импорта"
              className={cn(
                'transition-all duration-200',
                hasSavedColumnMapping &&
                  'border-indigo-500 bg-indigo-50 text-indigo-600 shadow-[0_0_0_2px_rgba(79,70,229,0.18)] hover:bg-indigo-100',
              )}
            >
              <span className="inline-flex items-center gap-2">
                {hasSavedColumnMapping
                  ? `✓ ${savedMappingCount} ${getPluralizedMappings(savedMappingCount)} сохранено`
                  : '⚙️ Настройка столбцов'}
              </span>
            </Button>
          </div>
        </div>

        <div className="flex justify-end">
          <div className="flex w-full flex-wrap items-center gap-3 rounded-lg border bg-gray-50 p-4 lg:w-auto">
            <Button variant="outline" size="sm" onClick={onClear} disabled={!hasExpenses}>
              🗑️ Очистить
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onDirectSave}
              disabled={!hasExpenses || isSubmitting}
              className={cn(isSubmitting && 'animate-pulse', !hasExpenses && 'cursor-not-allowed opacity-70')}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Сохранение...
                </span>
              ) : (
                '💾 Сохранить'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
