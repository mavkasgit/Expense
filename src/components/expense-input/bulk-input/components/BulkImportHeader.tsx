'use client';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface BulkImportHeaderProps {
  onAddRow: () => void;
  onBrowse: () => void;
  onOpenColumnMapping: () => void;
  onOpenTableSelection: () => void;
  onResetTableIndex: () => void;
  isFileLoading: boolean;
  fileStatusMessage?: string;
  canChooseTable: boolean;
  hasSelectedTable: boolean;
  hasSavedColumnMapping: boolean;
  showResetTableButton: boolean;
  hasExpenses: boolean;
  onClear: () => void;
  onDirectSave: () => void;
  isSubmitting: boolean;
}

export function BulkImportHeader({
  onAddRow,
  onBrowse,
  onOpenColumnMapping,
  onOpenTableSelection,
  onResetTableIndex,
  isFileLoading,
  fileStatusMessage,
  canChooseTable,
  hasSelectedTable,
  hasSavedColumnMapping,
  showResetTableButton,
  hasExpenses,
  onClear,
  onDirectSave,
  isSubmitting,
}: BulkImportHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 space-y-1">
          <h2 className="text-xl font-semibold text-gray-900">Массовый ввод и банковские выписки</h2>
          <p className="text-sm text-gray-500">
            Загружайте таблицы, настраивайте соответствие столбцов и сохраняйте расходы за несколько кликов.
          </p>
        </div>

        <div className="flex w-full flex-col gap-4 sm:w-auto">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Таблицы и столбцы
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={onBrowse}
              disabled={isFileLoading}
              className={isFileLoading ? 'cursor-wait opacity-80' : undefined}
            >
              {isFileLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Обработка...
                </span>
              ) : (
                '📁 Загрузить файл'
              )}
            </Button>

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
                'pr-12 transition-all duration-200',
                hasSavedColumnMapping &&
                  'border-indigo-500 bg-indigo-50 text-indigo-600 shadow-[0_0_0_2px_rgba(79,70,229,0.18)] hover:bg-indigo-100',
              )}
            >
              <span className="inline-flex items-center gap-1">⚙️ Настройка столбцов</span>
            </Button>
            {hasSavedColumnMapping && (
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-600 shadow-sm">
                ✓ Настройки сохранены
              </span>
            )}

            {showResetTableButton && (
              <Button variant="outline" size="sm" onClick={onResetTableIndex}>
                ♻️ Сбросить выбор таблицы
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Строки и сохранение
            </span>

            <Button onClick={onAddRow} size="sm">
              + Добавить строку
            </Button>

            {hasExpenses && (
              <>
                <Button variant="outline" size="sm" onClick={onClear}>
                  🗑️ Очистить
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onDirectSave}
                  disabled={isSubmitting}
                  className={isSubmitting ? 'animate-pulse' : undefined}
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
              </>
            )}
          </div>
        </div>
      </div>

      {isFileLoading && fileStatusMessage && (
        <div className="flex items-center gap-2 text-sm text-blue-700" aria-live="polite">
          <span className="h-3 w-3 animate-spin rounded-full border border-blue-400 border-t-transparent" />
          <span>{fileStatusMessage}</span>
        </div>
      )}
    </div>
  );
}
