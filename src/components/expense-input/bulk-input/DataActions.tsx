'use client'

import { Button } from '@/components/ui/Button';
import type { ColumnMapping } from '@/types';
import type { ToastType } from '@/hooks/useToast';

interface DataActionsProps {
  fileContent: string | null;
  availableTables: any[];
  setShowTableSelection: (value: boolean) => void;
  isFileLoading: boolean;
  loadSavedColumnMapping: () => ColumnMapping[];
  setPastedData: (data: string[][]) => void;
  setHasHeaderRow: (value: boolean) => void;
  setIsEditingColumnMapping: (value: boolean) => void;
  setIsColumnMappingOpen: (value: boolean) => void;
  isMounted: boolean;
  savedColumnMapping: ColumnMapping[] | null;
  savedTableIndex: number | null;
  clearSavedTableIndex: () => void;
  showToast: (message: string, type?: ToastType) => void;
  selectedTableMeta: any;
  expensesLength: number;
  handleClear: () => void;
  handleDirectSave: () => void;
  isSubmitting: boolean;
}

export function DataActions({ 
  fileContent, availableTables, setShowTableSelection, isFileLoading, loadSavedColumnMapping, setPastedData, setHasHeaderRow, setIsEditingColumnMapping, setIsColumnMappingOpen, isMounted, savedColumnMapping, savedTableIndex, clearSavedTableIndex, showToast, selectedTableMeta, expensesLength, handleClear, handleDirectSave, isSubmitting
}: DataActionsProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mt-4 pt-4 border-t border-gray-200">
      <h2 className="text-xl font-semibold text-gray-900 flex-1">
        Структура и данные
      </h2>

      <div className="flex flex-wrap items-center gap-3">
        {fileContent && availableTables.length > 1 && (
          <Button variant="outline" size="sm" onClick={() => setShowTableSelection(true)} disabled={isFileLoading}>
            📊 Выбрать таблицу
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const savedMapping = loadSavedColumnMapping();
            const sampleData = savedMapping.length > 0
              ? [savedMapping.map((_, index) => `Столбец ${String.fromCharCode(65 + index)}`)]
              : [['Столбец A', 'Столбец B', 'Столбец C', 'Столбец D']];
            setPastedData(sampleData);
            setHasHeaderRow(false);
            setIsEditingColumnMapping(true);
            setIsColumnMappingOpen(true);
          }}
          title="Настроить порядок столбцов для вставки данных"
        >
          ⚙️ Настройка столбцов <span className={`ml-1 text-xs ${isMounted && (savedColumnMapping || savedTableIndex !== null) ? 'opacity-100' : 'opacity-0'}`}>●</span>
        </Button>

        {isMounted && savedTableIndex !== null && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { clearSavedTableIndex(); showToast('Сохраненный выбор таблицы очищен', 'info'); }}
          >
            ♻️ Сбросить выбор таблицы
          </Button>
        )}

        {selectedTableMeta && (
          <div className="w-full rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            <span className="font-medium">Текущая таблица:</span> {selectedTableMeta.description}
            <span className="ml-2 text-blue-600">({selectedTableMeta.rowCount} строк, {selectedTableMeta.columnCount} столбцов, {selectedTableMeta.hasHeaders ? ' есть заголовок' : ' без заголовка'})</span>
          </div>
        )}

        {expensesLength > 0 && (
          <>
            <div className="h-6 w-px bg-gray-300"></div>
            <Button variant="outline" size="sm" onClick={handleClear}>🗑️ Очистить</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDirectSave}
              disabled={isSubmitting}
              className={isSubmitting ? 'animate-pulse' : ''}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
  );
}
