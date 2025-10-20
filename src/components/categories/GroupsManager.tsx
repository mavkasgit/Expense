'use client'

import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { CategoryGroup } from './CategoryGroup'
import { Category, CategoryGroup as TCategoryGroup } from '@/types'

import type { CategoryGroupWithCategories, CategoryWithKeywordCount } from '@/components/categories/CategoriesManager';

interface GroupsManagerProps {
  groups: CategoryGroupWithCategories[]
  handleEditGroup: (group: TCategoryGroup) => void
  handleDeleteGroup: (groupId: string) => void
  handleEditCategory: (category: CategoryWithKeywordCount) => void
  handleKeywordsCategory: (category: CategoryWithKeywordCount) => void
  handleDeleteCategory: (categoryId: string) => Promise<void>;
  activeGroup: TCategoryGroup | null
  activeCategory: CategoryWithKeywordCount | null
  isGroupDragging: boolean
}

export function GroupsManager({
  groups,
  handleEditGroup,
  handleDeleteGroup,
  handleEditCategory,
  handleKeywordsCategory,
  handleDeleteCategory,
  activeCategory,
  isGroupDragging,
}: GroupsManagerProps) {
  return (
    <SortableContext items={groups.map(g => g.id)} strategy={rectSortingStrategy}>
      <div className="flex flex-wrap gap-4">
        {groups.map(group => (
          <div key={group.id} className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)] xl:w-[calc(25%-0.75rem)]">
            <CategoryGroup
              group={group}
              onEditGroup={handleEditGroup}
              onDeleteGroup={handleDeleteGroup}
              onEditCategory={handleEditCategory}
              onKeywordsCategory={handleKeywordsCategory}
              onDeleteCategory={handleDeleteCategory}
              activeCategory={activeCategory}
              isGroupDragging={isGroupDragging}
            />
          </div>
        ))}
      </div>
    </SortableContext>
  )
}