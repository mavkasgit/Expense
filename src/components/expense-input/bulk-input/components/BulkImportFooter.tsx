'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface BulkImportFooterProps {
  onClear: () => void;
  onDirectSave: () => void;
  isSubmitting: boolean;
  hasExpenses: boolean;
  showErrorsOnly: boolean;
  onToggleShowErrorsOnly: () => void;
  showNewCitiesOnly: boolean;
  onToggleShowNewCitiesOnly: () => void;
  showNewDescriptionsOnly: boolean;
  onToggleShowNewDescriptionsOnly: () => void;
  errorsCount: number;
  newCitiesCount: number;
  newDescriptionsCount: number;
}

export function BulkImportFooter({
  onClear,
  onDirectSave,
  isSubmitting,
  hasExpenses,
  showErrorsOnly,
  onToggleShowErrorsOnly,
  showNewCitiesOnly,
  onToggleShowNewCitiesOnly,
  showNewDescriptionsOnly,
  onToggleShowNewDescriptionsOnly,
  errorsCount,
  newCitiesCount,
  newDescriptionsCount,
}: BulkImportFooterProps) {
  const [scrollDirection, setScrollDirection] = useState<'down' | 'up'>('down');

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 10) { // -10 for a small buffer
        setScrollDirection('up');
      } else {
        setScrollDirection('down');
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="sticky bottom-0 bg-white p-4 border-t border-gray-200 dark:border-gray-700 shadow-lg z-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={showErrorsOnly ? 'primary' : 'outline'}
            onClick={onToggleShowErrorsOnly}
            size="sm"
            disabled={!hasExpenses || errorsCount === 0}
          >
            {showErrorsOnly ? 'Все строки' : `⚠️ Ошибки (${errorsCount})`}
          </Button>
          <Button
            variant={showNewCitiesOnly ? 'primary' : 'outline'}
            onClick={onToggleShowNewCitiesOnly}
            size="sm"
            disabled={!hasExpenses || newCitiesCount === 0}
          >
            {showNewCitiesOnly ? 'Все города' : `🌍 Новые города (${newCitiesCount})`}
          </Button>
          <Button
            variant={showNewDescriptionsOnly ? 'primary' : 'outline'}
            onClick={onToggleShowNewDescriptionsOnly}
            size="sm"
            disabled={!hasExpenses || newDescriptionsCount === 0}
          >
            {showNewDescriptionsOnly ? 'Все описания' : `📝 Новые описания (${newDescriptionsCount})`}
          </Button>
        </div>

        <div className="flex justify-end space-x-4">
          <Button 
            variant="outline" 
            onClick={() => {
              if (scrollDirection === 'down') {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
              } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }} 
            disabled={!hasExpenses}
            size="sm"
            title={scrollDirection === 'down' ? "Прокрутить вниз" : "Прокрутить вверх"}
          >
            {scrollDirection === 'down' ? '⬇️ Вниз' : '⬆️ Вверх'}
          </Button>
          <Button variant="outline" onClick={onClear} disabled={!hasExpenses || isSubmitting}>
            🗑️ Очистить
          </Button>
          <Button onClick={onDirectSave} disabled={!hasExpenses || isSubmitting}>
            {isSubmitting ? 'Сохранение...' : '💾 Сохранить'}
          </Button>
        </div>
      </div>
    </div>
  );
}
