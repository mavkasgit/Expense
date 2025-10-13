'use client';

import { useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { REVIEW_PREVIEW_LIMIT } from '../constants';
import type { ReviewModalState, AutoExtractionReviewItem } from '../types';

interface ReviewModalProps {
  reviewState: ReviewModalState | null;
  isProcessing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function isCityReviewItem(item: AutoExtractionReviewItem): item is AutoExtractionReviewItem {
  return item.type === 'city-from-description';
}

export function ReviewModal({ reviewState, isProcessing, onCancel, onConfirm }: ReviewModalProps) {
  const { cityItems, previewItems, overflowCount, totalCount, primaryLabel } = useMemo(() => {
    if (!reviewState) {
      return {
        cityItems: [] as AutoExtractionReviewItem[],
        previewItems: [] as AutoExtractionReviewItem[],
        overflowCount: 0,
        totalCount: 0,
        primaryLabel: 'Подтвердить',
      };
    }

    const cityBased = reviewState.result.reviewItems.filter(isCityReviewItem);
    const preview = cityBased.slice(0, REVIEW_PREVIEW_LIMIT);
    const overflow = Math.max(cityBased.length - preview.length, 0);
    const primary =
      reviewState.mode === 'directSave'
        ? isProcessing
          ? 'Сохранение...'
          : 'Подтвердить и сохранить'
        : 'Подтвердить импорт';

    return {
      cityItems: cityBased,
      previewItems: preview,
      overflowCount: overflow,
      totalCount: cityBased.length,
      primaryLabel: primary,
    };
  }, [isProcessing, reviewState]);

  return (
    <Modal
      isOpen={Boolean(reviewState)}
      onClose={onCancel}
      title="Проверка автоматически выделенных полей"
      size="xl"
    >
      {reviewState && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              Система выделила дополнительные данные в {totalCount}{' '}
              {totalCount === 1 ? 'строке' : 'строках'}. Проверьте результаты и подтвердите, что всё выглядит корректно.
            </p>
          </div>

          {cityItems.length > 0 && (
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 text-blue-800 px-3 py-1 text-sm">
                📍 Города из описания: {cityItems.length}
              </span>

              <div className="overflow-hidden rounded-lg border border-gray-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Строка</th>
                        <th className="px-3 py-2 text-left">Столбец</th>
                        <th className="px-3 py-2 text-left">Исходное значение</th>
                        <th className="px-3 py-2 text-left">Описание после очистки</th>
                        <th className="px-3 py-2 text-left">Автоопределённый город</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {previewItems.map((item, index) => (
                        <tr key={`city-${index}-${item.rowIndex}`} className="bg-white">
                          <td className="px-3 py-2 align-top text-gray-500">{item.rowIndex}</td>
                          <td className="px-3 py-2 align-top text-gray-700">{item.columnLabel}</td>
                          <td className="px-3 py-2 align-top text-gray-900 whitespace-pre-wrap break-words">
                            {item.sourceValue || '—'}
                          </td>
                          <td className="px-3 py-2 align-top text-gray-900 whitespace-pre-wrap break-words">
                            {item.cleanedDescription || '—'}
                          </td>
                          <td className="px-3 py-2 align-top text-blue-700 font-semibold">{item.extractedCity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {overflowCount > 0 && (
                  <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50">
                    и ещё {overflowCount} {overflowCount === 1 ? 'строка' : 'строк'} с автоопределением города
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              Подтверждение применит назначенные столбцы и перенесёт данные в таблицу расходов.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
                Вернуться
              </Button>
              <Button variant="primary" onClick={onConfirm} disabled={isProcessing}>
                {primaryLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
