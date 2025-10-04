'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { keywordSchema, updateKeywordSchema, assignKeywordToCategorySchema } from '@/lib/validations/keywords'
import { keywordSynonymSchema } from '@/lib/validations/synonyms'
import { extractKeywords } from '@/lib/utils/keywords'
import type {
  CreateKeywordData,
  UpdateKeywordData,
  AssignKeywordData,
  CategoryKeyword,
  CategoryKeywordWithSynonyms,
  KeywordSynonym,
  UnrecognizedKeyword,
  CategorizationResult,
  KeywordMatch,
  ExistingKeyword
} from '@/types'

// Создание нового ключевого слова для категории
export async function createKeyword(data: CreateKeywordData) {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    const validatedData = keywordSchema.parse(data)

    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id')
      .eq('id', validatedData.category_id)
      .eq('user_id', user.id)
      .single()

    if (categoryError || !category) {
      return { error: 'Категория не найдена' }
    }

    const { data: keyword, error } = await supabase
      .from('category_keywords')
      .insert({
        user_id: user.id,
        keyword: validatedData.keyword,
        category_id: validatedData.category_id
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { 
        return { error: 'Это ключевое слово уже существует' }
      }
      console.error('Ошибка создания ключевого слова:', error)
      return { error: 'Не удалось создать ключевое слово' }
    }

    await supabase
      .from('unrecognized_keywords')
      .delete()
      .eq('keyword', validatedData.keyword)
      .eq('user_id', user.id)

    revalidatePath('/categories')
    return { success: true, data: keyword }
  } catch (err) {
    console.error('Ошибка валидации ключевого слова:', err)
    return { error: 'Неверные данные ключевого слова' }
  }
}

// Обновление ключевого слова
export async function updateKeyword(id: string, data: UpdateKeywordData) {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    const validatedData = updateKeywordSchema.parse(data)

    if (validatedData.category_id) {
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('id', validatedData.category_id)
        .eq('user_id', user.id)
        .single()

      if (categoryError || !category) {
        return { error: 'Категория не найдена' }
      }
    }

    const { data: keyword, error } = await supabase
      .from('category_keywords')
      .update(validatedData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { 
        return { error: 'Это ключевое слово уже существует' }
      }
      console.error('Ошибка обновления ключевого слова:', error)
      return { error: 'Не удалось обновить ключевое слово' }
    }

    revalidatePath('/categories')
    return { success: true, data: keyword }
  } catch (err) {
    console.error('Ошибка валидации ключевого слова:', err)
    return { error: 'Неверные данные ключевого слова' }
  }
}

// Удаление ключевого слова
export async function deleteKeyword(id: string) {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    const { error } = await supabase
      .from('category_keywords')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Ошибка удаления ключевого слова:', error)
      return { error: 'Не удалось удалить ключевое слово' }
    }

    revalidatePath('/categories')
    return { success: true }
  } catch (err) {
    console.error('Ошибка удаления ключевого слова:', err)
    return { error: 'Произошла ошибка при удалении' }
  }
}

// Получение всех ключевых слов пользователя
export async function getAllKeywords() {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    const { data: keywords, error } = await supabase
      .from('category_keywords')
      .select(`
        *,
        categories (
          id,
          name,
          color,
          icon
        ),
        keyword_synonyms (
          id,
          synonym,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Ошибка получения ключевых слов:', error)
      return { error: 'Не удалось загрузить ключевые слова' }
    }

    return { success: true, data: keywords || [] }
  } catch (err) {
    console.error('Ошибка получения ключевых слов:', err)
    return { error: 'Произошла ошибка при загрузке' }
  }
}

// Получение ключевых слов для конкретной категории
export async function getKeywordsByCategory(categoryId: string) {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    const { data: keywords, error } = await supabase
      .from('category_keywords')
      .select(`
        *,
        keyword_synonyms (
          id,
          synonym,
          created_at
        )
      `)
      .eq('category_id', categoryId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Ошибка получения ключевых слов категории:', error)
      return { error: 'Не удалось загрузить ключевые слова' }
    }

    return { success: true, data: keywords || [] }
  } catch (err) {
    console.error('Ошибка получения ключевых слов категории:', err)
    return { error: 'Произошла ошибка при загрузке' }
  }
}

// Назначение категории ключевому слову (из неопознанных)
export async function assignCategoryToKeyword(data: AssignKeywordData) {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    const validatedData = assignKeywordToCategorySchema.parse(data)

    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id')
      .eq('id', validatedData.category_id)
      .eq('user_id', user.id)
      .single()

    if (categoryError || !category) {
      return { error: 'Категория не найдена' }
    }

    const { data: keyword, error: keywordError } = await supabase
      .from('category_keywords')
      .insert({
        user_id: user.id,
        keyword: validatedData.keyword,
        category_id: validatedData.category_id,
      })
      .select()
      .single()

    if (keywordError) {
      if (keywordError.code === '23505') {
        return { error: 'Это ключевое слово уже назначено категории' }
      }
      console.error('Ошибка назначения ключевого слова:', keywordError)
      return { error: 'Не удалось назначить ключевое слово' }
    }

    await supabase
      .from('unrecognized_keywords')
      .delete()
      .eq('keyword', validatedData.keyword)
      .eq('user_id', user.id)

    await recategorizeExpensesByKeyword(validatedData.keyword, validatedData.category_id)

    revalidatePath('/categories')
    revalidatePath('/expenses')
    
    return { success: true, data: keyword }
  } catch (err) {
    console.error('Ошибка валидации назначения ключевого слова:', err)
    return { error: 'Неверные данные' }
  }
}

// Автоматическая категоризация расхода по описанию
export async function categorizeExpense(description: string): Promise<CategorizationResult> {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { category_id: null, matched_keywords: [], auto_categorized: false }
    }

    const { data: keywords, error } = await supabase
      .from('category_keywords')
      .select(`
        id,
        keyword,
        category_id,
        keyword_synonyms (
          id,
          synonym
        )
      `)
      .eq('user_id', user.id)

    if (error || !keywords) {
      return { category_id: null, matched_keywords: [], auto_categorized: false }
    }

    const descriptionLower = description.toLowerCase()
    const matches: KeywordMatch[] = []
    const seenLabels = new Set<string>()

    const addMatch = (categoryId: string | null | undefined, label: string) => {
      if (!categoryId) return
      if (seenLabels.has(label)) return
      seenLabels.add(label)
      matches.push({
        keyword: label,
        category_id: categoryId
      })
    }

    for (const kw of keywords as CategoryKeywordWithSynonyms[]) {
      const baseKeyword = kw.keyword?.toLowerCase()
      if (baseKeyword && descriptionLower.includes(baseKeyword)) {
        addMatch(kw.category_id, kw.keyword)
        continue
      }

      const synonyms = (kw.keyword_synonyms || []) as KeywordSynonym[]
      for (const synonym of synonyms) {
        const normalizedSynonym = synonym.synonym?.toLowerCase()
        if (normalizedSynonym && descriptionLower.includes(normalizedSynonym)) {
          const label = `${kw.keyword} (${synonym.synonym})`
          addMatch(kw.category_id, label)
          break
        }
      }
    }

    if (matches.length === 0) {
      await saveUnrecognizedKeywords(description)
      return { category_id: null, matched_keywords: [], auto_categorized: false }
    }

    const bestMatch = matches[0]

    return {
      category_id: bestMatch.category_id,
      matched_keywords: matches.map(m => m.keyword),
      auto_categorized: true
    }
  } catch (error) {
    console.error('Ошибка категоризации:', error)
    return { category_id: null, matched_keywords: [], auto_categorized: false }
  }
}


// Сохранение неопознанных ключевых слов
export async function saveUnrecognizedKeywords(description: string) {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    const words = extractKeywords(description)
    if (words.length === 0) {
      return { success: true, message: 'Нет ключевых слов для сохранения' }
    }

    const { data: existingKeywords } = await supabase
      .from('category_keywords')
      .select(`
        keyword,
        keyword_synonyms (synonym)
      `)
      .eq('user_id', user.id)

    const existingKeywordSet = new Set<string>()
    existingKeywords?.forEach((k: ExistingKeyword) => {
      if (k.keyword) existingKeywordSet.add(k.keyword.toLowerCase())
      const synonyms = (k.keyword_synonyms || [])
      synonyms.forEach(s => {
        if (s.synonym) existingKeywordSet.add(s.synonym.toLowerCase())
      })
    })

    const newWords = words.filter(word => !existingKeywordSet.has(word.toLowerCase()))

    if (newWords.length === 0) {
      return { success: true, message: 'Все ключевые слова уже известны' }
    }

    for (const word of newWords) {
      const { data: existing } = await supabase
        .from('unrecognized_keywords')
        .select('id, frequency')
        .eq('user_id', user.id)
        .eq('keyword', word)
        .single()

      if (existing) {
        await supabase
          .from('unrecognized_keywords')
          .update({
            frequency: (existing.frequency || 0) + 1,
            last_seen: new Date().toISOString()
          })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('unrecognized_keywords')
          .insert({
            user_id: user.id,
            keyword: word,
            frequency: 1,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString()
          })
      }
    }

    return { success: true, data: newWords }
  } catch (error) {
    console.error('Ошибка сохранения неопознанных ключевых слов:', error)
    return { error: 'Не удалось сохранить ключевые слова' }
  }
}

// Получение неопознанных ключевых слов
export async function getUnrecognizedKeywords() {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    const { data: keywords, error } = await supabase
      .from('unrecognized_keywords')
      .select('*')
      .eq('user_id', user.id)
      .order('frequency', { ascending: false })

    if (error) {
      console.error('Ошибка получения неопознанных ключевых слов:', error)
      return { error: 'Не удалось загрузить неопознанные ключевые слова' }
    }

    return { success: true, data: keywords || [] }
  } catch (err) {
    console.error('Ошибка получения неопознанных ключевых слов:', err)
    return { error: 'Произошла ошибка при загрузке' }
  }
}

// Перекатегоризация трат по новому ключевому слову
async function recategorizeExpensesByKeyword(keyword: string, categoryId: string) {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    const { data: expenses } = await supabase
      .from('expenses')
      .select('id, description')
      .eq('user_id', user.id)
      .eq('status', 'uncategorized')
      .ilike('description', `%${keyword}%`)

    if (expenses && expenses.length > 0) {
      const expenseIds = expenses.map(e => e.id)

      await supabase
        .from('expenses')
        .update({
          category_id: categoryId,
          status: 'categorized',
          auto_categorized: true,
          matched_keywords: [keyword],
          updated_at: new Date().toISOString()
        })
        .in('id', expenseIds)
    }

    return { success: true, recategorized: expenses?.length || 0 }
  } catch (error) {
    console.error('Ошибка перекатегоризации:', error)
    return { error: 'Не удалось перекатегоризировать траты' }
  }
}

// Обновление неопознанного ключевого слова
export async function updateUnrecognizedKeyword(id: string, newKeyword: string) {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    const trimmedKeyword = newKeyword.trim()
    if (!trimmedKeyword) {
      return { error: 'Ключевое слово не может быть пустым' }
    }

    // Проверяем, не существует ли уже такое ключевое слово
    const { data: existing } = await supabase
      .from('unrecognized_keywords')
      .select('id')
      .eq('user_id', user.id)
      .eq('keyword', trimmedKeyword)
      .neq('id', id)
      .single()

    if (existing) {
      return { error: 'Такое ключевое слово уже существует' }
    }

    const { data: keyword, error } = await supabase
      .from('unrecognized_keywords')
      .update({ 
        keyword: trimmedKeyword,
        last_seen: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Ошибка обновления неопознанного ключевого слова:', error)
      return { error: 'Не удалось обновить ключевое слово' }
    }

    return { success: true, data: keyword }
  } catch (err) {
    console.error('Ошибка обновления неопознанного ключевого слова:', err)
    return { error: 'Произошла ошибка при обновлении' }
  }
}

// Создание нового ключевого слова с синонимом из неопознанного
export async function createKeywordWithSynonym(data: {
  newKeyword: string
  synonym: string
  category_id: string
}) {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    // Проверяем категорию
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id')
      .eq('id', data.category_id)
      .eq('user_id', user.id)
      .single()

    if (categoryError || !category) {
      return { error: 'Категория не найдена' }
    }

    // Создаем основное ключевое слово
    const { data: keyword, error: keywordError } = await supabase
      .from('category_keywords')
      .insert({
        user_id: user.id,
        keyword: data.newKeyword.trim(),
        category_id: data.category_id
      })
      .select()
      .single()

    if (keywordError) {
      if (keywordError.code === '23505') {
        return { error: 'Такое ключевое слово уже существует' }
      }
      console.error('Ошибка создания ключевого слова:', keywordError)
      return { error: 'Не удалось создать ключевое слово' }
    }

    // Добавляем синоним
    const { data: synonymData, error: synonymError } = await supabase
      .from('keyword_synonyms')
      .insert({
        keyword_id: keyword.id,
        synonym: data.synonym.trim(),
        user_id: user.id
      })
      .select()
      .single()

    if (synonymError) {
      // Если синоним не удалось создать, удаляем ключевое слово
      await supabase
        .from('category_keywords')
        .delete()
        .eq('id', keyword.id)
      
      if (synonymError.code === '23505') {
        return { error: 'Такой синоним уже существует' }
      }
      console.error('Ошибка создания синонима:', synonymError)
      return { error: 'Не удалось создать синоним' }
    }

    // Удаляем из неопознанных
    await supabase
      .from('unrecognized_keywords')
      .delete()
      .eq('keyword', data.synonym.trim())
      .eq('user_id', user.id)

    // Перекатегоризируем расходы
    await recategorizeExpensesByKeyword(data.synonym.trim(), data.category_id)

    revalidatePath('/categories')
    revalidatePath('/expenses')
    
    return { success: true, data: { keyword, synonym: synonymData } }
  } catch (err) {
    console.error('Ошибка создания ключевого слова с синонимом:', err)
    return { error: 'Произошла ошибка при создании' }
  }
}

// Добавление синонима к существующему ключевому слову
export async function addSynonymToKeyword(data: {
  keyword_id: string
  synonym: string
}) {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    const validatedData = keywordSynonymSchema.parse(data)

    // Проверяем, что ключевое слово принадлежит пользователю
    const { data: keyword, error: keywordError } = await supabase
      .from('category_keywords')
      .select('id, category_id')
      .eq('id', validatedData.keyword_id)
      .eq('user_id', user.id)
      .single()

    if (keywordError || !keyword) {
      return { error: 'Ключевое слово не найдено' }
    }

    // Добавляем синоним
    const { data: synonymData, error: synonymError } = await supabase
      .from('keyword_synonyms')
      .insert({
        keyword_id: validatedData.keyword_id,
        synonym: validatedData.synonym.trim(),
        user_id: user.id
      })
      .select()
      .single()

    if (synonymError) {
      if (synonymError.code === '23505') {
        return { error: 'Такой синоним уже существует' }
      }
      console.error('Ошибка создания синонима:', synonymError)
      return { error: 'Не удалось создать синоним' }
    }

    // Удаляем из неопознанных
    await supabase
      .from('unrecognized_keywords')
      .delete()
      .eq('keyword', validatedData.synonym.trim())
      .eq('user_id', user.id)

    // Перекатегоризируем расходы
    if (keyword.category_id) {
      await recategorizeExpensesByKeyword(validatedData.synonym.trim(), keyword.category_id)
    }

    revalidatePath('/categories')
    revalidatePath('/expenses')
    
    return { success: true, data: synonymData }
  } catch (err) {
    console.error('Ошибка добавления синонима:', err)
    return { error: 'Произошла ошибка при добавлении синонима' }
  }
}

// Массовое назначение категории ключевым словам
export async function bulkAssignCategoryToKeywords(data: {
  keywords: string[]
  category_id: string
}) {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    // Проверяем категорию
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id')
      .eq('id', data.category_id)
      .eq('user_id', user.id)
      .single()

    if (categoryError || !category) {
      return { error: 'Категория не найдена' }
    }

    // Создаем ключевые слова массово
    const keywordsToInsert = data.keywords.map(keyword => ({
      user_id: user.id,
      keyword: keyword.trim(),
      category_id: data.category_id
    }))

    const { data: createdKeywords, error: keywordError } = await supabase
      .from('category_keywords')
      .insert(keywordsToInsert)
      .select()

    if (keywordError) {
      console.error('Ошибка массового создания ключевых слов:', keywordError)
      return { error: 'Не удалось создать ключевые слова' }
    }

    // Удаляем из неопознанных массово
    await supabase
      .from('unrecognized_keywords')
      .delete()
      .in('keyword', data.keywords.map(k => k.trim()))
      .eq('user_id', user.id)

    // Перекатегоризируем расходы для всех ключевых слов
    for (const keyword of data.keywords) {
      await recategorizeExpensesByKeyword(keyword.trim(), data.category_id)
    }

    revalidatePath('/categories')
    revalidatePath('/expenses')
    
    return { success: true, data: createdKeywords, count: data.keywords.length }
  } catch (err) {
    console.error('Ошибка массового назначения ключевых слов:', err)
    return { error: 'Произошла ошибка при массовом назначении' }
  }
}

// Массовое добавление синонимов к ключевому слову
export async function bulkAddSynonymsToKeyword(data: {
  keyword_id: string
  synonyms: string[]
}) {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    // Проверяем, что ключевое слово принадлежит пользователю
    const { data: keyword, error: keywordError } = await supabase
      .from('category_keywords')
      .select('id, category_id')
      .eq('id', data.keyword_id)
      .eq('user_id', user.id)
      .single()

    if (keywordError || !keyword) {
      return { error: 'Ключевое слово не найдено' }
    }

    // Создаем синонимы массово
    const synonymsToInsert = data.synonyms.map(synonym => ({
      keyword_id: data.keyword_id,
      synonym: synonym.trim(),
      user_id: user.id
    }))

    const { data: createdSynonyms, error: synonymError } = await supabase
      .from('keyword_synonyms')
      .insert(synonymsToInsert)
      .select()

    if (synonymError) {
      console.error('Ошибка массового создания синонимов:', synonymError)
      return { error: 'Не удалось создать синонимы' }
    }

    // Удаляем из неопознанных массово
    await supabase
      .from('unrecognized_keywords')
      .delete()
      .in('keyword', data.synonyms.map(s => s.trim()))
      .eq('user_id', user.id)

    // Перекатегоризируем расходы для всех синонимов
    if (keyword.category_id) {
      for (const synonym of data.synonyms) {
        await recategorizeExpensesByKeyword(synonym.trim(), keyword.category_id)
      }
    }

    revalidatePath('/categories')
    revalidatePath('/expenses')
    
    return { success: true, data: createdSynonyms, count: data.synonyms.length }
  } catch (err) {
    console.error('Ошибка массового добавления синонимов:', err)
    return { error: 'Произошла ошибка при массовом добавлении синонимов' }
  }
}

// Массовое удаление неопознанных ключевых слов
export async function bulkDeleteUnrecognizedKeywords(ids: string[]) {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    const { error } = await supabase
      .from('unrecognized_keywords')
      .delete()
      .in('id', ids)
      .eq('user_id', user.id)

    if (error) {
      console.error('Ошибка массового удаления неопознанных ключевых слов:', error)
      return { error: 'Не удалось удалить ключевые слова' }
    }

    return { success: true, count: ids.length }
  } catch (err) {
    console.error('Ошибка массового удаления неопознанных ключевых слов:', err)
    return { error: 'Произошла ошибка при массовом удалении' }
  }
}

// Удаление неопознанного ключевого слова
export async function deleteUnrecognizedKeyword(id: string) {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    const { error } = await supabase
      .from('unrecognized_keywords')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Ошибка удаления неопознанного ключевого слова:', error)
      return { error: 'Не удалось удалить ключевое слово' }
    }

    return { success: true }
  } catch (err) {
    console.error('Ошибка удаления неопознанного ключевого слова:', err)
    return { error: 'Произошла ошибка при удалении' }
  }
}