'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import {
  keywordSynonymSchema,
  deleteKeywordSynonymSchema,
  citySynonymSchema,
  deleteCitySynonymSchema,
  deleteCitySchema,
  updateCitySchema,
  type CreateKeywordSynonymData,
  type DeleteKeywordSynonymData,
  type CreateCitySynonymData,
  type DeleteCitySynonymData,
  type DeleteCityData,
  type UpdateCityData
} from '@/lib/validations/synonyms';
import type { KeywordSynonym, CitySynonym, City } from '@/types';

type Coordinates = { lat: number; lon: number };

type CitySynonymWithCity = CitySynonym & { city: Pick<City, 'id' | 'name' | 'coordinates'> | null };
type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>;
type UnrecognizedNameStat = { name: string; count: number };

function aggregateUnrecognizedCityNames(
  expenses: Array<{ raw_city_input: string | null }>,
  fallbackName: string
): UnrecognizedNameStat[] {
  const normalizedFallback = fallbackName.trim();
  const accumulator = new Map<string, UnrecognizedNameStat>();

  for (const record of expenses) {
    const candidate = typeof record.raw_city_input === 'string' ? record.raw_city_input.trim() : '';
    const effectiveName = candidate || normalizedFallback;

    if (!effectiveName) {
      continue;
    }

    const key = effectiveName.toLocaleLowerCase('ru');
    const existing = accumulator.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      accumulator.set(key, { name: effectiveName, count: 1 });
    }
  }

  if (accumulator.size === 0 && normalizedFallback) {
    accumulator.set(normalizedFallback.toLocaleLowerCase('ru'), {
      name: normalizedFallback,
      count: expenses.length > 0 ? expenses.length : 1
    });
  }

  return Array.from(accumulator.values());
}

async function rememberUnrecognizedCity(
  client: SupabaseServerClient,
  userId: string,
  name: string,
  occurrences: number,
  timestamp: string,
  context: string
) {
  const normalized = name.trim();
  if (!normalized || occurrences <= 0) {
    return;
  }

  try {
    const { data: existing } = await client
      .from('unrecognized_cities')
      .select('id, frequency')
      .eq('user_id', userId)
      .ilike('name', normalized)
      .maybeSingle();

    if (existing?.id) {
      await client
        .from('unrecognized_cities')
        .update({
          frequency: (existing.frequency ?? 0) + occurrences,
          last_seen: timestamp
        })
        .eq('id', existing.id);
    } else {
      await client
        .from('unrecognized_cities')
        .insert({
          user_id: userId,
          name: normalized,
          frequency: occurrences,
          first_seen: timestamp,
          last_seen: timestamp
        });
    }
  } catch (error) {
    console.error(`Не удалось сохранить непознанный город при ${context}:`, error);
  }
}

const geocoderApiKey =
  process.env.YANDEX_GEOCODER_API_KEY ?? process.env.NEXT_PUBLIC_YANDEX_GEOCODER_API_KEY ?? null;

async function geocodeCityCoordinates(cityName: string): Promise<Coordinates | null> {
  if (!geocoderApiKey) {
    return null;
  }

  const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${geocoderApiKey}&format=json&geocode=${encodeURIComponent(cityName)}`;

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      next: { revalidate: 0 }
    });

    if (!response.ok) {
      console.error('Не удалось получить координаты города. Код ответа:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    const featureMember = data?.response?.GeoObjectCollection?.featureMember ?? [];

    if (featureMember.length === 0) {
      return null;
    }

    const point = featureMember[0]?.GeoObject?.Point?.pos as string | undefined;
    if (!point) {
      return null;
    }

    const [lonString, latString] = point.split(' ');
    const lon = Number.parseFloat(lonString);
    const lat = Number.parseFloat(latString);

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return null;
    }

    return { lat, lon } satisfies Coordinates;
  } catch (error) {
    console.error('Ошибка при геокодировании города', cityName, error);
    return null;
  }
}

export async function createKeywordSynonym(data: CreateKeywordSynonymData) {
  const supabase = await createServerClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' };
    }

    const validated = keywordSynonymSchema.parse(data);

    const { data: synonym, error } = await supabase
      .from('keyword_synonyms')
      .insert({
        keyword_id: validated.keyword_id,
        synonym: validated.synonym.trim(),
        user_id: user.id
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { error: 'Такой синоним уже существует' };
      }
      console.error('Ошибка создания синонима ключевого слова:', error);
      return { error: 'Не удалось создать синоним' };
    }

    revalidatePath('/categories');
    return { success: true, data: synonym as KeywordSynonym };
  } catch (err) {
    console.error('Ошибка добавления синонима ключевого слова:', err);
    return { error: 'Произошла ошибка при создании синонима' };
  }
}

export async function deleteKeywordSynonym(data: DeleteKeywordSynonymData) {
  const supabase = await createServerClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' };
    }

    const validated = deleteKeywordSynonymSchema.parse(data);

    const { error } = await supabase
      .from('keyword_synonyms')
      .delete()
      .eq('id', validated.id as any)
      .eq('user_id', user.id);

    if (error) {
      console.error('Ошибка удаления синонима ключевого слова:', error);
      return { error: 'Не удалось удалить синоним' };
    }

    revalidatePath('/categories');
    return { success: true };
  } catch (err) {
    console.error('Ошибка удаления синонима ключевого слова:', err);
    return { error: 'Произошла ошибка при удалении синонима' };
  }
}

export async function getCitySynonyms() {
  const supabase = await createServerClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' };
    }

    const { data, error } = await supabase
      .from('city_synonyms')
      .select('id, synonym, city_id, user_id, created_at, city:cities(id, name, coordinates, is_favorite)')
      .eq('user_id', user.id);

    if (error) {
      console.error('Ошибка загрузки синонимов городов:', error);
      return { error: 'Не удалось загрузить синонимы городов' };
    }

    const records = (data || []) as CitySynonymWithCity[];
    const sorted = records.sort((a, b) => {
      const nameA = a.city?.name?.toLocaleLowerCase('ru') ?? '';
      const nameB = b.city?.name?.toLocaleLowerCase('ru') ?? '';
      if (nameA !== nameB) {
        return nameA.localeCompare(nameB, 'ru');
      }
      return a.synonym.localeCompare(b.synonym, 'ru');
    });

    return { success: true, data: sorted };
  } catch (err) {
    console.error('Ошибка получения синонимов городов:', err);
    return { error: 'Произошла ошибка при загрузке синонимов городов' };
  }
}

export async function createCitySynonym(data: CreateCitySynonymData) {
  const supabase = await createServerClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' };
    }

    const validated = citySynonymSchema.parse(data);
    const trimmedSynonym = validated.synonym.trim();

    let cityRecord: Pick<City, 'id' | 'name' | 'coordinates'> | null = null;
    let cityId = validated.cityId ?? null;

    if (cityId) {
      const { data: existingCity, error: cityError } = await supabase
        .from('cities')
        .select('id, name, coordinates, is_favorite')
        .eq('id', cityId)
        .eq('user_id', user.id)
        .single();

      if (cityError || !existingCity) {
        return { error: 'Город не найден' };
      }

      cityRecord = existingCity as Pick<City, 'id' | 'name' | 'coordinates'>;
      cityId = cityRecord.id;
    } else {
      const cityName = validated.city?.trim();
      if (!cityName) {
        return { error: 'Укажите название города' };
      }

      const { data: existingCity } = await supabase
        .from('cities')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', cityName)
        .maybeSingle();

      if (existingCity) {
        return { error: 'Город с таким названием уже существует' };
      }

      const timestamp = new Date().toISOString();

      const { data: newCity, error: createCityError } = await supabase
        .from('cities')
        .insert({
          name: cityName,
          user_id: user.id,
          updated_at: timestamp
        })
        .select('id, name, coordinates, is_favorite')
        .single();

      if (createCityError || !newCity) {
        console.error('Ошибка создания города:', createCityError);
        return { error: 'Не удалось создать город' };
      }

      cityRecord = newCity as Pick<City, 'id' | 'name' | 'coordinates'>;
      cityId = cityRecord.id;

      const geocoded = await geocodeCityCoordinates(cityName);
      if (geocoded) {
        const { error: updateError } = await supabase
          .from('cities')
          .update({ coordinates: geocoded, updated_at: timestamp })
          .eq('id', cityId)
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Не удалось сохранить координаты нового города:', updateError);
        } else {
          cityRecord = { ...cityRecord, coordinates: geocoded };
        }
      }
    }

    if (!cityId || !cityRecord) {
      return { error: 'Не удалось определить город' };
    }

    const { data: synonym, error } = await supabase
      .from('city_synonyms')
      .insert({
        city_id: cityId,
        synonym: trimmedSynonym,
        user_id: user.id
      })
      .select('id, city_id, synonym, user_id, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return { error: 'Такой синоним города уже существует' };
      }
      console.error('Ошибка создания синонима города:', error);
      return { error: 'Не удалось создать синоним города' };
    }

    if (trimmedSynonym) {
      const now = new Date().toISOString();
      const { error: updateExpensesError } = await supabase
        .from('expenses')
        .update({ city_id: cityId, updated_at: now })
        .eq('user_id', user.id)
        .is('city_id', null)
        .filter('raw_city_input', 'ilike', trimmedSynonym);

      if (updateExpensesError) {
        console.error('Не удалось обновить расходы для нового синонима города:', updateExpensesError);
      } else {
        const { error: deleteUnrecognizedError } = await supabase
          .from('unrecognized_cities')
          .delete()
          .eq('user_id', user.id)
          .ilike('name', trimmedSynonym);

        if (deleteUnrecognizedError) {
          console.warn('Не удалось удалить непознанный город после добавления синонима:', deleteUnrecognizedError);
        }
      }
    }

    revalidatePath('/settings');
    revalidatePath('/cities');
    return { success: true, data: { ...(synonym as CitySynonym), city: cityRecord } as CitySynonymWithCity };
  } catch (err) {
    console.error('Ошибка добавления синонима города:', err);
    return { error: 'Произошла ошибка при создании синонима города' };
  }
}

export async function deleteCitySynonym(data: DeleteCitySynonymData) {
  const supabase = await createServerClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' };
    }

    const validated = deleteCitySynonymSchema.parse(data);
    const recordId = typeof validated.id === 'string' ? Number(validated.id) : validated.id;

    if (!Number.isInteger(recordId) || recordId <= 0) {
      return { error: 'Некорректный идентификатор записи синонима' };
    }

    const { data: synonymRecord, error: synonymLoadError } = await supabase
      .from('city_synonyms')
      .select('id, city_id, synonym, city:cities(name)')
      .eq('id', recordId)
      .eq('user_id', user.id)
      .single();

    if (synonymLoadError || !synonymRecord) {
      return { error: 'Синоним города не найден' };
    }

    const { error } = await supabase
      .from('city_synonyms')
      .delete()
      .eq('id', recordId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Ошибка удаления синонима города:', error);
      return { error: 'Не удалось удалить синоним города' };
    }

    const trimmedSynonym = synonymRecord.synonym.trim();

    if (trimmedSynonym) {
      const { data: affectedExpenses, error: loadExpensesError } = await supabase
        .from('expenses')
        .select('raw_city_input')
        .eq('user_id', user.id)
        .eq('city_id', synonymRecord.city_id)
        .filter('raw_city_input', 'ilike', trimmedSynonym);

      if (loadExpensesError) {
        console.error('Ошибка получения расходов для удаленного синонима города:', loadExpensesError);
        return { error: 'Синоним удален, но не удалось обновить связанные расходы' };
      }

      if (affectedExpenses && affectedExpenses.length > 0) {
        const now = new Date().toISOString();
        const fallbackName = trimmedSynonym || (synonymRecord.city?.name?.trim() ?? '');
        const aggregated = aggregateUnrecognizedCityNames(affectedExpenses, fallbackName);

        const { error: updateExpensesError } = await supabase
          .from('expenses')
          .update({ city_id: null, updated_at: now })
          .eq('user_id', user.id)
          .eq('city_id', synonymRecord.city_id)
          .filter('raw_city_input', 'ilike', trimmedSynonym);

        if (updateExpensesError) {
          console.error('Ошибка обновления расходов после удаления синонима города:', updateExpensesError);
          return { error: 'Синоним удален, но не удалось обновить связанные расходы' };
        }

        await Promise.all(
          aggregated.map((entry) =>
            rememberUnrecognizedCity(
              supabase,
              user.id,
              entry.name,
              entry.count,
              now,
              'удалении синонима города'
            )
          )
        );
      }
    }

    revalidatePath('/settings');
    revalidatePath('/cities');
    return { success: true };
  } catch (err) {
    console.error('Ошибка удаления синонима города:', err);
    return { error: 'Произошла ошибка при удалении синонима города' };
  }
}

export async function deleteCity(data: DeleteCityData) {
  const supabase = await createServerClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' };
    }

    const validated = deleteCitySchema.parse(data);

    const { data: existingCity, error: existingError } = await supabase
      .from('cities')
      .select('id, name')
      .eq('id', validated.id)
      .eq('user_id', user.id)
      .single();

    if (existingError || !existingCity) {
      return { error: 'Город не найден' };
    }

    const { data: linkedExpenses, error: linkedExpensesError } = await supabase
      .from('expenses')
      .select('raw_city_input')
      .eq('city_id', validated.id)
      .eq('user_id', user.id);

    if (linkedExpensesError) {
      console.error('Ошибка загрузки расходов привязанных к городу:', linkedExpensesError);
      return { error: 'Не удалось обработать связанные с городом расходы' };
    }

    if (linkedExpenses && linkedExpenses.length > 0) {
      const now = new Date().toISOString();
      const cityName = existingCity.name?.trim() ?? '';
      const aggregated = aggregateUnrecognizedCityNames(linkedExpenses, cityName);

      if (cityName) {
        const { error: normalizeRawInputError } = await supabase
          .from('expenses')
          .update({ raw_city_input: cityName })
          .eq('user_id', user.id)
          .eq('city_id', validated.id)
          .or('raw_city_input.is.null,raw_city_input.eq.');

        if (normalizeRawInputError) {
          console.error('Ошибка нормализации исходного названия города в расходах:', normalizeRawInputError);
          return { error: 'Не удалось обновить расходы перед удалением города' };
        }
      }

      const { error: resetExpensesError } = await supabase
        .from('expenses')
        .update({ city_id: null, updated_at: now })
        .eq('user_id', user.id)
        .eq('city_id', validated.id);

      if (resetExpensesError) {
        console.error('Ошибка сброса привязки города в расходах:', resetExpensesError);
        return { error: 'Не удалось обновить расходы при удалении города' };
      }

      await Promise.all(
        aggregated.map((entry) =>
          rememberUnrecognizedCity(
            supabase,
            user.id,
            entry.name,
            entry.count,
            now,
            'удалении города'
          )
        )
      );
    }



    const { error: deleteSynonymsError } = await supabase
      .from('city_synonyms')
      .delete()
      .eq('user_id', user.id)
      .eq('city_id', validated.id);

    if (deleteSynonymsError) {
      console.error('Ошибка удаления синонимов города:', deleteSynonymsError);
      return { error: 'Не удалось удалить синонимы города' };
    }

    const { error } = await supabase
      .from('cities')
      .delete()
      .eq('id', validated.id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Ошибка удаления города:', error);
      return { error: 'Не удалось удалить город' };
    }

    revalidatePath('/settings');
    revalidatePath('/cities');
    return { success: true };
  } catch (err) {
    console.error('Ошибка при удалении города:', err);
    return { error: 'Произошла ошибка при удалении города' };
  }
}

export async function updateCityName(data: UpdateCityData) {
  const supabase = await createServerClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' };
    }

    const validated = updateCitySchema.parse(data);
    const { id, newCityName } = validated;

    // Get the original city name before updating
    const { data: originalCity, error: fetchError } = await supabase
      .from('cities')
      .select('name')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !originalCity) {
      return { error: 'Город не найден' };
    }

    const oldCityName = originalCity.name;

    // Update the city name
    const { error: updateError } = await supabase
      .from('cities')
      .update({ name: newCityName, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (updateError) {
      if (updateError.code === '23505') {
        return { error: 'Город с таким названием уже существует' };
      }
      console.error('Ошибка обновления имени города:', updateError);
      return { error: 'Не удалось обновить имя города' };
    }

    // If the old city name was used as a canonical synonym, update it as well
    if (oldCityName.trim().toLowerCase() !== newCityName.trim().toLowerCase()) {
      const { error: synonymUpdateError } = await supabase
        .from('city_synonyms')
        .update({ synonym: newCityName })
        .eq('user_id', user.id)
        .eq('city_id', id)
        .eq('synonym', oldCityName);

      if (synonymUpdateError) {
        console.warn('Не удалось обновить канонический синоним:', synonymUpdateError);
      }
    }

    revalidatePath('/cities');
    revalidatePath('/settings');

    return { success: true };
  } catch (err) {
    console.error('Ошибка при обновлении имени города:', err);
    return { error: 'Произошла непредвиденная ошибка' };
  }
}

export async function deleteAllCities(userId: string) {
  const supabase = await createServerClient();

  try {
    // First, get all city IDs for the user
    const { data: cities, error: citiesError } = await supabase
      .from('cities')
      .select('id')
      .eq('user_id', userId);

    if (citiesError) {
      console.error('Ошибка при получении городов для массового удаления:', citiesError);
      return { error: 'Не удалось получить города для удаления' };
    }

    const cityIds = cities?.map(city => city.id) || [];

    if (cityIds.length > 0) {
      // Set city_id to null for all expenses linked to these cities
      const { error: updateExpensesError } = await supabase
        .from('expenses')
        .update({ city_id: null, updated_at: new Date().toISOString() })
        .in('city_id', cityIds)
        .eq('user_id', userId);

      if (updateExpensesError) {
        console.error('Ошибка сброса привязки городов в расходах при массовом удалении:', updateExpensesError);
        return { error: 'Не удалось обновить расходы при массовом удалении городов' };
      }

      // Delete all city synonyms for these cities
      const { error: deleteSynonymsError } = await supabase
        .from('city_synonyms')
        .delete()
        .in('city_id', cityIds)
        .eq('user_id', userId);

      if (deleteSynonymsError) {
        console.error('Ошибка удаления синонимов городов при массовом удалении:', deleteSynonymsError);
        return { error: 'Не удалось удалить синонимы городов при массовом удалении' };
      }



      // Finally, delete the cities themselves
      const { error: deleteCitiesError } = await supabase
        .from('cities')
        .delete()
        .in('id', cityIds)
        .eq('user_id', userId);

      if (deleteCitiesError) {
        console.error('Ошибка массового удаления городов:', deleteCitiesError);
        return { error: 'Не удалось удалить города' };
      }
    }

    revalidatePath('/cities');
    revalidatePath('/settings');
    return { success: true };
  } catch (err) {
    console.error('Непредвиденная ошибка при массовом удалении городов:', err);
    return { error: 'Произошла непредвиденная ошибка при массовом удалении городов' };
  }
}

export async function deleteAllCitySynonyms(userId: string) {
  const supabase = await createServerClient();

  try {
    const { error } = await supabase
      .from('city_synonyms')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Ошибка массового удаления синонимов городов:', error);
      return { error: 'Не удалось удалить синонимы городов' };
    }

    // Revalidate paths that might be affected
    revalidatePath('/cities');
    revalidatePath('/settings');
    return { success: true };
  } catch (err) {
    console.error('Непредвиденная ошибка при массовом удалении синонимов городов:', err);
    return { error: 'Произошла непредвиденная ошибка при массовом удалении синонимов городов' };
  }
}