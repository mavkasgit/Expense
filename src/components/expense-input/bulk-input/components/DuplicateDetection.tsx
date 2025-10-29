'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { checkForDuplicates, type DuplicateCheckResult } from '@/lib/actions/expenses';
import type { BulkExpenseRowData } from '@/lib/validations/expenses';
import type { CreateExpenseData } from '@/types';
import { useToast } from '@/hooks/useToast';

// Компонент подсказки
function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  return (
    <div className="relative group">
      {children}
      <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-4 py-3 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[10000] break-words shadow-lg" style={{maxWidth: '400px', width: 'max-content', minWidth: '200px'}}>
        {content}
        <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
      </div>
    </div>
  )
}

interface DuplicateDetectionProps {
  expenses: BulkExpenseRowData[];
  onDuplicatesFound: (duplicateIndices: Set<number>) => void;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}

interface DuplicateFields {
  amount: boolean;
  date: boolean;
  description: boolean;
  time: boolean;
}

const DUPLICATE_FIELDS_KEY = 'bulkImport_duplicateFields';

function loadDuplicateFields(): DuplicateFields {
  if (typeof window === 'undefined') {
    return { amount: true, date: true, description: false, time: false };
  }
  
  try {
    const stored = localStorage.getItem(DUPLICATE_FIELDS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Дополняем недостающие поля для обратной совместимости
      return {
        amount: parsed.amount ?? true,
        date: parsed.date ?? true,
        description: parsed.description ?? false,
        time: parsed.time ?? false
      };
    }
    return { amount: true, date: true, description: false, time: false };
  } catch {
    return { amount: true, date: true, description: false, time: false };
  }
}

function saveDuplicateFields(fields: DuplicateFields): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(DUPLICATE_FIELDS_KEY, JSON.stringify(fields));
  } catch {
    // Игнорируем ошибки сохранения
  }
}

export function DuplicateDetection({ 
  expenses, 
  onDuplicatesFound, 
  isCollapsed, 
  onToggleCollapsed 
}: DuplicateDetectionProps) {
  
  const { showToast } = useToast();
  const [compareFields, setCompareFields] = useState<DuplicateFields>({ amount: true, date: true, description: false, time: false });
  const [isChecking, setIsChecking] = useState(false);
  const [duplicateResults, setDuplicateResults] = useState<Record<number, DuplicateCheckResult> | null>(null);
  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set());
  const [previewMode, setPreviewMode] = useState<'all' | 'duplicates' | 'unique'>('all');
  const [isFullPreviewOpen, setIsFullPreviewOpen] = useState(false);
  const [timerProgress, setTimerProgress] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  // Загружаем настройки при монтировании
  useEffect(() => {
    const loaded = loadDuplicateFields();
    setCompareFields(loaded);
  }, []);



  // Проверка дубликатов
  const handleCheckDuplicates = useCallback(async () => {
    if (expenses.length === 0) return;

    setIsChecking(true);
    setTimerProgress(0);

    const timer = setInterval(() => {
        setTimerProgress(prev => prev + 1);
    }, 1000);

    try {
      // Конвертируем данные для API
      const expensesToCheck: CreateExpenseData[] = expenses.map(expense => ({
        amount: expense.amount,
        description: expense.description,
        notes: expense.notes || '',
        category_id: expense.category_id || undefined,
        expense_date: expense.expense_date,
        expense_time: expense.expense_time || null,
        city_id: expense.city_id || undefined,
        city_input: expense.city || undefined,
        input_method: 'bulk_table'
      }));

      console.log('🔍 Отправляем на проверку:', {
        count: expensesToCheck.length,
        compareFields,
        sample: expensesToCheck[0]
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Превышено время ожидания проверки дубликатов')), 15000)
      );

      const result = await Promise.race([
        checkForDuplicates(expensesToCheck, compareFields),
        timeoutPromise
      ]);

      if (typeof result === 'undefined' || (result as {error: string}).error) {
        const errorMessage = (result as {error: string})?.error || 'Результат не определен';
        console.error('Ошибка проверки дубликатов:', errorMessage);
        showToast(errorMessage, 'error');
        return;
      }

      console.log('🔍 Получен результат:', result);

      setDuplicateResults((result as any).results);
      
      // Находим индексы с дубликатами
      const duplicateIndices = new Set<number>();
      Object.entries((result as any).results).forEach(([index, duplicateResult]) => {
        if ((duplicateResult as any).hasDuplicates) {
          duplicateIndices.add(parseInt(index));
        }
      });

      setExcludedIndices(duplicateIndices);
      onDuplicatesFound(duplicateIndices);

    } catch (error) {
      console.error('Ошибка при проверке дубликатов:', error);
      showToast(error instanceof Error ? error.message : 'Произошла неизвестная ошибка', 'error');
    } finally {
      setIsChecking(false);
      clearInterval(timer);
      setTimerProgress(0);
      setIsFinished(true);
      setTimeout(() => setIsFinished(false), 2000);
    }
  }, [expenses, compareFields, onDuplicatesFound, showToast]);

  // Сохраняем настройки при изменении
  const updateCompareFields = useCallback((field: keyof DuplicateFields, value: boolean) => {
    const updated = { ...compareFields, [field]: value };
    setCompareFields(updated);
    saveDuplicateFields(updated);
  }, [compareFields]);

  const duplicatesCount = duplicateResults 
    ? Object.values(duplicateResults).filter(result => result.hasDuplicates).length 
    : 0;

  const includedCount = expenses.length - excludedIndices.size;

  // Фильтрация данных для предпросмотра
  const filteredResults = duplicateResults 
    ? Object.entries(duplicateResults).filter(([_, result]) => {
        if (previewMode === 'duplicates') return result.hasDuplicates;
        if (previewMode === 'unique') return !result.hasDuplicates;
        return true;
      })
    : [];

  return (
    <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg">
      <div 
        className="flex items-center justify-between gap-4 cursor-pointer hover:bg-orange-100 p-3 rounded-t-lg"
        onClick={onToggleCollapsed}
      >
        <div className="flex items-center gap-2">
          <span 
            className="text-orange-500 text-lg transition-transform" 
            style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          >
            ▼
          </span>
          <span className="text-lg" aria-hidden>🔍</span>
          <h3 className="font-medium text-orange-900">Поиск дубликатов</h3>
          <Tooltip content="Автоматически проверяет наличие дубликатов с существующими расходами в базе данных.">
            <div className="w-4 h-4 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs cursor-help">
              ?
            </div>
          </Tooltip>
          {duplicatesCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
              {duplicatesCount} дубликатов
            </span>
          )}
        </div>
        <p className="text-xs text-orange-600 hidden sm:block">
          Сравнение с существующими расходами в базе данных
        </p>
      </div>

      {!isCollapsed && (
        <div className="space-y-4 p-4 border-t border-orange-200">
          {/* Выбор полей для сравнения */}
          <div>
            <div className="text-sm font-medium text-gray-700 mb-3">
              Поля для сравнения:
            </div>
            <div className="flex items-center justify-between gap-3">
              {/* 4 кнопки слева */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateCompareFields('date', !compareFields.date)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 transition-all ${
                    compareFields.date
                      ? 'bg-green-100 border-green-300 text-green-800'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-base">📅</span>
                  <span className="text-xs font-medium">Дата</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => updateCompareFields('amount', !compareFields.amount)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 transition-all ${
                    compareFields.amount
                      ? 'bg-blue-100 border-blue-300 text-blue-800'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-base">💰</span>
                  <span className="text-xs font-medium">Сумма</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => updateCompareFields('description', !compareFields.description)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 transition-all ${
                    compareFields.description
                      ? 'bg-purple-100 border-purple-300 text-purple-800'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-base">📝</span>
                  <span className="text-xs font-medium">Описание</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => updateCompareFields('time', !compareFields.time)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 transition-all ${
                    compareFields.time
                      ? 'bg-teal-100 border-teal-300 text-teal-800'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-base">⏰</span>
                  <span className="text-xs font-medium">Время</span>
                </button>
              </div>

              {/* Кнопка поиска справа */}
              <button
                type="button"
                onClick={handleCheckDuplicates}
                disabled={isChecking || isFinished}
                className={`relative flex items-center gap-2 px-6 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap min-w-[180px] justify-center overflow-hidden ${
                    isFinished 
                        ? 'bg-green-500 text-white' 
                        : 'bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white'
                }`}
              >
                {isChecking && (
                    <div 
                        className="absolute top-0 left-0 h-full bg-orange-500/50"
                        style={{ width: `${(timerProgress / 15) * 100}%`, transition: 'width 1s linear' }}
                    ></div>
                )}
                <span className="relative z-10">
                    {isFinished ? (
                        '✅ Готово'
                    ) : isChecking ? (
                        'Проверяем...'
                    ) : (
                        '🔍 Найти дубликаты'
                    )}
                </span>
              </button>
            </div>
            {!compareFields.amount && !compareFields.date && !compareFields.description && !compareFields.time && (
              <p className="text-xs text-red-600 mt-2">Выберите хотя бы одно поле для сравнения</p>
            )}
          </div>

          {/* Статистика и предпросмотр */}
          {duplicateResults && expenses.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-700">
                    ✅ Будет импортировано: {includedCount}
                  </span>
                  <span className="text-orange-700">
                    🔍 Найдено дубликатов: {duplicatesCount}
                  </span>
                </div>
                
                {(duplicatesCount > 0 || Object.keys(duplicateResults).length > 0) && (
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
                        onClick={() => setPreviewMode('unique')}
                        className={`px-2 py-1 text-xs transition-colors border-l border-gray-300 ${
                          previewMode === 'unique'
                            ? 'bg-green-500 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        Уникальные
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewMode('duplicates')}
                        className={`px-2 py-1 text-xs transition-colors border-l border-gray-300 ${
                          previewMode === 'duplicates'
                            ? 'bg-orange-500 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                        disabled={duplicatesCount === 0}
                      >
                        Дубликаты
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Предпросмотр данных */}
              {filteredResults.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                  <div className="max-h-48 overflow-y-auto">
                    <div className="space-y-2 p-2">
                      {filteredResults.slice(0, 5).map(([index, result]) => {
                        const expenseIndex = parseInt(index);
                        const expense = expenses[expenseIndex];
                        const isDuplicate = result.hasDuplicates;
                        
                        return (
                          <div key={index} className={`border rounded p-2 text-xs ${
                            isDuplicate ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'
                          }`}>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{isDuplicate ? '🔍' : '✅'}</span>
                              <span className="font-medium">Строка {expenseIndex + 1}:</span>
                              <span>💰 {expense.amount.toFixed(2)}</span>
                              <span>📝 {expense.description}</span>
                              <span>📅 {expense.expense_date}</span>
                              {expense.expense_time && <span>⏰ {expense.expense_time}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {filteredResults.length > 5 && (
                    <div className="px-3 py-2 bg-gray-50 border-t">
                      <button
                        type="button"
                        onClick={() => setIsFullPreviewOpen(true)}
                        className="w-full text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline transition-colors"
                      >
                        📊 Показать все записи ({filteredResults.length} строк)
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
        onClose={() => setIsFullPreviewOpen(false)}
        title={`Предпросмотр дубликатов (${filteredResults.length} записей)`}
        size="xl"
      >
        <div className="space-y-4">
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm mb-2">
              <span className="text-orange-600">🔍</span>
              <span className="font-medium text-orange-800">
                {duplicatesCount > 0 ? 'Обнаружены возможные дубликаты' : 'Дубликаты не найдены'}
              </span>
              <span className="text-orange-600">
                ({duplicatesCount} из {expenses.length} записей)
              </span>
            </div>
            {duplicateResults && Object.values(duplicateResults).some(r => r.hasDuplicates) && (
              <div className="flex items-center gap-2 text-xs mt-2">
                <span className="text-gray-600">Совпадения:</span>
                {(() => {
                  const allMatchedFields = new Set<string>();
                  Object.values(duplicateResults).forEach(result => {
                    if (result.hasDuplicates) {
                      result.matches[0]?.matchedFields.forEach(field => allMatchedFields.add(field));
                    }
                  });
                  return Array.from(allMatchedFields).map(field => (
                    <span key={field} className="bg-green-100 text-green-700 px-1 py-0.5 rounded">
                      {field === 'amount' ? 'сумма' : field === 'date' ? 'дата' : field === 'time' ? 'время' : 'описание'}
                    </span>
                  ));
                })()}
              </div>
            )}
          </div>
          
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <div className="max-h-96 overflow-y-auto space-y-2 p-2">
              {filteredResults.map(([index, result]) => {
                const expenseIndex = parseInt(index);
                const expense = expenses[expenseIndex];
                const isDuplicate = result.hasDuplicates;
                
                if (!isDuplicate) {
                  return (
                    <div key={index} className="border border-green-200 rounded p-2 text-xs bg-green-50">
                      <div className="flex items-center gap-3 p-2 rounded">
                        <span className="text-sm font-medium text-gray-700 min-w-[60px]">Строка {expenseIndex + 1}</span>
                        <span className="text-xs font-medium text-green-700 min-w-[140px]">✅ Уникальная запись:</span>
                        <div className="flex items-center gap-4 flex-1">
                          <span>💰 {expense.amount.toFixed(2)}</span>
                          <span>📝 {expense.description}</span>
                          <span>📅 {expense.expense_date}</span>
                          {expense.expense_time && <span>⏰ {expense.expense_time}</span>}
                        </div>
                      </div>
                    </div>
                  );
                }
                
                const bestMatch = result.matches[0];
                return (
                  <div key={index} className="border border-gray-200 rounded p-2 text-xs">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 bg-blue-50 p-2 rounded text-xs">
                        <span className="text-sm font-medium text-gray-700 min-w-[60px]">Строка {expenseIndex + 1}</span>
                        <span className="font-medium text-blue-700 min-w-[140px]">Импортируемая запись:</span>
                        <div className="flex items-center gap-4 flex-1">
                          <span>💰 {expense.amount.toFixed(2)}</span>
                          <span>📝 {expense.description}</span>
                          <span>📅 {expense.expense_date}</span>
                          {expense.expense_time && <span>⏰ {expense.expense_time}</span>}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 bg-orange-50 p-2 rounded text-xs">
                        <span className="min-w-[60px]"></span>
                        <span className="font-medium text-orange-700 min-w-[140px]">Существующая запись:</span>
                        <div className="flex items-center gap-4 flex-1">
                          <span>💰 {bestMatch.existingExpense.amount.toFixed(2)}</span>
                          <span>📝 {bestMatch.existingExpense.description}</span>
                          <span>📅 {bestMatch.existingExpense.expense_date}</span>
                          {bestMatch.existingExpense.expense_time && <span>⏰ {bestMatch.existingExpense.expense_time}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-600">
              {duplicatesCount > 0 ? 'Дубликаты будут исключены из импорта' : 'Все записи готовы к импорту'}
            </div>
            <div className="flex gap-2">
              {duplicatesCount > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setExcludedIndices(new Set());
                    onDuplicatesFound(new Set());
                  }}
                >
                  Импортировать все
                </Button>
              )}
              <Button
                onClick={() => setIsFullPreviewOpen(false)}
              >
                Закрыть
              </Button>
            </div>
          </div>
        </div>
      </Modal>

    </div>
  );
}