'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
// Используем безопасный клиент вместо db helpers

// Типы для резервной копии
interface BackupData {
  metadata: {
    createdAt: string
    appName: string
    userEmail: string
    userId: string
  }
  expenses: any[]
  categories: any[]
  categoryGroups: any[]
  categoryKeywords: any[]
  keywordSynonyms: any[]
  cities: any[]
  citySynonyms: any[]
  unrecognizedCities: any[]
  unrecognizedKeywords: any[]
  bankStatements: any[]
}

interface RestoreResult {
  success: boolean
  message: string
  restored: {
    expenses: number
    categories: number
    categoryGroups: number
    categoryKeywords: number
    keywordSynonyms: number
    cities: number
    citySynonyms: number
    unrecognizedCities: number
    unrecognizedKeywords: number
    bankStatements: number
  }
}

interface DataStats {
  expenses: number
  categories: number
  categoryGroups: number
  categoryKeywords: number
  keywordSynonyms: number
  cities: number
  citySynonyms: number
  unrecognizedCities: number
  unrecognizedKeywords: number
  bankStatements: number
  totalRecords: number
}

// Получить статистику данных пользователя
export async function getUserDataStats(): Promise<{ success: boolean; stats?: DataStats; error?: string }> {
  try {
    const supabase = await createServerClient()
    
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Пользователь не авторизован' }
    }

    // Получаем количество записей в каждой таблице
    const [
      expensesCount,
      categoriesCount,
      categoryGroupsCount,
      categoryKeywordsCount,
      keywordSynonymsCount,
      citiesCount,
      citySynonymsCount,
      unrecognizedCitiesCount,
      unrecognizedKeywordsCount,
      bankStatementsCount
    ] = await Promise.all([
      supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('categories').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('category_groups').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('category_keywords').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('keyword_synonyms').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('cities').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('city_synonyms').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('unrecognized_cities').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('unrecognized_keywords').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('bank_statements').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    ])

    const stats: DataStats = {
      expenses: expensesCount.count || 0,
      categories: categoriesCount.count || 0,
      categoryGroups: categoryGroupsCount.count || 0,
      categoryKeywords: categoryKeywordsCount.count || 0,
      keywordSynonyms: keywordSynonymsCount.count || 0,
      cities: citiesCount.count || 0,
      citySynonyms: citySynonymsCount.count || 0,
      unrecognizedCities: unrecognizedCitiesCount.count || 0,
      unrecognizedKeywords: unrecognizedKeywordsCount.count || 0,
      bankStatements: bankStatementsCount.count || 0,
      totalRecords: 0
    }

    stats.totalRecords = Object.values(stats).reduce((sum, count) => sum + count, 0) - stats.totalRecords

    return { success: true, stats }
  } catch (error) {
    console.error('Ошибка при получении статистики:', error)
    return { success: false, error: 'Неожиданная ошибка при получении статистики' }
  }
}

// Получить все данные пользователя для резервной копии
export async function getAllUserData(): Promise<{ success: boolean; data?: BackupData; error?: string }> {
  try {
    const supabase = await createServerClient()
    
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Пользователь не авторизован' }
    }

    // Получаем все данные пользователя параллельно
    const [
      expensesResult,
      categoriesResult,
      categoryGroupsResult,
      categoryKeywordsResult,
      keywordSynonymsResult,
      citiesResult,
      citySynonymsResult,
      unrecognizedCitiesResult,
      unrecognizedKeywordsResult,
      bankStatementsResult
    ] = await Promise.all([
      supabase.from('expenses').select('*').eq('user_id', user.id),
      supabase.from('categories').select('*').eq('user_id', user.id),
      supabase.from('category_groups').select('*').eq('user_id', user.id),
      supabase.from('category_keywords').select('*').eq('user_id', user.id),
      supabase.from('keyword_synonyms').select('*').eq('user_id', user.id),
      supabase.from('cities').select('*').eq('user_id', user.id),
      supabase.from('city_synonyms').select('*').eq('user_id', user.id),
      supabase.from('unrecognized_cities').select('*').eq('user_id', user.id),
      supabase.from('unrecognized_keywords').select('*').eq('user_id', user.id),
      supabase.from('bank_statements').select('*').eq('user_id', user.id)
    ])

    // Проверяем ошибки
    const errors = [
      expensesResult.error,
      categoriesResult.error,
      categoryGroupsResult.error,
      categoryKeywordsResult.error,
      keywordSynonymsResult.error,
      citiesResult.error,
      citySynonymsResult.error,
      unrecognizedCitiesResult.error,
      unrecognizedKeywordsResult.error,
      bankStatementsResult.error
    ].filter(Boolean)

    if (errors.length > 0) {
      console.error('Ошибки при получении данных:', errors)
      return { success: false, error: 'Ошибка при получении данных из базы' }
    }

    const backupData: BackupData = {
      metadata: {
        createdAt: new Date().toISOString(),
        appName: 'Expense Tracker',
        userEmail: user.email || '',
        userId: user.id
      },
      expenses: expensesResult.data || [],
      categories: categoriesResult.data || [],
      categoryGroups: categoryGroupsResult.data || [],
      categoryKeywords: categoryKeywordsResult.data || [],
      keywordSynonyms: keywordSynonymsResult.data || [],
      cities: citiesResult.data || [],
      citySynonyms: citySynonymsResult.data || [],
      unrecognizedCities: unrecognizedCitiesResult.data || [],
      unrecognizedKeywords: unrecognizedKeywordsResult.data || [],
      bankStatements: bankStatementsResult.data || []
    }

    console.log('=== СОЗДАНИЕ РЕЗЕРВНОЙ КОПИИ ===')
    console.log('Данные получены из базы:')
    console.log('- Расходы:', expensesResult.data?.length || 0)
    console.log('- Категории:', categoriesResult.data?.length || 0)
    console.log('- Группы категорий:', categoryGroupsResult.data?.length || 0)
    console.log('- Ключевые слова категорий:', categoryKeywordsResult.data?.length || 0)
    console.log('- Синонимы слов:', keywordSynonymsResult.data?.length || 0)
    console.log('- Города:', citiesResult.data?.length || 0)
    console.log('- Синонимы городов:', citySynonymsResult.data?.length || 0)
    console.log('- Неопознанные города:', unrecognizedCitiesResult.data?.length || 0)
    console.log('- Неопознанные слова:', unrecognizedKeywordsResult.data?.length || 0)
    console.log('- Банковские выписки:', bankStatementsResult.data?.length || 0)

    return { success: true, data: backupData }
  } catch (error) {
    console.error('Ошибка при создании резервной копии:', error)
    return { success: false, error: 'Неожиданная ошибка при создании резервной копии' }
  }
}

// Предварительный просмотр восстановления (без удаления данных)
export async function previewRestore(backupData: BackupData): Promise<{
  success: boolean
  message: string
  preview: {
    currentData: DataStats
    backupData: DataStats
    willBeDeleted: DataStats
    willBeRestored: DataStats
  }
}> {
  try {
    const supabase = await createServerClient()
    
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Пользователь не авторизован', preview: {} as any }
    }

    // Получаем текущую статистику
    const currentStatsResult = await getUserDataStats()
    if (!currentStatsResult.success || !currentStatsResult.stats) {
      return { success: false, message: 'Ошибка получения текущих данных', preview: {} as any }
    }

    const currentData = currentStatsResult.stats

    // Подсчитываем данные в резервной копии
    const backupStats: DataStats = {
      expenses: backupData.expenses?.length || 0,
      categories: backupData.categories?.length || 0,
      categoryGroups: backupData.categoryGroups?.length || 0,
      categoryKeywords: backupData.categoryKeywords?.length || 0,
      keywordSynonyms: backupData.keywordSynonyms?.length || 0,
      cities: backupData.cities?.length || 0,
      citySynonyms: backupData.citySynonyms?.length || 0,
      unrecognizedCities: backupData.unrecognizedCities?.length || 0,
      unrecognizedKeywords: backupData.unrecognizedKeywords?.length || 0,
      bankStatements: backupData.bankStatements?.length || 0,
      totalRecords: 0
    }
    backupStats.totalRecords = Object.values(backupStats).reduce((sum, count) => sum + count, 0) - backupStats.totalRecords

    return {
      success: true,
      message: 'Предварительный просмотр готов',
      preview: {
        currentData,
        backupData: backupStats,
        willBeDeleted: currentData, // Все текущие данные будут удалены
        willBeRestored: backupStats // Все данные из резервной копии будут восстановлены
      }
    }
  } catch (error) {
    console.error('Ошибка предварительного просмотра:', error)
    return { success: false, message: 'Ошибка предварительного просмотра', preview: {} as any }
  }
}

// Восстановить данные из резервной копии (с подтверждением)
export async function restoreUserDataWithConfirmation(
  backupData: BackupData, 
  confirmationToken: string
): Promise<RestoreResult> {
  // Проверяем токен подтверждения (простая проверка)
  const expectedToken = `restore_${backupData.metadata.userId}_${Date.now().toString().slice(-6)}`
  if (!confirmationToken.startsWith('restore_')) {
    return {
      success: false,
      message: 'Неверный токен подтверждения',
      restored: {
        expenses: 0, categories: 0, categoryGroups: 0, categoryKeywords: 0,
        keywordSynonyms: 0, cities: 0, citySynonyms: 0, unrecognizedCities: 0,
        unrecognizedKeywords: 0, bankStatements: 0
      }
    }
  }

  return await restoreUserData(backupData)
}

// Генерировать токен подтверждения
export async function generateRestoreConfirmationToken(backupData: BackupData): Promise<{
  success: boolean
  token?: string
  message: string
}> {
  try {
    const supabase = await createServerClient()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Пользователь не авторизован' }
    }

    const token = `restore_${user.id}_${Date.now().toString().slice(-6)}`
    
    return {
      success: true,
      token,
      message: 'Токен подтверждения создан'
    }
  } catch (error) {
    return { success: false, message: 'Ошибка создания токена' }
  }
}

// Восстановить данные из резервной копии
export async function restoreUserData(backupData: BackupData): Promise<RestoreResult> {
  const supabase = await createServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, message: 'Пользователь не авторизован', restored: {} as any };
  }

  const restored = {
    expenses: 0, categories: 0, categoryGroups: 0, categoryKeywords: 0,
    keywordSynonyms: 0, cities: 0, citySynonyms: 0, unrecognizedCities: 0,
    unrecognizedKeywords: 0, bankStatements: 0
  };

  try {
    console.log('=== НАЧАЛО ТРАНЗАКЦИИ ВОССТАНОВЛЕНИЯ ===');

    // 1. Очистка старых данных
    const tablesToDelete = ['expenses', 'keyword_synonyms', 'city_synonyms', 'category_keywords', 'unrecognized_cities', 'unrecognized_keywords', 'categories', 'cities', 'category_groups', 'bank_statements'];
    for (const table of tablesToDelete) {
      const { error: deleteError } = await supabase.from(table).delete().eq('user_id', user.id);
      if (deleteError) {
        console.error(`Ошибка при очистке таблицы ${table}:`, deleteError.message);
        throw new Error(`Не удалось очистить таблицу ${table} перед восстановлением.`);
      }
    }
    console.log('✅ Все старые данные пользователя удалены.');

    // 2. Восстановление с маппингом ID
    const idMapping = {
      category_groups: new Map<string, string>(),
      cities: new Map<string, string>(),
      categories: new Map<string, string>(),
      category_keywords: new Map<string, string>(),
      bank_statements: new Map<string, string>(),
    };

    const restoreTable = async (tableName: string, records: any[], deps?: { [key: string]: Map<any, any> }) => {
      if (!records || records.length === 0) return;

      const recordsToInsert = records.map((record) => {
        const { id, ...rest } = record;
        const newRecord = { ...rest, user_id: user.id };

        // Для `bank_statements` принудительно удаляем временные метки, так как их нет в схеме
        if (tableName === 'bank_statements') {
          delete (newRecord as any).created_at;
          delete (newRecord as any).updated_at;
        }

        if (deps) {
          for (const [key, map] of Object.entries(deps)) {
            if (newRecord[key] && map) {
              newRecord[key] = map.get(newRecord[key]);
            }
          }
        }
        return newRecord;
      });

      const { data: newRecords, error } = await (supabase as any)
        .from(tableName)
        .insert(recordsToInsert)
        .select()
      if (error) {
        console.error(`❌ Ошибка восстановления ${tableName}:`, error);
        throw new Error(`Не удалось восстановить данные для таблицы ${tableName}. Ошибка: ${error.message}`);
      }

      if (newRecords && idMapping[tableName as keyof typeof idMapping]) {
        records.forEach((orig, i) => idMapping[tableName as keyof typeof idMapping].set(orig.id, newRecords[i].id));
      }
      (restored as any)[tableName.replace(/_s$/, '')] = newRecords?.length || 0;
       console.log(`✅ ${tableName}: ${newRecords?.length || 0}`);
    };

    await restoreTable('category_groups', backupData.categoryGroups);
    await restoreTable('cities', backupData.cities);
    await restoreTable('bank_statements', backupData.bankStatements);
    await restoreTable('categories', backupData.categories, { category_group_id: idMapping.category_groups });
    await restoreTable('category_keywords', backupData.categoryKeywords, { category_id: idMapping.categories });
    await restoreTable('keyword_synonyms', backupData.keywordSynonyms, { keyword_id: idMapping.category_keywords });
    await restoreTable('city_synonyms', backupData.citySynonyms, { city_id: idMapping.cities });
    await restoreTable('unrecognized_cities', backupData.unrecognizedCities);
    await restoreTable('unrecognized_keywords', backupData.unrecognizedKeywords);
    await restoreTable('expenses', backupData.expenses, { category_id: idMapping.categories, city_id: idMapping.cities, batch_id: idMapping.bank_statements });

    console.log('=== ВОССТАНОВЛЕНИЕ ЗАВЕРШЕНО ===');
    revalidatePath('/');
    const totalRestored = Object.values(restored).reduce((sum, count) => sum + count, 0);
    return { success: true, message: `Успешно восстановлено ${totalRestored} записей`, restored };

  } catch (error: any) {
    console.error('Критическая ошибка при восстановлении:', error);
    return { success: false, message: error.message || 'Произошла критическая ошибка во время восстановления.', restored };
  }
}

