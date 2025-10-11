'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createSafeSupabaseClient } from '@/lib/supabase/safe-operations'
import { revalidatePath } from 'next/cache'
import { presets } from '@/lib/presets'
import { getRandomColor } from '@/lib/utils/constants'

export async function applyPreset(presetName: string) {
  const supabaseClient = await createServerClient()
  const supabase = createSafeSupabaseClient(supabaseClient)
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

  if (userError || !user) {
    return { error: 'Пользователь не авторизован' }
  }

  const preset = presets.find(p => p.name === presetName)

  if (!preset) {
    return { error: 'Выбранный набор не найден' }
  }

  try {
    // 1. Удаляем существующие группы и категории, чтобы избежать дубликатов
    await supabaseClient.from('categories').delete().eq('user_id', user.id)
    await supabaseClient.from('category_groups').delete().eq('user_id', user.id)

    // 2. Создаем новые группы
    const groupColorMap = new Map<string, string>()

    const groupsToInsert = preset.groups.map((group, index) => {
      const color = group.color || getRandomColor()
      groupColorMap.set(group.name, color)

      return {
        user_id: user.id,
        name: group.name,
        icon: group.icon,
        color,
        sort_order: index
      }
    })

    const { data: createdGroups, error: groupsError } = await supabase
      .from('category_groups')
      .insert(groupsToInsert)
      .select()

    if (groupsError) {
      throw new Error(`Ошибка при создании групп: ${groupsError.message}`)
    }

    // 3. Создаем маппинг имен групп в их ID
    const groupNameToIdMap = new Map(createdGroups.map((g: any) => [g.name, g.id]))

    // 4. Создаем новые категории с привязкой к ID групп
    const categoriesToInsert = preset.categories.map(category => {
      const groupId = category.group ? groupNameToIdMap.get(category.group) : null

      if (category.group && !groupId) {
        throw new Error(
          `Для категории "${category.name}" не найдена группа "${category.group}" в пресете "${preset.name}"`
        )
      }

      const derivedColor = category.group ? groupColorMap.get(category.group) : undefined

      return {
        user_id: user.id,
        name: category.name,
        icon: category.icon,
        color: derivedColor ?? getRandomColor(),
        category_group_id: groupId
      }
    })

    const { data: createdCategories, error: categoriesError } = await supabase
      .from('categories')
      .insert(categoriesToInsert)
      .select()

    if (categoriesError) {
      throw new Error(`Ошибка при создании категорий: ${categoriesError.message}`)
    }

    revalidatePath('/', 'layout')
    return { success: true, newGroups: createdGroups, newCategories: createdCategories }

  } catch (error: any) {
    console.error('Error in applyPreset:', error)
    return { error: error.message || 'Неизвестная ошибка сервера' }
  }
}
