'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createSafeSupabaseClient } from '@/lib/supabase/safe-operations'
import { revalidatePath } from 'next/cache'

// --- User Settings ---

export interface UserSettings {
  enable_bilingual_keywords?: boolean
  enable_bilingual_cities?: boolean
}

export async function getUserSettings(): Promise<{ settings?: UserSettings; error?: string }> {
  const supabase = await createServerClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Пользователь не авторизован' }
  }

  return { settings: user.user_metadata as UserSettings }
}

export async function updateUserSettings(newSettings: Partial<UserSettings>): Promise<{ settings?: UserSettings; error?: string }> {
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.updateUser({
    data: newSettings,
  })

  if (error) {
    return { error: 'Ошибка при обновлении настроек: ' + error.message }
  }

  revalidatePath('/', 'layout')

  return { settings: data.user?.user_metadata as UserSettings }
}


// --- Data Deletion ---

interface SelectiveDeleteOptions {
  deleteGroups?: boolean
  deleteCategories?: boolean
  deleteKeywords?: boolean
  deleteExpenses?: boolean
  deleteCitiesAndSynonyms?: boolean // Added new option
}

// Абсолютно новое действие для выборочного удаления
export async function selectiveDelete(options: SelectiveDeleteOptions) {
  const supabaseClient = await createServerClient()
  const supabase = createSafeSupabaseClient(supabaseClient)
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

  if (userError || !user) {
    return { error: 'Пользователь не авторизован' }
  }

  try {
    const deletedItems: string[] = []

    // Обратите внимание: порядок важен из-за внешних ключей.
    // Сначала удаляем расходы, потом ключевые слова, потом категории, потом группы.

    if (options.deleteExpenses) {
      const { error } = await supabaseClient.from('expenses').delete().eq('user_id', user.id)
      if (error) throw new Error('Ошибка при удалении расходов: ' + error.message)
      deletedItems.push('расходы')
    }

    if (options.deleteKeywords) {
      await supabaseClient.from('keyword_synonyms').delete().eq('user_id', user.id)
      await supabaseClient.from('unrecognized_keywords').delete().eq('user_id', user.id)
      const { error } = await supabaseClient.from('category_keywords').delete().eq('user_id', user.id)
      if (error) throw new Error('Ошибка при удалении ключевых слов: ' + error.message)
      deletedItems.push('ключевые слова и синонимы')
    }

    if (options.deleteCategories) {
      // Сначала нужно отвязать категории от расходов, если они не удаляются
      if (!options.deleteExpenses) {
        const { error: updateError } = await supabase
          .from('expenses')
          .update({ category_id: null })
          .eq('user_id', user.id)
        if (updateError) throw new Error('Ошибка при отвязке категорий от расходов: ' + updateError.message)
      }
      const { error } = await supabaseClient.from('categories').delete().eq('user_id', user.id)
      if (error) throw new Error('Ошибка при удалении категорий: ' + error.message)
      deletedItems.push('категории')
    }

    if (options.deleteGroups) {
       // Сначала нужно отвязать группы от категорий, если они не удаляются
      if (!options.deleteCategories) {
        const { error: updateError } = await supabase
          .from('categories')
          .update({ category_group_id: null })
          .eq('user_id', user.id)
        if (updateError) throw new Error('Ошибка при отвязке групп от категорий: ' + updateError.message)
      }
      const { error } = await supabaseClient.from('category_groups').delete().eq('user_id', user.id)
      if (error) throw new Error('Ошибка при удалении групп: ' + error.message)
      deletedItems.push('группы')
    }

    // New logic for deleting cities and synonyms
    if (options.deleteCitiesAndSynonyms) {
      // First, get all city IDs for the user
      const { data: cities, error: citiesError } = await supabaseClient
        .from('cities')
        .select('id')
        .eq('user_id', user.id);

      if (citiesError) {
        throw new Error('Ошибка при получении городов для массового удаления: ' + citiesError.message);
      }

      const cityIds = cities?.map(city => (city as any).id) || [];

      if (cityIds.length > 0) {
        // Set city_id to null for all expenses linked to these cities
        const { error: updateExpensesError } = await supabase
          .from('expenses')
          .update({ city_id: null, updated_at: new Date().toISOString() })
          .in('city_id', cityIds)
          .eq('user_id', user.id);

        if (updateExpensesError) {
          throw new Error('Ошибка сброса привязки городов в расходах при массовом удалении: ' + updateExpensesError.message);
        }

        // Delete all city synonyms for these cities
        const { error: deleteSynonymsError } = await supabase
          .from('city_synonyms')
          .delete()
          .in('city_id', cityIds)
          .eq('user_id', user.id);

        if (deleteSynonymsError) {
          throw new Error('Ошибка удаления синонимов городов при массовом удалении: ' + deleteSynonymsError.message);
        }

        // Delete all unrecognized cities for the user
        const { error: deleteUnrecognizedCitiesError } = await supabase
          .from('unrecognized_cities')
          .delete()
          .eq('user_id', user.id);

        if (deleteUnrecognizedCitiesError) {
          throw new Error('Ошибка удаления неопознанных городов при массовом удалении: ' + deleteUnrecognizedCitiesError.message);
        }



        // Finally, delete the cities themselves
        const { error: deleteCitiesError } = await supabase
          .from('cities')
          .delete()
          .in('id', cityIds)
          .eq('user_id', user.id);

        if (deleteCitiesError) {
          throw new Error('Ошибка массового удаления городов: ' + deleteCitiesError.message);
        }
      }
      deletedItems.push('города и синонимы');
    }


    revalidatePath('/', 'layout')
    revalidatePath('/cities') // Added revalidation for cities page
    return { success: true, message: `Успешно удалены: ${deletedItems.join(', ') || 'ничего'}.` }

  } catch (error: any) {
    return { error: error.message }
  }
}

// Абсолютно новое действие для ПОЛНОГО удаления всех данных
export async function deleteAllUserData() {
  const supabase = await createServerClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Пользователь не авторизован' }
  }

  try {
    const deletedItems: string[] = []

    type SupabaseTable =
      | 'expenses'
      | 'keyword_synonyms'
      | 'unrecognized_keywords'
      | 'category_keywords'
      | 'city_synonyms'
      | 'categories'
      | 'category_groups'
      | 'cities' // Added cities table
      | 'unrecognized_cities' // Added unrecognized_cities table


    const deleteWithCheck = async (
      table: SupabaseTable,
      description: string,
      message?: string,
    ) => {
      const { error } = await supabase.from(table).delete().eq('user_id', user.id)
      if (error) {
        throw new Error(`Ошибка при удалении ${description}: ${error.message}`)
      }

      if (message) {
        deletedItems.push(message)
      }
    }

    await deleteWithCheck('expenses', 'расходов', 'расходы')

    await deleteWithCheck('keyword_synonyms', 'синонимов ключевых слов')
    await deleteWithCheck('unrecognized_keywords', 'неопознанных ключевых слов')
    await deleteWithCheck('category_keywords', 'ключевых слов', 'ключевые слова и синонимы')

    await deleteWithCheck('city_synonyms', 'синонимов городов')
    await deleteWithCheck('unrecognized_cities', 'неопознанных городов')

    await deleteWithCheck('cities', 'городов', 'города и синонимы') // Added cities table

    await deleteWithCheck('categories', 'категорий', 'категории')
    await deleteWithCheck('category_groups', 'групп категорий', 'группы категорий')

    revalidatePath('/', 'layout')
    revalidatePath('/cities') // Added revalidation for cities page
    return {
      success: true,
      message: `Успешно удалены: ${deletedItems.join(', ')}.`, 
    }

  } catch (error: any) {
    return {
      error: 'Произошла ошибка при полном удалении данных: ' + error.message,
    }
  }
}
