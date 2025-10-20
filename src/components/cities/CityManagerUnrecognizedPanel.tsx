'use client';

import { Button } from '@/components/ui';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import type { UnrecognizedCity } from '@/types';
import { formatDate } from './cityManagerUtils';

export type SelectOption = { value: string | null; label: string };

interface CityManagerUnrecognizedPanelProps {
  unrecognizedCityOptions: SelectOption[];
  selectedUnrecognizedCityId: string | null;
  onSelectUnrecognizedCity: (value: string | null) => void;
  isLoadingUnrecognized: boolean;
  isSubmitting: boolean;
  selectedUnrecognizedCity: UnrecognizedCity | null;
  onClearUnrecognizedSelection: () => void;
  onUseUnrecognizedCity: () => void;
  useUnrecognizedAlternate: boolean;
  onToggleUseUnrecognizedAlternate: (value: boolean) => void;
  citySelectionOptions: SelectOption[];
  selectedAttachCityId: string | null;
  onSelectAttachCity: (value: string | null) => void;
  onAttachUnrecognizedCity: () => void;
  isAttachingUnrecognized: boolean;
}

export function CityManagerUnrecognizedPanel({
  unrecognizedCityOptions,
  selectedUnrecognizedCityId,
  onSelectUnrecognizedCity,
  isLoadingUnrecognized,
  isSubmitting,
  selectedUnrecognizedCity,
  onClearUnrecognizedSelection,
  onUseUnrecognizedCity,
  useUnrecognizedAlternate,
  onToggleUseUnrecognizedAlternate,
  citySelectionOptions,
  selectedAttachCityId,
  onSelectAttachCity,
  onAttachUnrecognizedCity,
  isAttachingUnrecognized,
}: CityManagerUnrecognizedPanelProps) {
  return (
    <div className="space-y-3">
      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Неопознанные города
      </span>
      <SearchableSelect<SelectOption>
        options={unrecognizedCityOptions}
        value={selectedUnrecognizedCityId}
        onChange={onSelectUnrecognizedCity}
        getOptionValue={(o) => o.value}
        getOptionLabel={(o) => o.label}
        placeholder={isLoadingUnrecognized ? 'Загружаем список…' : 'Выберите город из расходов'}
        className="w-full"
        disabled={isLoadingUnrecognized || isSubmitting || useUnrecognizedAlternate}
        maxVisibleOptions={3}
        forceOpen
      />
      <p className="text-xs text-slate-500">
        Список городов, найденных в выписках, отображается тремя первыми значениями. Раскройте его, чтобы увидеть полный перечень.
      </p>
      {selectedUnrecognizedCity && (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-sm">
            <div className="text-xs text-slate-500">
              <p>Всего упоминаний: {selectedUnrecognizedCity.frequency ?? '—'}</p>
              <p>Последний раз: {formatDate(selectedUnrecognizedCity.last_seen)}</p>
            </div>
            <p className="text-center font-medium text-slate-900">{selectedUnrecognizedCity.name}</p>
            <div className="text-right">
              <Button type="button" variant="ghost" size="sm" onClick={onClearUnrecognizedSelection}>
                Сбросить
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-4">
            <div className="space-y-3 rounded-lg border bg-slate-50/50 p-4">
              <Button
                type="button"
                variant="outline"
                onClick={onUseUnrecognizedCity}
                disabled={isSubmitting}
                className="w-full"
              >
                Использовать как новый город
              </Button>
              <Button
                type="button"
                variant={useUnrecognizedAlternate ? 'primary' : 'secondary'}
                onClick={() => onToggleUseUnrecognizedAlternate(!useUnrecognizedAlternate)}
                disabled={!selectedUnrecognizedCity || isSubmitting}
                className="w-full text-xs font-medium leading-snug"
                aria-pressed={useUnrecognizedAlternate}
              >
                {useUnrecognizedAlternate
                  ? 'Не добавлять альтернативное название'
                  : 'Добавить альтернативное название из списка'}
              </Button>
            </div>
            <div className="space-y-3 rounded-lg border bg-slate-50/50 p-4">
              <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Прикрепить как альтернативный вариант
              </p>
              <div className="flex flex-col items-stretch gap-2">
                <SearchableSelect<SelectOption>
                  options={citySelectionOptions}
                  value={selectedAttachCityId}
                  onChange={onSelectAttachCity}
                  getOptionValue={(o) => o.value}
                  getOptionLabel={(o) => o.label}
                  placeholder="Выберите основной город"
                  size="sm"
                  disabled={isAttachingUnrecognized}
                  maxVisibleOptions={3}
                />
                <Button
                  type="button"
                  onClick={onAttachUnrecognizedCity}
                  isLoading={isAttachingUnrecognized}
                  disabled={isAttachingUnrecognized || !selectedAttachCityId}
                >
                  Прикрепить
                </Button>
              </div>
              <p className="text-center text-xs text-slate-500">
                Альтернативное название будет добавлено к выбранному городу.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
