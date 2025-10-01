'use client';

import type { RefObject } from 'react';
import { Button, Input } from '@/components/ui';
import { MarkerPresetPicker } from '@/components/cities/MarkerPresetPicker';
import { YMaps, Map as YandexMap, Placemark } from '@pbe/react-yandex-maps';
import { DEFAULT_MARKER_PRESET } from '@/lib/constants/cityMarkers';
import { hasGeoPoint, isVirtualCoordinates, isVirtualMarkerPreset, type CityCoordinates } from '@/lib/utils/cityCoordinates';
import { extractEventCoordinates, extractPlacemarkCoordinates, type MapState } from './cityManagerUtils';

interface CityManagerCreateCitySectionProps {
  newCity: string;
  onCityChange: (value: string) => void;
  newCityInputRef: RefObject<HTMLInputElement | null>;
  useUnrecognizedAlternate: boolean;
  isSubmitting: boolean;
  onFindOnMap: () => void;
  isSearchingCoordinates: boolean;
  selectedCoordinates: CityCoordinates | null;
  selectedMarkerPreset: string;
  onMarkerPresetChange: (value: string) => void;
  yandexApiKey?: string;
  mapState: MapState;
  onMapInstanceChange: (ref: unknown) => void;
  onSelectCoordinates: (lat: number, lon: number) => void;
  manualLat: string;
  manualLon: string;
  onManualLatChange: (value: string) => void;
  onManualLonChange: (value: string) => void;
  onManualBlur: () => void;
  onManualApply: () => void;
}

export function CityManagerCreateCitySection({
  newCity,
  onCityChange,
  newCityInputRef,
  useUnrecognizedAlternate,
  isSubmitting,
  onFindOnMap,
  isSearchingCoordinates,
  selectedCoordinates,
  selectedMarkerPreset,
  onMarkerPresetChange,
  yandexApiKey,
  mapState,
  onMapInstanceChange,
  onSelectCoordinates,
  manualLat,
  manualLon,
  onManualLatChange,
  onManualLonChange,
  onManualBlur,
  onManualApply,
}: CityManagerCreateCitySectionProps) {
  const submitLabel = useUnrecognizedAlternate
    ? 'Добавить город вместе с его альтернативным названием'
    : 'Добавить город';

  const hasSelectedPoint = selectedCoordinates ? hasGeoPoint(selectedCoordinates) : false;
  const isVirtualSelection =
    isVirtualCoordinates(selectedCoordinates) || isVirtualMarkerPreset(selectedMarkerPreset);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-2">
        <div className="flex-grow space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="synonym-city">
            Новый город
          </label>
          <div className="relative">
            <Input
              id="synonym-city"
              placeholder="Например: Санкт-Петербург"
              value={newCity}
              onChange={(event) => onCityChange(event.target.value)}
              disabled={isSubmitting}
              className="h-11 pl-12"
              ref={newCityInputRef}
            />
            <MarkerPresetPicker
              value={selectedMarkerPreset}
              onChange={onMarkerPresetChange}
              disabled={isSubmitting}
              align="start"
              triggerClassName="absolute inset-y-0 left-0 flex h-full w-10 items-center justify-center rounded-l-md border-r border-slate-300 bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-0"
            />
          </div>
        </div>
        <div className="flex flex-shrink-0 gap-2 sm:self-end">
          <Button
            type="button"
            variant="outline"
            onClick={onFindOnMap}
            isLoading={isSearchingCoordinates}
            disabled={!newCity.trim() || isSubmitting || isVirtualSelection}
            className="h-11"
          >
            Найти на карте
          </Button>
          <Button
            type="submit"
            isLoading={isSubmitting}
            disabled={
              isSubmitting ||
              !selectedCoordinates ||
              (!isVirtualSelection && !hasSelectedPoint)
            }
            className="h-11 text-center leading-snug"
          >
            {submitLabel}
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:justify-end">
        <p className="sm:text-right">Укажите название и подтвердите координаты перед сохранением.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <div className="space-y-2">
          <div className="h-72 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            {yandexApiKey ? (
              <YMaps query={{ apikey: yandexApiKey, lang: 'ru_RU' }}>
                <YandexMap
                  state={mapState}
                  width="100%"
                  height="100%"
                  modules={['geoObject.addon.balloon', 'geoObject.addon.hint']}
                  instanceRef={onMapInstanceChange}
                  onClick={(event: unknown) => {
                    const coords = extractEventCoordinates(event);
                    if (!coords) {
                      return;
                    }
                    if (isVirtualSelection) {
                      return;
                    }
                    const [lat, lon] = coords;
                    onSelectCoordinates(lat, lon);
                  }}
                >
                  {selectedCoordinates && hasSelectedPoint && (
                    <Placemark
                      geometry={[selectedCoordinates.lat, selectedCoordinates.lon]}
                      options={{ draggable: true, preset: selectedCoordinates.markerPreset ?? DEFAULT_MARKER_PRESET }}
                      onDragEnd={(event: { get: (key: string) => unknown }) => {
                        const coords = extractPlacemarkCoordinates(event.get('target'));
                        if (!coords) {
                          return;
                        }
                        const [lat, lon] = coords;
                        onSelectCoordinates(lat, lon);
                      }}
                    />
                  )}
                </YandexMap>
              </YMaps>
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-red-700">
                API-ключ для Яндекс Карт не настроен. Укажите координаты вручную.
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500">Нажмите на карту или перетащите маркер, чтобы уточнить координаты.</p>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-900">Ручной ввод координат</p>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manual-lat">
                Широта (lat)
              </label>
              <Input
                id="manual-lat"
                value={manualLat}
                onChange={(event) => onManualLatChange(event.target.value)}
                onBlur={onManualBlur}
                inputMode="decimal"
                placeholder="Например: 59.9386"
                disabled={isSubmitting || isVirtualSelection}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manual-lon">
                Долгота (lon)
              </label>
              <Input
                id="manual-lon"
                value={manualLon}
                onChange={(event) => onManualLonChange(event.target.value)}
                onBlur={onManualBlur}
                inputMode="decimal"
                placeholder="Например: 30.3141"
                disabled={isSubmitting || isVirtualSelection}
              />
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={onManualApply}
            disabled={isSubmitting || isVirtualSelection}
          >
            Применить координаты
          </Button>
          <p className="text-xs text-slate-500">
            {isVirtualSelection
              ? 'Виртуальный город не требует координат и не отображается на карте.'
              : 'Введите координаты вручную, если карта недоступна или требуется точное значение.'}
          </p>
        </div>
      </div>
    </div>
  );
}
