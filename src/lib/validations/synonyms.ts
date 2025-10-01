import { z } from 'zod';

export const keywordSynonymSchema = z.object({
  keyword_id: z.string().uuid('Некорректный идентификатор ключевого слова'),
  synonym: z.string().min(2, 'Синоним должен содержать минимум 2 символа').max(100, 'Синоним слишком длинный')
});

export const deleteKeywordSynonymSchema = z.object({
  id: z.string().uuid('Некорректный идентификатор синонима'),
  keyword_id: z.string().uuid('Некорректный идентификатор ключевого слова')
});

export const citySynonymSchema = z.object({
  cityId: z.string().uuid('Некорректный идентификатор города').optional(),
  city: z
    .string()
    .min(2, 'Название города должно содержать минимум 2 символа')
    .max(100, 'Название города слишком длинное')
    .optional(),
  synonym: z.string().min(2, 'Синоним должен содержать минимум 2 символа').max(100, 'Синоним слишком длинный'),
  markerPreset: z.string().min(1).optional().nullable(),
  isVirtual: z.boolean().optional()
}).refine((data) => data.cityId || data.city, {
  message: 'Укажите город или идентификатор города',
  path: ['city']
});

export const deleteCitySynonymSchema = z.object({
  id: z.union([
    z.number().int('Некорректный идентификатор записи синонима'),
    z.string().regex(/^\d+$/, 'Некорректный идентификатор записи синонима')
  ])
});

export const deleteCitySchema = z.object({
  id: z.string().uuid('Некорректный идентификатор города'),
});

export const updateCitySchema = z.object({
  id: z.string().uuid('Некорректный идентификатор города'),
  newCityName: z.string().min(2, 'Новое название города должно содержать минимум 2 символа').max(100, 'Название города слишком длинное'),
});

export type CreateKeywordSynonymData = z.infer<typeof keywordSynonymSchema>;
export type DeleteKeywordSynonymData = z.infer<typeof deleteKeywordSynonymSchema>;
export type CreateCitySynonymData = z.infer<typeof citySynonymSchema>;
export type DeleteCitySynonymData = z.infer<typeof deleteCitySynonymSchema>;
export type DeleteCityData = z.infer<typeof deleteCitySchema>;
export type UpdateCityData = z.infer<typeof updateCitySchema>;