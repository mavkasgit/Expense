'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
// Используем безопасный клиент вместо db helpers
import { categorySchema, updateCategorySchema } from '@/lib/validations/categories'
import type { CreateCategoryData } from '@/types'

export async function createCategory(data: CreateCategoryData) {
  const supabase = await createServerClient()

  try {
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    // Проверяем данные
    const validatedData = categorySchema.parse(data)

    // Создаем категорию
    const { data: category, error } = await (supabase as any)
      .from('categories')
      .insert({
        user_id: user.id,
        name: validatedData.name,
      color: validatedData.color || '#6366f1',
      icon: validatedData.icon || 'shopping-bag',
      category_group_id: validatedData.category_group_id
    }).select().single()

    if (error) {
      console.error('Ошибка создания категории:', error)
      return { error: 'Не удалось создать категорию' }
    }

    revalidatePath('/categories')
    return { success: true, data: category }
  } catch (err) {
    console.error('Ошибка валидации категории:', err)
    return { error: 'Неверные данные категории' }
  }
}

export async function updateCategory(id: string, data: Partial<CreateCategoryData>) {
  const supabase = await createServerClient()

  try {
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    // Проверяем данные
    const validatedData = updateCategorySchema.parse(data)

    // Обновляем категорию
    const { data: category, error } = await (supabase as any)
      .from('categories')
      .update({
        name: validatedData.name,
        color: validatedData.color,
      icon: validatedData.icon,
      category_group_id: validatedData.category_group_id,
      updated_at: new Date().toISOString()
    }).eq('id', id).eq('user_id', user.id).select().single()

    if (error) {
      console.error('Ошибка обновления категории:', error)
      return { error: 'Не удалось обновить категорию' }
    }

    revalidatePath('/categories')
    return { success: true, data: category }
  } catch (err) {
    console.error('Ошибка валидации категории:', err)
    return { error: 'Неверные данные категории' }
  }
}

export async function deleteCategory(id: string) {
  const supabase = await createServerClient()

  try {
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    // Проверяем, есть ли расходы с этой категорией
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('id')
      .eq('category_id', id)
      .eq('user_id', user.id)
      .limit(1)

    if (expensesError) {
      console.error('Ошибка проверки расходов:', expensesError)
      return { error: 'Не удалось проверить связанные расходы' }
    }

    if (expenses && expenses.length > 0) {
      return { error: 'Нельзя удалить категорию, которая используется в расходах' }
    }

    // Удаляем категорию
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // Проверяем, что категория принадлежит пользователю

    if (error) {
      console.error('Ошибка удаления категории:', error)
      return { error: 'Не удалось удалить категорию' }
    }

    revalidatePath('/categories')
    return { success: true }
  } catch (err) {
    console.error('Ошибка удаления категории:', err)
    return { error: 'Произошла ошибка при удалении' }
  }
}



export async function getCategories() {
  const supabase = await createServerClient()

  try {
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    // Получаем категории пользователя
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Ошибка получения категорий:', error)
      return { error: 'Не удалось загрузить категории' }
    }

    return { success: true, data: categories || [] }
  } catch (err) {
    console.error('Ошибка получения категорий:', err)
    return { error: 'Произошла ошибка при загрузке' }
  }
}

// Функция для принудительного создания стандартных групп
export async function ensureStandardGroups() {
  const supabase = await createServerClient()

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    const standardGroups = [
      { name: 'Основные', icon: 'shopping-bag', color: '#6366f1', sort_order: 1 },
      { name: 'Транспорт', icon: 'car', color: '#3b82f6', sort_order: 2 },
      { name: 'Еда и напитки', icon: 'food', color: '#f59e0b', sort_order: 3 },
      { name: 'Развлечения', icon: 'entertainment', color: '#ec4899', sort_order: 4 },
      { name: 'Здоровье', icon: 'health', color: '#ef4444', sort_order: 5 },
      { name: 'Дом и быт', icon: 'home', color: '#10b981', sort_order: 6 },
      { name: 'Образование', icon: 'education', color: '#8b5cf6', sort_order: 7 },
      { name: 'Путешествия', icon: 'travel', color: '#06b6d4', sort_order: 8 }
    ]

    const groupsToInsert = standardGroups.map(group => ({
      user_id: user.id,
      name: group.name,
      icon: group.icon,
      color: group.color,
      sort_order: group.sort_order
    }))

    const { data, error } = await (supabase as any)
      .from('category_groups')
      .upsert(groupsToInsert, { 
        onConflict: 'user_id,name',
        ignoreDuplicates: false
    })
      .select()

    if (error) {
      console.error('❌ Error ensuring groups:', error)
      return { error: 'Не удалось создать группы' }
    }

    return { success: true, data, message: `Обеспечено ${data.length} групп` }
  } catch (err) {
    console.error('❌ Error in ensureStandardGroups:', err)
    return { error: 'Произошла ошибка при создании групп' }
  }
}

// Оптимизированная функция для получения категорий и групп одним запросом
export async function getCategoriesWithGroups() {
  const supabase = await createServerClient()

  try {
    const startTime = performance.now()
    
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    // Параллельно получаем категории и группы для максимальной скорости
    const [categoriesResult, groupsResult] = await Promise.all([
      supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('category_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })
    ])

    const endTime = performance.now()
    console.log(`⚡ Categories & Groups loaded in ${(endTime - startTime).toFixed(2)}ms`)

    if (categoriesResult.error) {
      console.error('Ошибка получения категорий:', categoriesResult.error)
      return { error: 'Не удалось загрузить категории' }
    }

    if (groupsResult.error) {
      console.error('Ошибка получения групп:', groupsResult.error)
      return { error: 'Не удалось загрузить группы' }
    }

    return { 
      success: true, 
      data: {
        categories: categoriesResult.data || [],
        groups: groupsResult.data || []
      }
    }
  } catch (err) {
    console.error('Ошибка получения данных:', err)
    return { error: 'Произошла ошибка при загрузке' }
  }
}

export async function getGroupExpenseSummary() {
  const supabase = await createServerClient();
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' };
    }

    const { data, error } = await supabase
      .from('expenses')
      .select(`
        amount,
        categories ( category_group_id )
      `)
      .eq('user_id', user.id)
      .not('category_id', 'is', null);

    if (error) {
      console.error('Ошибка получения сводки по группам:', error);
      return { error: 'Не удалось рассчитать сводку' };
    }

    const summary = (data as any[]).reduce((acc, expense) => {
      const groupId = (expense.categories as any)?.category_group_id;
      if (groupId) {
        acc[groupId] = (acc[groupId] || 0) + expense.amount;
      }
      return acc;
    }, {} as Record<string, number>);

    return { success: true, data: summary };

  } catch (err) {
    console.error('Ошибка получения сводки по группам:', err);
    return { error: 'Произошла ошибка' };
  }
}

export async function deleteAllCategories() {
  const supabase = await createServerClient()

  try {
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    // Проверяем, есть ли расходы с категориями
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('id')
      .eq('user_id', user.id)
      .not('category_id', 'is', null)
      .limit(1)

    if (expensesError) {
      console.error('Ошибка проверки расходов:', expensesError)
      return { error: 'Не удалось проверить связанные расходы' }
    }

    if (expenses && expenses.length > 0) {
      return { error: 'Нельзя удалить категории, которые используются в расходах' }
    }

    // Удаляем все категории и группы пользователя параллельно
    const [categoriesResult, groupsResult] = await Promise.all([
      supabase
        .from('categories')
        .delete()
        .eq('user_id', user.id),
      supabase
        .from('category_groups')
        .delete()
        .eq('user_id', user.id)
    ])

    if (categoriesResult.error) {
      console.error('Ошибка удаления категорий:', categoriesResult.error)
      return { error: 'Не удалось удалить категории' }
    }

    if (groupsResult.error) {
      console.error('Ошибка удаления групп:', groupsResult.error)
      return { error: 'Не удалось удалить группы' }
    }

    revalidatePath('/categories')
    return { success: true, message: 'Все категории и группы удалены' }
  } catch (err) {
    console.error('Ошибка удаления всех данных:', err)
    return { error: 'Произошла ошибка при удалении' }
  }
}



export async function moveCategoryToGroup(categoryId: string, newGroupId: string | null) {
  const supabase = await createServerClient()

  try {
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    // Обновляем группу категории
    const { data: category, error } = await (supabase as any)
      .from('categories')
      .update({
        category_group_id: newGroupId,
        updated_at: new Date().toISOString()
    })
      .eq('id', categoryId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Ошибка обновления группы категории:', error)
      return { error: 'Не удалось обновить группу категории' }
    }

    revalidatePath('/categories')
    return { success: true, data: category }
  } catch (err) {
    console.error('Ошибка обновления группы категории:', err)
    return { error: 'Произошла ошибка при обновлении группы' }
  }
}

export async function updateGroupOrder(order: { id: string; sort_order: number }[]) {
  const supabase = await createServerClient();
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' };
    }

    const updates = order.map(item => 
      (supabase as any)
        .from('category_groups')
        .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('user_id', user.id)
    );

    const results = await Promise.all(updates);
    const firstError = results.find((res: any) => res.error);

    if (firstError && firstError.error) {
      console.error('Ошибка обновления порядка групп:', firstError.error);
      return { error: 'Не удалось обновить порядок групп' };
    }

    revalidatePath('/categories');
    return { success: true };
  } catch (err) {
    console.error('Ошибка обновления порядка групп:', err);
    return { error: 'Произошла ошибка при обновлении порядка' };
  }
}

export async function updateCategoryOrderInGroup(order: { id: string; order: number }[]) {
  const supabase = await createServerClient();
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' };
    }

    const updates = order.map(item =>
      (supabase as any)
        .from('categories')
        .update({ sort_order: item.order, updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('user_id', user.id)
    );

    const results = await Promise.all(updates);
    const firstError = results.find((res: any) => res.error);

    if (firstError && firstError.error) {
      console.error('Ошибка обновления порядка категорий:', firstError.error);
      return { error: 'Не удалось обновить порядок категорий' };
    }

    revalidatePath('/categories');
    return { success: true };
  } catch (err) {
    console.error('Ошибка обновления порядка категорий:', err);
    return { error: 'Произошла ошибка при обновлении порядка категорий' };
  }
}

// Функции для работы с группами категорий
export async function getCategoryGroups() {
  const supabase = await createServerClient()

  try {
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    // Получаем группы из новой таблицы category_groups
    const { data: groups, error } = await supabase
      .from('category_groups')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Ошибка получения групп:', error)
      return { error: 'Не удалось загрузить группы' }
    }

    return { success: true, data: groups || [] }
  } catch (err) {
    console.error('Ошибка получения групп:', err)
    return { error: 'Произошла ошибка при загрузке групп' }
  }
}

export async function createCategoryGroup(data: { name: string; icon?: string; color?: string; }) {
  const supabase = await createServerClient()

  try {
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    // Получаем максимальный sort_order для определения позиции новой группы
    const { data: maxOrderGroup } = await supabase
      .from('category_groups')
      .select('sort_order')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const nextSortOrder = ((maxOrderGroup as any)?.sort_order || 0) + 1

    // Создаем новую группу
    const { data: group, error } = await (supabase as any)
      .from('category_groups')
      .insert({
        user_id: user.id,
        name: data.name.trim(),
      icon: data.icon || 'other',
      color: data.color || '#6366f1',
      sort_order: nextSortOrder
    })
      .select()
      .single()

    if (error) {
      console.error('Ошибка создания группы:', error)
      if (error.code === '23505') { // Unique constraint violation
        return { error: 'Группа с таким названием уже существует' }
      }
      return { error: 'Не удалось создать группу' }
    }

    revalidatePath('/categories')
    return { success: true, data: group }
  } catch (err) {
    console.error('Ошибка создания группы:', err)
    return { error: 'Произошла ошибка при создании группы' }
  }
}

export async function updateCategoryGroup(groupId: string, data: { name: string; icon?: string; color?: string; }) {
  const supabase = await createServerClient()

  try {
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    // Обновляем группу
    const { data: updatedGroup, error: updateError } = await (supabase as any)
      .from('category_groups')
      .update({
        name: data.name.trim(),
        icon: data.icon,
      color: data.color,
      updated_at: new Date().toISOString()
    })
      .eq('id', groupId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Ошибка обновления группы:', updateError)
      if (updateError.code === '23505') { // Unique constraint violation
        return { error: 'Группа с таким названием уже существует' }
      }
      return { error: 'Не удалось обновить группу' }
    }

    revalidatePath('/categories')
    return { success: true, data: updatedGroup }
  } catch (err) {
    console.error('Ошибка обновления группы:', err)
    return { error: 'Произошла ошибка при обновлении группы' }
  }
}

export async function deleteCategoryGroup(groupId: string) {
  const supabase = await createServerClient()

  try {
    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { error: 'Пользователь не авторизован' }
    }

    // Опционально: можно оставить проверку, чтобы нельзя было удалить группу "Основные"
    // Для этого нужно будет сначала получить группу по ID.

    // Просто удаляем группу. ON DELETE SET NULL в базе данных автоматически
    // установит category_group_id = NULL для всех связанных категорий.
    const { error: deleteError } = await supabase
      .from('category_groups')
      .delete()
      .eq('id', groupId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Ошибка удаления группы:', deleteError)
      return { error: 'Не удалось удалить группу' }
    }

    revalidatePath('/categories')
    return { success: true, message: 'Группа удалена, категории перемещены в раздел "Без группы"' }
  } catch (err) {
    console.error('Ошибка удаления группы:', err)
    return { error: 'Произошла ошибка при удалении группы' }
  }
}

