import {
  hasGeoPoint,
  isVirtualCoordinates,
  normaliseMarkerPreset,
  type CityCoordinates
} from '@/lib/utils/cityCoordinates';

export type MapState = {
  center: [number, number];
  zoom: number;
};

export const DEFAULT_CENTER: [number, number] = [55.751574, 37.573856];
export const DEFAULT_ZOOM = 4;

export const createDefaultMapState = (): MapState => ({
  center: [...DEFAULT_CENTER] as [number, number],
  zoom: DEFAULT_ZOOM,
});

export const normaliseCoordinateInput = (value: string) => value.trim().replace(',', '.');

export const coordinatesAreEqual = (a: CityCoordinates | null, b: CityCoordinates | null) => {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  if (isVirtualCoordinates(a) || isVirtualCoordinates(b)) {
    return (
      isVirtualCoordinates(a) &&
      isVirtualCoordinates(b) &&
      normaliseMarkerPreset(a.markerPreset) === normaliseMarkerPreset(b.markerPreset)
    );
  }
  if (!hasGeoPoint(a) || !hasGeoPoint(b)) {
    return false;
  }
  const sameLat = Math.abs(a.lat - b.lat) < 1e-6;
  const sameLon = Math.abs(a.lon - b.lon) < 1e-6;
  const samePreset = normaliseMarkerPreset(a.markerPreset) === normaliseMarkerPreset(b.markerPreset);
  return sameLat && sameLon && samePreset;
};

export const extractEventCoordinates = (event: unknown): [number, number] | null => {
  if (!event || typeof (event as { get?: unknown }).get !== 'function') {
    return null;
  }
  const coords = (event as { get: (key: string) => unknown }).get('coords');
  if (!Array.isArray(coords) || coords.length < 2) {
    return null;
  }
  const [lat, lon] = coords as [number, number];
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return null;
  }
  return [lat, lon];
};

export const extractPlacemarkCoordinates = (target: unknown): [number, number] | null => {
  const geometry = (target as { geometry?: { getCoordinates?: () => unknown } })?.geometry;
  if (!geometry || typeof geometry.getCoordinates !== 'function') {
    return null;
  }
  const coords = geometry.getCoordinates();
  if (!Array.isArray(coords) || coords.length < 2) {
    return null;
  }
  const [lat, lon] = coords as [number, number];
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return null;
  }
  return [lat, lon];
};

export const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return 'неизвестно';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString('ru-RU');
};
