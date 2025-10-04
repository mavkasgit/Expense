'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button, Input, Modal, useToast } from '@/components/ui'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import { createCategoryGroup, updateCategoryGroup, deleteCategoryGroup, getCategoryGroups, updateGroupOrder } from '@/lib/actions/categories'
import { SortableGroupItem } from './SortableGroupItem';
import { IconPicker } from '@/components/ui/IconPicker';

import type { CategoryGroup } from '@/types';
import { availableIcons, availableColors, getRandomColor } from '@/lib/utils/category-constants';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';


  interface GroupsModalProps {
  isOpen: boolean
  onClose: () => void
  onGroupCreated: (newGroup: CategoryGroup) => void
  onGroupUpdated: (updatedGroup: CategoryGroup) => void
  editingGroup?: CategoryGroup | null; // Make it optional as it's not always passed
  onSuccess: () => void
  initialGroups: CategoryGroup[];
}

export function GroupsModal({ isOpen, onClose, onSuccess, onGroupCreated, onGroupUpdated, initialGroups }: GroupsModalProps) {
  const [groups, setGroups] = useState<CategoryGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingGroup, setEditingGroup] = useState<CategoryGroup | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupIcon, setNewGroupIcon] = useState('folder')
  const [newGroupColor, setNewGroupColor] = useState('#6b7280')
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupToDelete, setGroupToDelete] = useState<CategoryGroup | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null)
  const { error, success } = useToast()

  const loadGroups = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getCategoryGroups();
      if (result.success) {
        setGroups(result.data || []);
      } else {
        error(result.error || 'Ошибка загрузки групп');
      }
    } catch (err) {
      error('Ошибка при загрузке групп');
    } finally {
      setIsLoading(false);
    }
  }, [error]);

  useEffect(() => {
    if (isOpen) {
      setGroups(initialGroups);
      setIsLoading(false);
    }
  }, [isOpen, initialGroups]);

  const filteredGroups = useMemo(() => {
    if (!groupSearchQuery) {
      return groups;
    }
    return groups.filter(group =>
      group.name.toLowerCase().includes(groupSearchQuery.toLowerCase())
    );
  }, [groupSearchQuery, groups]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      error('Введите название группы');
      return;
    }
    const result = await createCategoryGroup({ 
      name: newGroupName.trim(),
      icon: newGroupIcon,
      color: newGroupColor
    });
    if (result.success) {
      success('Группа создана');
      setIsCreating(false);
      setNewGroupName('');
      setNewGroupIcon('folder');
      setNewGroupColor('#6b7280');
      loadGroups();
      onSuccess();
      onGroupCreated(result.data); // Call the new prop with the created group
    } else {
      error(result.error || 'Ошибка при создании');
    }
  };

  const handleUpdateGroup = async (group: CategoryGroup, name: string, icon: string, color: string) => {
    const result = await updateCategoryGroup(group.id, { name, icon, color });
    if (result.success) {
      success('Группа обновлена');
      setEditingGroup(null);
      loadGroups();
      onSuccess();
      onGroupUpdated(result.data); // Call the new prop with the updated group
    } else {
      error(result.error || 'Ошибка при обновлении');
    }
  };

  const handleDeleteRequest = (group: CategoryGroup) => {
    setGroupToDelete(group);
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    setIsConfirmingDelete(true);

    const result = await deleteCategoryGroup(groupToDelete.id);
    if (result.success) {
      success('Группа удалена');
      loadGroups();
      onSuccess();
    } else {
      error(result.error || 'Ошибка при удалении');
    }

    setIsConfirmingDelete(false);
    setGroupToDelete(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = groups.findIndex((g) => g.id === active.id);
      const newIndex = groups.findIndex((g) => g.id === over.id);
      const newOrder = arrayMove(groups, oldIndex, newIndex);
      setGroups(newOrder);
      const orderToUpdate = newOrder.map((g, index) => ({ id: g.id, sort_order: index }));
      await updateGroupOrder(orderToUpdate).catch(() => {
        error('Ошибка при обновлении порядка');
        loadGroups();
      });
    }
  };

  const handleClose = () => {
    setEditingGroup(null);
    setIsCreating(false);
    onClose();
  }

  useEffect(() => {
    if (isCreating) {
      setTimeout(() => {
        if (nameInputRef.current) {
          nameInputRef.current.focus();
          nameInputRef.current.select();
        }
      }, 100);
    }
  }, [isCreating]);

  const newGroupIconEmoji = availableIcons.find(i => i.key === newGroupIcon)?.emoji;



  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Управление группами" size="lg">
      <div className="space-y-4">
        {!isCreating && (
          <div className="flex items-center gap-4">
            <Input
              className="flex-grow h-10"
              value={groupSearchQuery}
              onChange={(e) => setGroupSearchQuery(e.target.value)}
              placeholder="Поиск по группам..."
              leftIcon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              }
              autoComplete="new-password"
            />
            <Button 
              className="h-10 whitespace-nowrap"
              onClick={() => {
              setIsCreating(true);
              setNewGroupName('');
              setNewGroupColor(getRandomColor());
              setNewGroupIcon('folder');
            }}>Создать группу</Button>
          </div>
        )}

        {isCreating && (
          <div className="p-4 bg-gray-50 rounded-lg space-y-4 border border-gray-200">
            <h4 className="font-medium text-gray-800">Новая группа</h4>
            <Input 
              ref={nameInputRef} 
              value={newGroupName} 
              onChange={(e) => setNewGroupName(e.target.value)} 
              placeholder="Название новой группы" 
              required 
              autoComplete="new-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleCreateGroup(); }
                if (e.key === 'Escape') { setIsCreating(false); }
              }}
            />
            <div className="flex items-center gap-2">
              <IconPicker
                value={newGroupIcon}
                onChange={setNewGroupIcon}
              />

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: newGroupColor }} />
                    <span>Цвет</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2">
                  <div className="grid grid-cols-6 gap-1">
                    {availableColors.map(color => (
                      <button key={color} type="button" onClick={() => setNewGroupColor(color)} className={`w-8 h-8 rounded-full border-2 transition-all ${newGroupColor === color ? 'ring-2 ring-offset-1 ring-blue-500 border-white' : 'border-transparent'}`} style={{ backgroundColor: color }} />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Button type="button" variant="outline" size="sm" onClick={() => setNewGroupColor(getRandomColor())} title="Случайный цвет">🎲</Button>

              <div className="flex-grow"></div>

              <Button variant="ghost" onClick={() => setIsCreating(false)}>Отмена</Button>
              <Button onClick={handleCreateGroup}>Сохранить</Button>
            </div>
          </div>
        )}

        <div className="min-h-[200px]">
          {isLoading ? (
            <div className="text-center py-8">Загрузка...</div>
          ) : filteredGroups.length === 0 && !isCreating ? (
            <div className="text-center py-8 text-gray-500">{groupSearchQuery ? 'Группы не найдены' : 'Нет созданных групп.'}</div>
          ) : (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredGroups.map(g => g.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {filteredGroups.map((group) => (
                    <SortableGroupItem 
                      key={group.id} 
                      group={group} 
                      editingGroup={editingGroup}
                      onEdit={setEditingGroup} 
                      onDelete={() => handleDeleteRequest(group)}
                      onSave={handleUpdateGroup}
                      onCancel={() => setEditingGroup(null)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="ghost" onClick={handleClose}>Закрыть</Button>
          <Button variant="primary" onClick={() => { onSuccess(); handleClose(); }}>Готово</Button>
        </div>
      </div>
      <ConfirmationModal
        isOpen={!!groupToDelete}
        onClose={() => setGroupToDelete(null)}
        onConfirm={handleDeleteGroup}
        title={`Удалить группу "${groupToDelete?.name}"?`}
        message="Все категории из этой группы не будут удалены, а переместятся в раздел 'Без группы'. Это действие нельзя отменить."
        isLoading={isConfirmingDelete}
      />
    </Modal>
  )
}