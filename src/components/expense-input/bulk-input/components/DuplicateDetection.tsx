'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { checkForDuplicates, type DuplicateCheckResult } from '@/lib/actions/expenses';
import type { BulkExpenseRowData } from '@/lib/validations/expenses';
import type { CreateExpenseData } from '@/types';

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
  
  const [compareFields, setCompareFields] = useState<DuplicateFields>({ amount: true, date: true, description: false, time: false });
  const [isChecking, setIsChecking] = useState(false);
  const [duplicateResults, setDuplicateResults] = useState<Record<number, DuplicateCheckResult> | null>(null);
  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set());
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);

  // Загружаем настройки при монтировании
  useEffect(() => {
    const loaded = loadDuplicateFields();
    setCompareFields(loaded);
  }, []);

  // Автоматическая проверка дубликатов при изменении данных или настроек
  useEffect(() => {
    if (expenses.length > 0 && (compareFields.amount || compareFields.date || compareFields.description || compareFields.time)) {
      handleCheckDuplicates();
    }
  }, [expenses, compareFields.amount, compareFields.date, compareFields.description, compareFields.time]);

  // Сохраняем настройки при изменении
  const updateCompareFields = useCallback((field: keyof DuplicateFields, value: boolean) => {
    const updated = { ...compareFields, [field]: value };
    setCompareFields(updated);
    saveDuplicateFields(updated);
  }, [compareFields]);

  // Проверка дубликатов
  const handleCheckDuplicates = useCallback(async () => {
    if (expenses.length === 0) return;

    setIsChecking(true);
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

      const result = await checkForDuplicates(expensesToCheck, compareFields);

      if ('error' in result) {
        console.error('Ошибка проверки дубликатов:', result.error);
        return;
      }

      console.log('🔍 Получен результат:', result);

      setDuplicateResults(result.results);
      
      // Находим индексы с дубликатами
      const duplicateIndices = new Set<number>();
      Object.entries(result.results).forEach(([index, duplicateResult]) => {
        if (duplicateResult.hasDuplicates) {
          duplicateIndices.add(parseInt(index));
        }
      });

      setExcludedIndices(duplicateIndices);
      onDuplicatesFound(duplicateIndices);

      // Не открываем модальное окно автоматически при автопроверке
      // if (duplicateIndices.size > 0) {
      //   setIsResultsModalOpen(true);
      // }

    } catch (error) {
      console.error('Ошибка при проверке дубликатов:', error);
    } finally {
      setIsChecking(false);
    }
  }, [expenses, compareFields, onDuplicatesFound]);

  const duplicatesCount = duplicateResults 
    ? Object.values(duplicateResults).filter(result => result.hasDuplicates).length 
    : 0;

  const includedCount = expenses.length - excludedIndices.size;

  return (
    <div className="mb-6">
      <div 
        className={`flex items-center justify-between gap-4 cursor-pointer hover:bg-orange-100 p-3 ${
          isCollapsed 
            ? 'rounded-lg bg-orange-50 border border-orange-200 mb-2' 
            : 'rounded-t-lg bg-orange-50 border border-orange-200 border-b-0'
        }`}
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
          {duplicatesCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
              {duplicatesCount} дубликатов
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 hidden sm:block">
          Сравнение с существующими расходами в базе данных
        </p>
      </div>

      {!isCollapsed && (
        <div className="space-y-4 p-4 bg-orange-50 border border-orange-200 rounded-lg border-t-0 rounded-t-none">
          {/* Выбор полей для сравнения */}
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">
              Поля для сравнения:
            </div>
            <div className="space-y-2">
              {/* Основные поля */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Основные критерии:</div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compareFields.amount}
                      onChange={(e) => updateCompareFields('amount', e.target.checked)}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700 font-medium">💰 Сумма</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compareFields.date}
                      onChange={(e) => updateCompareFields('date', e.target.checked)}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700 font-medium">📅 Дата</span>
                  </label>
                </div>
              </div>
              
              {/* Дополнительные поля */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Дополнительные критерии:</div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compareFields.description}
                      onChange={(e) => updateCompareFields('description', e.target.checked)}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-600">📝 Описание</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compareFields.time}
                      onChange={(e) => updateCompareFields('time', e.target.checked)}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-600">⏰ Время</span>
                  </label>
                </div>
              </div>
            </div>
            {!compareFields.amount && !compareFields.date && !compareFields.description && !compareFields.time && (
              <p className="text-xs text-red-600 mt-1">Выберите хотя бы одно поле для сравнения</p>
            )}
          </div>

          {/* Кнопка проверки */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                onClick={handleCheckDuplicates}
                disabled={
                  isChecking || 
                  expenses.length === 0 || 
                  (!compareFields.amount && !compareFields.date && !compareFields.description && !compareFields.time)
                }
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {isChecking ? 'Проверяем...' : '🔍 Проверить заново'}
              </Button>
              {!isChecking && duplicateResults && (
                <span className="text-xs text-gray-500">
                  Автопроверка включена
                </span>
              )}
            </div>

            {duplicateResults && (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-700">
                  ✅ Будет импортировано: {includedCount}
                </span>
                <span className="text-orange-700">
                  🔍 Найдено дубликатов: {duplicatesCount}
                </span>
                {duplicatesCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsResultsModalOpen(true)}
                  >
                    Просмотр дубликатов
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модальное окно с результатами */}
      <Modal
        isOpen={isResultsModalOpen}
        onClose={() => setIsResultsModalOpen(false)}
        title={`Найдено дубликатов: ${duplicatesCount}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm mb-2">
              <span className="text-orange-600">🔍</span>
              <span className="font-medium text-orange-800">
                Обнаружены возможные дубликаты
              </span>
              <span className="text-orange-600">
                ({duplicatesCount} из {expenses.length} записей)
              </span>
            </div>
            {duplicateResults && Object.values(duplicateResults).some(r => r.hasDuplicates) && (
              <div className="flex items-center gap-2 text-xs">
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
          
          <div className="max-h-96 overflow-y-auto space-y-3">
            {duplicateResults && Object.entries(duplicateResults)
              .filter(([_, result]) => result.hasDuplicates)
              .map(([index, result]) => {
                const expenseIndex = parseInt(index);
                const expense = expenses[expenseIndex];
                const bestMatch = result.matches[0];
                
                return (
                  <div key={index} className="border border-gray-200 rounded p-2 text-xs">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 bg-blue-50 p-2 rounded">
                        <span className="text-sm font-medium text-gray-700 min-w-[60px]">Строка {expenseIndex + 1}</span>
                        <span className="text-xs font-medium text-blue-700 min-w-[140px]">Импортируемая запись:</span>
                        <div className="flex items-center gap-4 flex-1">
                          <span>💰 {expense.amount.toFixed(2)}</span>
                          <span>📝 {expense.description}</span>
                          <span>📅 {expense.expense_date}</span>
                          {expense.expense_time && <span>⏰ {expense.expense_time}</span>}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 bg-orange-50 p-2 rounded">
                        <span className="min-w-[60px]"></span>
                        <span className="text-xs font-medium text-orange-700 min-w-[140px]">Существующая запись:</span>
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
          
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-600">
              Дубликаты будут исключены из импорта
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setExcludedIndices(new Set());
                  onDuplicatesFound(new Set());
                }}
              >
                Импортировать все
              </Button>
              <Button
                onClick={() => setIsResultsModalOpen(false)}
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