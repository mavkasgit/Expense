'use client'

import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { BuildExpensesResult, CityReviewItem } from '../types'

interface ReviewModalProps {
  state: { mode: 'append' | 'directSave'; result: BuildExpensesResult } | null
  isProcessing: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ReviewModal({ state, isProcessing, onConfirm, onCancel }: ReviewModalProps) {
  const cityItems: CityReviewItem[] = state?.result.reviewItems.filter(
    (item): item is CityReviewItem => item.type === 'city-from-description'
  ) ?? []
  const totalReviewCount = cityItems.length
  const cityPreview = cityItems.slice(0, 6)
  const cityOverflow = cityItems.length - cityPreview.length

  const primaryLabel = state?.mode === 'directSave'
    ? (isProcessing ? 'Сохранение...' : 'Подтвердить и сохранить')
    : 'Подтвердить импорт'

  return (
    <Modal
      isOpen={Boolean(state)}
      onClose={onCancel}
      title="Проверка автоматически выделенных полей"
      size="xl"
    >
      {state && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-900">
            Система выделила дополнительные данные в {totalReviewCount}{' '}
            {totalReviewCount === 1 ? 'строке' : 'строках'}. Проверьте результаты и подтвердите, что всё выглядит корректно.
          </div>

          {cityItems.length > 0 && (
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 text-blue-800 px-3 py-1 text-sm">
                📍 Города из описания: {cityItems.length}
              </div>

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
                      {cityPreview.map(item => (
                        <tr key={`${item.rowIndex}-${item.columnLabel}`} className="bg-white">
                          <td className="px-3 py-2 align-top text-gray-500">{item.rowIndex}</td>
                          <td className="px-3 py-2 align-top text-gray-700">{item.columnLabel}</td>
                          <td className="px-3 py-2 align-top text-gray-900 whitespace-pre-wrap break-words">
                            {item.sourceValue || '—'}
                          </td>
                          <td className="px-3 py-2 align-top text-gray-900 whitespace-pre-wrap break-words">
                            {item.cleanedDescription || '—'}
                          </td>
                          <td className="px-3 py-2 align-top text-blue-700 font-semibold">
                            {item.extractedCity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {cityOverflow > 0 && (
                  <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50">
                    и ещё {cityOverflow} {cityOverflow === 1 ? 'строка' : 'строк'} с автоопределением города
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
  )
}
