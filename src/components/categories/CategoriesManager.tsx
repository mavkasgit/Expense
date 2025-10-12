'use client'

import { useState, useMemo, useEffect } from 'react'
import { DndContext, closestCorners, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, DragOverEvent, DragOverlay } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useToast } from '@/hooks/useToast'
import { Category, CategoryGroup, CategoryKeywordWithSynonyms, KeywordSynonym } from '@/types'
import { moveCategoryToGroup, updateGroupOrder, updateCategoryOrderInGroup } from '@/lib/actions/categories'
import { getAllKeywords } from '@/lib/actions/keywords'
import { getUserSettings, UserSettings } from '@/lib/actions/settings'
import { Preset } from '@/lib/presets'
import { applyPreset } from '@/lib/actions/presets'
import { normalizeKeywords } from '@/lib/utils'

import { GroupsManager } from './GroupsManager'
import { PresetSelectorForEmptyState } from './PresetSelectorForEmptyState';
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { GroupsModal } from './GroupsModal'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import { Modal } from '@/components/ui/Modal'
import { CategoryForm } from './CategoryForm'
import { CategoryCard } from './CategoryCard'
import { CategoryGroup as CategoryGroupComponent } from './CategoryGroup'
import { KeywordEditorModal } from './KeywordEditorModal'


interface CategoriesManagerProps {
  initialGroups: CategoryGroup[];
  initialCategories: Category[];
  initialKeywords: CategoryKeywordWithSynonyms[];
  initialSettings: UserSettings;
}

export type CategoryWithKeywordCount = Category & { keywordCount: number };

export type CategoryGroupWithCategories = CategoryGroup & {
  categories: CategoryWithKeywordCount[];
};



const buildGroupsWithCategories = (
  allGroups: CategoryGroup[], 
  allCategories: Category[],
  keywordCountMap: Map<string, number>
) : CategoryGroupWithCategories[] => {
  const categoriesWithCount = allCategories.map(c => ({
    ...c,
    keywordCount: keywordCountMap.get(c.id) || 0
  }));

  const categorizedGroups = allGroups.map(group => ({
    ...group,
    categories: categoriesWithCount.filter(c => c.category_group_id === group.id)
  }));

  const uncategorizedCategories = categoriesWithCount.filter(c => c.category_group_id === null);

  const uncategorizedGroup: CategoryGroup = {
    id: 'uncategorized',
    name: 'Без группы',
    icon: 'other',
    color: '#cccccc',
    sort_order: -1,
    user_id: null,
    created_at: null,
    updated_at: null,
  };

  let finalGroups: CategoryGroupWithCategories[] = [...categorizedGroups];
  if (uncategorizedCategories.length > 0 || finalGroups.some(g => g.id === 'uncategorized')) {
    finalGroups.push({ ...uncategorizedGroup, categories: uncategorizedCategories });
  }

  finalGroups.sort((a, b) => {
    if (a.id === 'uncategorized') return -1;
    if (b.id === 'uncategorized') return 1;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  return finalGroups;
};

export function CategoriesManager({ 
  initialGroups, 
  initialCategories, 
  initialKeywords, 
  initialSettings 
}: CategoriesManagerProps) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [allKeywords, setAllKeywords] = useState<CategoryKeywordWithSynonyms[]>(() => normalizeKeywords(initialKeywords));
  const [userSettings, setUserSettings] = useState<UserSettings>(initialSettings);
  
  const [groups, setGroups] = useState<CategoryGroupWithCategories[]>(() => {
    const initialKwCountMap = new Map<string, number>();
    normalizeKeywords(initialKeywords).forEach(kw => {
        if(kw.category_id) initialKwCountMap.set(kw.category_id, (initialKwCountMap.get(kw.category_id) || 0) + 1);
    });
    return buildGroupsWithCategories(initialGroups, initialCategories, initialKwCountMap);
  });

  const [activeGroup, setActiveGroup] = useState<CategoryGroup | null>(null)
  const [activeCategory, setActiveCategory] = useState<CategoryWithKeywordCount | null>(null)
  const [draggedItemWidth, setDraggedItemWidth] = useState<number | null>(null); // New state
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<CategoryGroup | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>(undefined);
  const [isKeywordsModalOpen, setIsKeywordsModalOpen] = useState(false);
  const [selectedCategoryForKeywords, setSelectedCategoryForKeywords] = useState<Category | null>(null);

  const { showToast } = useToast()

  const keywordCountByCategory = useMemo(() => {
    const countMap = new Map<string, number>();
    allKeywords.forEach(keyword => {
      if (keyword.category_id) {
        countMap.set(keyword.category_id, (countMap.get(keyword.category_id) || 0) + 1);
      }
    });
    return countMap;
  }, [allKeywords]);

  useEffect(() => {
    setGroups(currentGroups => currentGroups.map(group => ({
        ...group,
        categories: group.categories.map(category => ({
            ...category,
            keywordCount: keywordCountByCategory.get(category.id) || 0
        }))
    })));
  }, [keywordCountByCategory]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 0,
      },
    })
  )

  const handleApplyPreset = async (newGroups: CategoryGroup[], newCategories: Category[]) => {
    setGroups(buildGroupsWithCategories(newGroups, newCategories, keywordCountByCategory));
    setCategories(newCategories);
    showToast(`Пресет успешно применен!`, 'success');
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    if (active.data.current?.type === 'category') {
      setActiveCategory(active.data.current.category as CategoryWithKeywordCount)
    }
    if (active.data.current?.type === 'group') {
      setActiveGroup(active.data.current.group)
      setDraggedItemWidth(active.rect.current?.initial?.width || null); // Set width
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveGroup(null);
    setActiveCategory(null);
    setDraggedItemWidth(null);

    if (!over) {
      return;
    }

    // Handle Group Sorting
    if (active.data.current?.type === 'group' && over.data.current?.type === 'group' && active.id !== over.id) {
      const oldIndex = groups.findIndex(g => g.id === active.id);
      const newIndex = groups.findIndex(g => g.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(groups, oldIndex, newIndex);
        setGroups(newOrder);
        
        const groupsToUpdate = newOrder
          .filter(g => g.id !== 'uncategorized')
          .map((g, i) => ({ id: g.id, sort_order: i }));

        updateGroupOrder(groupsToUpdate);
      }
      return;
    }

    // Handle Category Sorting
    if (active.data.current?.type === 'category') {
      const sourceGroupId = active.data.current.category.category_group_id;
      const overData = over.data.current;
      
      let destGroupId = sourceGroupId;
      if (over.id.toString().startsWith('group-')) {
        destGroupId = over.id.toString().replace('group-', '');
      } else if (overData?.type === 'category') {
        destGroupId = overData.category.category_group_id;
      }

      if (!destGroupId) return;

      const sourceGroup = groups.find(g => g.id === sourceGroupId);
      const destGroup = groups.find(g => g.id === destGroupId);

      if (!sourceGroup || !destGroup) return;

      const oldIndex = sourceGroup.categories.findIndex(c => c.id === active.id);
      let newIndex = overData?.type === 'category' ? destGroup.categories.findIndex(c => c.id === over.id) : destGroup.categories.length;

      if (sourceGroupId === destGroupId) {
        // Sorting within the same group
        if (oldIndex === newIndex || oldIndex === -1 || newIndex === -1) return;
        
        const reorderedCategories = arrayMove(sourceGroup.categories, oldIndex, newIndex);
        const newGroups = groups.map(g => g.id === sourceGroupId ? {...g, categories: reorderedCategories} : g);
        setGroups(newGroups);
        updateCategoryOrderInGroup(reorderedCategories.map((c, i) => ({ id: c.id, order: i })));

      } else {
        // Moving to a different group
        if (oldIndex === -1) return;

        const [movedCategory] = sourceGroup.categories.splice(oldIndex, 1);
        movedCategory.category_group_id = destGroupId;
        destGroup.categories.splice(newIndex, 0, movedCategory);

        const newGroups = groups.map(g => {
            if (g.id === sourceGroupId) return sourceGroup;
            if (g.id === destGroupId) return destGroup;
            return g;
        });

        setGroups(newGroups);
        moveCategoryToGroup(active.id.toString(), destGroupId);
        updateCategoryOrderInGroup(destGroup.categories.map((c, i) => ({ id: c.id, order: i })));
        if(sourceGroup.categories.length > 0) {
            updateCategoryOrderInGroup(sourceGroup.categories.map((c, i) => ({ id: c.id, order: i })));
        }
      }
    }
  }

  const handleGroupCreated = (newGroup: CategoryGroup) => {
    const groupWithCategories = { ...newGroup, categories: [] };
    setGroups(prev => [...prev, groupWithCategories])
  }

  const handleGroupUpdated = (updatedGroup: CategoryGroup) => {
    setGroups(prev => prev.map(g => g.id === updatedGroup.id ? { ...g, name: updatedGroup.name, color: updatedGroup.color, icon: updatedGroup.icon } : g))
  }

  const openGroupModalForCreate = () => {
    setEditingGroup(null);
    setIsGroupModalOpen(true);
  };

  const openGroupModalForEdit = (group: CategoryGroup) => {
    setEditingGroup(group);
    setIsGroupModalOpen(true);
  };

  const openCategoryModalForCreate = () => {
    setEditingCategory(undefined);
    setIsCategoryModalOpen(true);
  };

  const openCategoryModalForEdit = (category: Category) => {
    setEditingCategory(category);
    setIsCategoryModalOpen(true);
  };

  const handleOpenKeywordsModal = (category: Category) => {
    setSelectedCategoryForKeywords(category);
    setIsKeywordsModalOpen(true);
  };

  const handleCloseKeywordsModal = () => {
    setIsKeywordsModalOpen(false);
    setSelectedCategoryForKeywords(null);
  };

  const handleKeywordChange = async () => {
    const result = await getAllKeywords();
    if (result.success) {
      setAllKeywords(normalizeKeywords(result.data || []));
    }
  };

  const handleCategorySaved = (savedCategoryData: any) => {
    setIsCategoryModalOpen(false);
    const savedCategory = Array.isArray(savedCategoryData) ? savedCategoryData[0] : savedCategoryData;

    let newCategories;
    if (editingCategory) {
        newCategories = categories.map(c => c.id === savedCategory.id ? savedCategory : c);
    } else {
        newCategories = [...categories, savedCategory];
    }
    setCategories(newCategories);
    const currentGroups = groups.map(g => {
        const { categories, ...groupData } = g;
        return groupData;
    });
    setGroups(buildGroupsWithCategories(currentGroups, newCategories, keywordCountByCategory));
    setEditingCategory(undefined);
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const newCategories = categories.filter(c => c.id !== categoryId);
    setCategories(newCategories);
    setGroups(buildGroupsWithCategories(initialGroups, newCategories, keywordCountByCategory));
  };

  const handleDeleteGroup = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (group && group.categories.length > 0) {
      showToast('Нельзя удалить группу, в которой есть категории.', 'error');
      return;
    }
    setDeletingGroupId(groupId);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteGroup = async () => {
    if (deletingGroupId) {
      setGroups(prev => prev.filter(g => g.id !== deletingGroupId));
      setIsDeleteModalOpen(false);
      setDeletingGroupId(null);
    }
  };

  const hasData = useMemo(() => groups.length > 0, [groups]);

  const [searchQuery, setSearchQuery] = useState('');

  const filteredKeywords = useMemo(() => {
    if (!searchQuery) {
      return allKeywords;
    }
    const lowercasedQuery = searchQuery.toLowerCase();
    return allKeywords.filter(keyword => {
      const keywordMatch = keyword.keyword.toLowerCase().includes(lowercasedQuery);
      const synonymMatch = keyword.keyword_synonyms?.some(synonym =>
        synonym.synonym.toLowerCase().includes(lowercasedQuery)
      );
      return keywordMatch || synonymMatch;
    });
  }, [allKeywords, searchQuery]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery) {
      return groups;
    }

    const filteredCategoryIds = new Set(filteredKeywords.map(k => k.category_id));

    return groups
      .map(group => ({
        ...group,
        categories: group.categories.filter(c => filteredCategoryIds.has(c.id)),
      }))
      .filter(group => group.categories.length > 0);
  }, [groups, filteredKeywords, searchQuery]);

  if (!hasData) {
    return <PresetSelectorForEmptyState onSuccess={handleApplyPreset} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Управление категориями</h2>
        <div className="flex gap-2">
          <Button onClick={openGroupModalForCreate}>Управление группами</Button>
          <Button onClick={openCategoryModalForCreate} variant="primary">+ Создать категорию</Button>
        </div>
      </div>

      <GroupsModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onGroupCreated={handleGroupCreated}
        onGroupUpdated={handleGroupUpdated}
        editingGroup={editingGroup}
        onSuccess={() => setIsGroupModalOpen(false)}
        initialGroups={groups}
      />

      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={editingCategory ? 'Редактировать категорию' : 'Создать категорию'}
        customSize="max-w-[550px]"
      >
        <CategoryForm
          onSuccess={handleCategorySaved}
          onCancel={() => setIsCategoryModalOpen(false)}
          category={editingCategory}
        />
      </Modal>

      {selectedCategoryForKeywords && (
        <KeywordEditorModal
          isOpen={isKeywordsModalOpen}
          onClose={handleCloseKeywordsModal}
          category={selectedCategoryForKeywords}
          categories={categories}
          keywords={filteredKeywords.filter(k => k.category_id === selectedCategoryForKeywords.id)}
          onKeywordChange={handleKeywordChange}
          userSettings={userSettings}
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >


      <GroupsManager
          groups={filteredGroups}
          handleEditGroup={openGroupModalForEdit}
          handleDeleteGroup={handleDeleteGroup}
          handleEditCategory={openCategoryModalForEdit}
          handleDeleteCategory={handleDeleteCategory}
          handleKeywordsCategory={handleOpenKeywordsModal}
          activeGroup={activeGroup}
          activeCategory={activeCategory}
          isGroupDragging={!!activeGroup}
        />
        <DragOverlay>
          {activeCategory ? (
            <CategoryCard category={activeCategory} isOverlay />
          ) : null}
          {activeGroup ? (
             <CategoryGroupComponent 
                group={{...activeGroup, categories: groups.find(g => g.id === activeGroup.id)?.categories || []}}
                activeCategory={null}
                onDeleteGroup={() => {}}
                onEditCategory={() => {}}
                onEditGroup={() => {}}
                onKeywordsCategory={() => {}}
                onDeleteCategory={async (categoryId: string) => {}}
                style={draggedItemWidth ? { width: draggedItemWidth } : undefined} // Add style prop
                isOverlay
             />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}