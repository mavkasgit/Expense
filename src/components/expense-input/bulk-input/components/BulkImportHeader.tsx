'use client';

import { Button } from '@/components/ui/Button';

interface BulkImportHeaderProps {
  autoRedirect: boolean;
  onToggleAutoRedirect: () => void;
  onAddRow: () => void;
  onBrowse: () => void;
  onOpenColumnMapping: () => void;
  onOpenTableSelection: () => void;
  onResetTableIndex: () => void;
  isFileLoading: boolean;
  fileStatusMessage?: string;
  canChooseTable: boolean;
  hasSavedIndicator: boolean;
  showResetTableButton: boolean;
  hasExpenses: boolean;
  onClear: () => void;
  onDirectSave: () => void;
  isSubmitting: boolean;
}

export function BulkImportHeader({
  autoRedirect,
  onToggleAutoRedirect,
  onAddRow,
  onBrowse,
  onOpenColumnMapping,
  onOpenTableSelection,
  onResetTableIndex,
  isFileLoading,
  fileStatusMessage,
  canChooseTable,
  hasSavedIndicator,
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

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onToggleAutoRedirect}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors ${
              autoRedirect ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-300 text-gray-600'
            }`}
          >
            <span
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                autoRedirect ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  autoRedirect ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </span>
            Автопереход
          </button>

          <Button onClick={onAddRow} size="sm">
            + Добавить строку
          </Button>

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
            <Button variant="outline" size="sm" onClick={onOpenTableSelection} disabled={isFileLoading}>
              📊 Выбрать таблицу
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenColumnMapping}
            title="Настроить соответствие столбцов для импорта"
          >
            <span className="inline-flex items-center gap-1">
              ⚙️ Настройка столбцов
              <span
                className={`ml-1 inline-flex h-2 w-2 rounded-full transition-opacity ${
                  hasSavedIndicator ? 'bg-blue-500 opacity-100' : 'opacity-0'
                }`}
              />
            </span>
          </Button>

          {showResetTableButton && (
            <Button variant="outline" size="sm" onClick={onResetTableIndex}>
              ♻️ Сбросить выбор таблицы
            </Button>
          )}

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

      {isFileLoading && fileStatusMessage && (
        <div className="flex items-center gap-2 text-sm text-blue-700" aria-live="polite">
          <span className="h-3 w-3 animate-spin rounded-full border border-blue-400 border-t-transparent" />
          <span>{fileStatusMessage}</span>
        </div>
      )}
    </div>
  );
}
