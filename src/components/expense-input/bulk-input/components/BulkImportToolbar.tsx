'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import type { DataSourceFormat } from '../utils/storage';

interface BulkImportToolbarProps {
  onOpenColumnMapping: () => void;
  onOpenColumnMappingWithData: () => void;
  onOpenTableSelection: () => void;
  onAddRows: (count: number) => void;
  isFileLoading: boolean;
  canChooseTable: boolean;
  hasSelectedTable: boolean;
  hasSavedColumnMapping: boolean;
  hasFileLoaded: boolean;
  currentFormat?: DataSourceFormat | null;
}

export function BulkImportToolbar({
  onOpenColumnMapping,
  onOpenColumnMappingWithData,
  onOpenTableSelection,
  onAddRows,
  isFileLoading,
  canChooseTable,
  hasSelectedTable,
  hasSavedColumnMapping,
  hasFileLoaded,
  currentFormat,
}: BulkImportToolbarProps) {
  const [addCount, setAddCount] = useState('1');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Проверка валидности введенного числа
  const isValidCount = addCount.trim() !== '' && !isNaN(Number(addCount)) && Number(addCount) >= 1;
  
  const handleAddRows = () => {
    if (!isValidCount) return;
    const count = Math.max(1, parseInt(addCount, 10) || 1);
    onAddRows(count);
    setAddCount('1');
    inputRef.current?.blur();
  };

  const formatIcons: Record<string, string> = {
    csv: '📄',
    xlsx: '📊',
    xls: '📊',
    html: '🌐',
    clipboard: '📋',
    unknown: '📁'
  };
  
  const formatLabels: Record<string, string> = {
    csv: 'CSV',
    xlsx: 'Excel',
    xls: 'Excel',
    html: 'HTML',
    clipboard: 'Буфер обмена',
    unknown: 'Формат'
  };

  const formatIcon = currentFormat ? formatIcons[currentFormat] || '⚙️' : '⚙️';
  const formatLabel = currentFormat ? formatLabels[currentFormat] || 'Настройки' : 'Настройки';

  return (
    <div className="flex flex-col gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 space-y-1">
          <h2 className="text-xl font-semibold text-gray-900">Массовый ввод и банковские выписки</h2>
          <p className="text-sm text-gray-500">
            Загружайте таблицы, настраивайте соответствие столбцов и сохраняйте расходы за несколько кликов.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-24">
            <Input
              ref={inputRef}
              type="number"
              min="1"
              value={addCount}
              onChange={e => setAddCount(e.target.value)}
              onFocus={e => e.target.select()}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleAddRows();
                }
              }}
              aria-label="Количество строк для добавления"
              className={cn(
                "text-sm",
                !isValidCount && "border-red-500 focus:border-red-500 focus:ring-red-500"
              )}
            />
          </div>
          <Button
            onClick={handleAddRows}
            size="sm"
            disabled={!isValidCount}
          >
            + Добавить строки
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
                ? `Настройка ${formatIcon} ${formatLabel}`
                : '⚙️ Настройка столбцов'}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}