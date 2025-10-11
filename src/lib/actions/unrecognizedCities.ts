'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createServerClient } from '@/lib/supabase/server'
import { createCitySynonym } from './synonyms'

const unrecognizedCityIdSchema = z.object({
  id: z.string().uuid('Некорректный идентификатор города'),
})

const attachUnrecognizedCitySchema = z.object({
  unrecognizedCityId: z.string().uuid('Некорректный идентификатор города'),
  cityId: z.string().uuid('Некорректный идентификатор существующего города'),
})

export async function getUnrecognizedCities() {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    const { data, error } = await supabase
      .from('unrecognized_cities')
      .select('id, name, frequency, first_seen, last_seen')
      .eq('user_id', user.id)
      .order('last_seen', { ascending: false, nullsFirst: false })
      .order('frequency', { ascending: false, nullsFirst: true })

    if (error) {
      console.error('Ошибка загрузки непознанных городов:', error)
      return { error: 'Не удалось загрузить список непознанных городов' }
    }

    return { success: true, data: data ?? [] }
  } catch (error) {
    console.error('Не удалось получить непознанные города:', error)
    return { error: 'Произошла ошибка при загрузке непознанных городов' }
  }
}

export async function resolveUnrecognizedCity(data: { id: string }) {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    const validated = unrecognizedCityIdSchema.parse(data)

    const { error } = await supabase
      .from('unrecognized_cities')
      .delete()
      .eq('id', validated.id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Ошибка удаления непознанного города:', error)
      return { error: 'Не удалось обновить статус города' }
    }

    revalidatePath('/cities')
    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    console.error('Не удалось удалить непознанный город:', error)
    return { error: 'Произошла ошибка при обновлении списка городов' }
  }
}

export async function attachUnrecognizedCity(data: { unrecognizedCityId: string; cityId: string }) {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    const validated = attachUnrecognizedCitySchema.parse(data)

    const { data: unrecognized, error: loadError } = await supabase
      .from('unrecognized_cities')
      .select('id, name')
      .eq('id', validated.unrecognizedCityId)
      .eq('user_id', user.id)
      .single()

    if (loadError || !unrecognized) {
      console.error('Ошибка получения непознанного города:', loadError)
      return { error: 'Не удалось найти выбранный город' }
    }

    const synonymResult = await createCitySynonym({
      cityId: validated.cityId,
      synonym: (unrecognized as any).name,
    })

    if (synonymResult.error) {
      return { error: synonymResult.error }
    }

    const { error: deleteError } = await supabase
      .from('unrecognized_cities')
      .delete()
      .eq('id', validated.unrecognizedCityId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Ошибка удаления непознанного города после привязки:', deleteError)
      return { error: 'Синоним добавлен, но не удалось обновить список непознанных городов' }
    }

    revalidatePath('/cities')
    revalidatePath('/settings')

    return { success: true, data: synonymResult.data }
  } catch (error) {
    console.error('Не удалось прикрепить непознанный город:', error)
    return { error: 'Произошла ошибка при добавлении альтернативного названия' }
  }
}
