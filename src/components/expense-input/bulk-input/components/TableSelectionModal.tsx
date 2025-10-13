'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { TableInfo } from '@/lib/utils/bankStatementParsers';

interface TableSelectionModalProps {
  isOpen: boolean;
  tables: TableInfo[];
  savedTableIndex: number | null;
  isLoading: boolean;
  onSelect: (index: number) => void;
  onPreview: (index: number) => void;
  onClose: () => void;
}

export function TableSelectionModal({
  isOpen,
  tables,
  savedTableIndex,
  isLoading,
  onSelect,
  onPreview,
  onClose,
}: TableSelectionModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Выбор таблицы" size="xl">
      {tables.length > 0 && (
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            Найдено {tables.length} таблиц. Выберите таблицу для импорта:
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {tables.map((table, index) => {
              const isSaved = savedTableIndex !== null && savedTableIndex === index;
              const baseClasses = isSaved
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50';
              return (
                <div
                  key={index}
                  className={`p-4 border rounded-lg transition-colors ${baseClasses} ${
                    isLoading ? 'cursor-wait opacity-60' : 'cursor-pointer'
                  }`}
                  tabIndex={isLoading ? -1 : 0}
                  aria-disabled={isLoading}
                  onClick={() => {
                    if (!isLoading) {
                      onSelect(index);
                    }
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      if (!isLoading) {
                        onSelect(index);
                      }
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{table.description}</h3>
                      <p className="text-sm text-gray-500">
                        {table.rowCount} строк, {table.columnCount} столбцов
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {table.hasHeaders ? 'Содержит строку заголовков' : 'Без отдельной строки заголовков'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {isSaved && <div className="text-blue-600 text-sm font-medium">✓ Ранее</div>}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={event => {
                          event.stopPropagation();
                          onPreview(index);
                        }}
                      >
                        Предпросмотр
                      </Button>
                    </div>
                  </div>

                  {table.preview.length > 0 && (
                    <div className="mt-3 overflow-hidden rounded-md border bg-white">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-xs">
                          <tbody className="divide-y divide-gray-100">
                            {table.preview.map((previewRow, previewIndex) => (
                              <tr key={previewIndex} className="bg-white">
                                {previewRow.map((cell, cellIndex) => (
                                  <td
                                    key={cellIndex}
                                    className={`px-3 py-2 whitespace-nowrap ${
                                      previewIndex === 0 ? 'font-medium text-gray-900' : 'text-gray-600'
                                    }`}
                                  >
                                    {cell || '—'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Отмена
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
