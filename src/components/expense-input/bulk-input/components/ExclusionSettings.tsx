'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

// Компонент подсказки
function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  return (
    <div className="relative group">
      {children}
      {/* Tooltip справа от элемента */}
      <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-4 py-3 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[10000] break-words shadow-lg" style={{maxWidth: '400px', width: 'max-content', minWidth: '200px'}}>
        {content}
        {/* Стрелка слева */}
        <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
      </div>
    </div>
  )
}

interface ExclusionSettingsProps {
  sampleData: string[][];
  onExclusionsChange: (exclusions: string[]) => void;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  skipFirstRow: boolean;
  onSkipFirstRowChange: (value: boolean) => void;
}

// Ключ для localStorage
const EXCLUSIONS_STORAGE_KEY = 'bulkImport_exclusions';

// Загрузка исключений из localStorage
function loadExclusions(): string[] {
  try {
    const stored = localStorage.getItem(EXCLUSIONS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Сохранение исключений в localStorage
function saveExclusions(exclusions: string[]): void {
  try {
    localStorage.setItem(EXCLUSIONS_STORAGE_KEY, JSON.stringify(exclusions));
  } catch {
    // Игнорируем ошибки сохранения
  }
}

// Проверка содержит ли строка исключающее слово
function containsExclusion(rowData: string[], exclusions: string[]): boolean {
  if (exclusions.length === 0) return false;
  
  const fullRowText = rowData.join(' ').toLowerCase();
  return exclusions.some(exclusion => 
    exclusion.trim() && fullRowText.includes(exclusion.toLowerCase())
  );
}

// Проверка содержит ли строка конкретное исключающее слово
function containsSpecificExclusion(rowData: string[], exclusion: string): boolean {
  if (!exclusion.trim()) return false;
  
  const fullRowText = rowData.join(' ').toLowerCase();
  return fullRowText.includes(exclusion.toLowerCase());
}

export function ExclusionSettings({
  sampleData,
  onExclusionsChange,
  isCollapsed,
  onToggleCollapsed,
  skipFirstRow,
  onSkipFirstRowChange,
}: ExclusionSettingsProps) {
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [newExclusion, setNewExclusion] = useState('');
  const [previewMode, setPreviewMode] = useState<'all' | 'excluded' | 'included'>('all');
  const [isFullPreviewOpen, setIsFullPreviewOpen] = useState(false);
  const [selectedExclusionForPreview, setSelectedExclusionForPreview] = useState<string | null>(null);

  // Загружаем исключения при монтировании
  useEffect(() => {
    const loaded = loadExclusions();
    setExclusions(loaded);
    onExclusionsChange(loaded);
  }, [onExclusionsChange]);

  // Добавление нового исключения
  const handleAddExclusion = useCallback(() => {
    const trimmed = newExclusion.trim();
    if (!trimmed || exclusions.includes(trimmed)) return;

    const updated = [...exclusions, trimmed];
    setExclusions(updated);
    saveExclusions(updated);
    onExclusionsChange(updated);
    setNewExclusion('');
  }, [newExclusion, exclusions, onExclusionsChange]);

  // Удаление исключения
  const handleRemoveExclusion = useCallback((exclusion: string) => {
    const updated = exclusions.filter(e => e !== exclusion);
    setExclusions(updated);
    saveExclusions(updated);
    onExclusionsChange(updated);
  }, [exclusions, onExclusionsChange]);

  // Показать строки для конкретного исключения
  const handleShowExclusionPreview = useCallback((exclusion: string) => {
    setSelectedExclusionForPreview(exclusion);
    setIsFullPreviewOpen(true);
  }, []);

  // Подсчет исключенных строк
  const excludedByWordsCount = sampleData.filter((row, index) => 
    (index === 0 && skipFirstRow) ? false : containsExclusion(row, exclusions)
  ).length;

  const excludedCount = excludedByWordsCount + (skipFirstRow ? 1 : 0);
  const includedCount = sampleData.length - excludedCount;

  // Фильтрация данных для предпросмотра
  const filteredData = sampleData.filter((row, index) => {
    const isExcludedByWord = containsExclusion(row, exclusions);
    const isFirstRow = index === 0 && skipFirstRow;
    const isExcluded = isExcludedByWord || isFirstRow;

    if (previewMode === 'excluded') return isExcluded;
    if (previewMode === 'included') return !isExcluded;
    return true;
  });

  // Данные для модального окна (все строки или для конкретного исключения)
  const modalData = selectedExclusionForPreview
    ? sampleData.filter(row => containsSpecificExclusion(row, selectedExclusionForPreview))
    : filteredData;

  return (
    <div className="mb-6 bg-red-50 border border-red-200 rounded-lg">
      <div 
        className="flex items-center justify-between gap-4 cursor-pointer hover:bg-red-100 p-3 rounded-t-lg"
        onClick={onToggleCollapsed}
      >
        <div className="flex items-center gap-2">
          <span 
            className="text-red-500 text-lg transition-transform" 
            style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          >
            ▼
          </span>
          <span className="text-lg" aria-hidden>🚫</span>
          <h3 className="font-medium text-red-900">Исключения</h3>
          <Tooltip content="Добавьте слова или фразы, которые будут исключать строки из импорта.">
            <div className="w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs cursor-help">
              ?
            </div>
          </Tooltip>
          {excludedCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 whitespace-nowrap">
              {excludedCount} строк
            </span>
          )}
          {exclusions.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 whitespace-nowrap">
              {exclusions.length} слов
            </span>
          )}
        </div>
        <p className="text-xs text-red-600 hidden sm:block">
          Строки содержащие эти слова или первая строка будут исключены
        </p>
      </div>

      {!isCollapsed && (
        <div className="space-y-4 p-4 border-t border-red-200">
          <div className="flex flex-col md:flex-row items-start justify-between gap-4">
            {/* Левая колонка для слов */}
            <div className="flex-1 w-full space-y-3">
              <div className="text-sm font-medium text-gray-700">Исключающие слова:</div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Введите слово или фразу..."
                  value={newExclusion}
                  onChange={(e) => setNewExclusion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddExclusion();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={handleAddExclusion}
                  disabled={!newExclusion.trim() || exclusions.includes(newExclusion.trim())}
                  size="sm"
                >
                  Добавить
                </Button>
              </div>
              {exclusions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {exclusions.map((exclusion, index) => {
                    const exclusionCount = sampleData.filter(row => 
                      containsSpecificExclusion(row, exclusion)
                    ).length;
                    
                    return (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-300 px-3 py-1 text-sm text-red-800 group"
                      >
                        <button
                          type="button"
                          onClick={() => handleShowExclusionPreview(exclusion)}
                          className="hover:underline cursor-pointer"
                          title={`Показать ${exclusionCount} исключенных строк`}
                        >
                          &quot;{exclusion}&quot; ({exclusionCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveExclusion(exclusion)}
                          className="ml-1 flex items-center justify-center h-4 w-4 rounded-full hover:bg-red-200 transition-colors"
                          title="Удалить"
                        >
                          <span className="text-xs leading-none">✕</span>
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Правая колонка для других исключений */}
            <div className="w-full md:w-1/3 space-y-3">
              <div className="text-sm font-medium text-gray-700">Другие исключения:</div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="skip-first-row"
                  checked={skipFirstRow}
                  onChange={(e) => onSkipFirstRowChange(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                />
                <label htmlFor="skip-first-row" className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer whitespace-nowrap">
                  <span>📋</span>
                  <span>Исключить первую строку</span>
                </label>
              </div>
            </div>
          </div>

          {/* Статистика и предпросмотр */}
          {sampleData.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-red-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-700">
                    ✅ Будет импортировано: {includedCount}
                  </span>
                  <span className="text-red-700">
                    🚫 Будет исключено: {excludedCount}
                  </span>
                </div>
                
                {(excludedCount > 0 || exclusions.length > 0) && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Показать:</span>
                    <div className="flex rounded-md border border-gray-300 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setPreviewMode('all')}
                        className={`px-2 py-1 text-xs transition-colors ${
                          previewMode === 'all'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        Все
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewMode('included')}
                        className={`px-2 py-1 text-xs transition-colors border-l border-gray-300 ${
                          previewMode === 'included'
                            ? 'bg-green-500 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        Включенные
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewMode('excluded')}
                        className={`px-2 py-1 text-xs transition-colors border-l border-gray-300 ${
                          previewMode === 'excluded'
                            ? 'bg-red-500 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                        disabled={excludedCount === 0}
                      >
                        Исключенные
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Предпросмотр данных */}
              {filteredData.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <tbody>
                        {filteredData.slice(0, 10).map((row, index) => {
                          const originalIndex = sampleData.indexOf(row);
                          const isExcludedByWord = containsExclusion(row, exclusions);
                          const isFirstRow = originalIndex === 0 && skipFirstRow;
                          const isExcluded = isExcludedByWord || isFirstRow;
                          return (
                            <tr 
                              key={originalIndex} 
                              className={`border-b hover:bg-gray-50 ${
                                isExcluded ? 'bg-red-50 text-red-800' : ''
                              }`}
                            >
                              <td className="px-2 py-1 text-gray-500 w-8">
                                {isExcluded ? '🚫' : '✅'}
                              </td>
                              <td className="px-2 py-1">
                                {row.join(' | ')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {filteredData.length > 10 && (
                    <div className="px-3 py-2 bg-gray-50 border-t">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedExclusionForPreview(null);
                          setIsFullPreviewOpen(true);
                        }}
                        className="w-full text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline transition-colors"
                      >
                        📊 Показать все записи ({filteredData.length} строк)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Модальное окно полного предпросмотра */}
      <Modal
        isOpen={isFullPreviewOpen}
        onClose={() => {
          setIsFullPreviewOpen(false);
          setSelectedExclusionForPreview(null);
        }}
        title={
          selectedExclusionForPreview
            ? `Строки исключенные словом "${selectedExclusionForPreview}"`
            : `Предпросмотр данных (${modalData.length} строк)`
        }
        size="lg"
      >
        <div className="space-y-4">
          {selectedExclusionForPreview && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-red-600">🚫</span>
                <span className="font-medium text-red-800">
                  Исключающее слово: &quot;{selectedExclusionForPreview}&quot;
                </span>
                <span className="text-red-600">
                  ({modalData.length} из {sampleData.length} строк)
                </span>
              </div>
            </div>
          )}
          
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left text-gray-600 w-8">Статус</th>
                    <th className="px-2 py-2 text-left text-gray-600">Данные</th>
                  </tr>
                </thead>
                <tbody>
                  {modalData.map((row, index) => {
                    const originalIndex = sampleData.indexOf(row);
                    const isExcludedByWord = containsExclusion(row, exclusions);
                    const isFirstRow = originalIndex === 0 && skipFirstRow;
                    const isExcluded = isExcludedByWord || isFirstRow;
                    
                    return (
                      <tr 
                        key={index} 
                        className={`border-b hover:bg-gray-50 ${
                          isExcluded ? 'bg-red-50' : ''
                        }`}
                      >
                        <td className="px-2 py-2 text-center">
                          {isExcluded ? '🚫' : '✅'}
                        </td>
                        <td className="px-2 py-2 font-mono text-xs">
                          {row.join(' | ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setIsFullPreviewOpen(false);
                setSelectedExclusionForPreview(null);
              }}
            >
              Закрыть
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}