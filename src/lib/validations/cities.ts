import { z } from 'zod';
import { VIRTUAL_CITY_MARKER_PRESET } from '@/lib/constants/cityMarkers';

const numericCoordinate = z
  .number({ invalid_type_error: 'Координата должна быть числом' })
  .refine(Number.isFinite, 'Координата должна быть валидным числом');

export const updateCityCoordinatesSchema = z.object({
  id: z.string().uuid(),
  coordinates: z
    .object({
      lat: numericCoordinate.nullable(),
      lon: numericCoordinate.nullable(),
      markerPreset: z.string().min(1).optional().nullable(),
      isVirtual: z.boolean().optional()
    })
    .refine((value) => {
      const hasPoint = typeof value.lat === 'number' && typeof value.lon === 'number';
      if (value.isVirtual || value.markerPreset === VIRTUAL_CITY_MARKER_PRESET) {
        return true;
      }
      return hasPoint;
    }, 'Не заданы координаты города')
});

export type UpdateCityCoordinatesData = z.infer<typeof updateCityCoordinatesSchema>;

export const updateCityFavoriteSchema = z.object({
  id: z.string().uuid(),
  isFavorite: z.boolean(),
});

export type UpdateCityFavoriteData = z.infer<typeof updateCityFavoriteSchema>;
