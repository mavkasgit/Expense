import type { CityCoordinates } from '@/lib/utils/cityCoordinates';

export interface CitySynonymRecord {
  id: number;
  cityId: string;
  cityName: string;
  synonym: string;
  coordinates: CityCoordinates | null;
  isFavorite: boolean;
}

export type CityGroup = {
  cityId: string;
  cityName: string;
  entries: CitySynonymRecord[];
  coordinates: CityCoordinates | null;
  isFavorite: boolean;
};

export type CityGroupWithCoordinates = CityGroup & { coordinates: CityCoordinates & { lat: number; lon: number } };
