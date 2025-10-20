'use client'

import { useState, memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button, useToast } from '@/components/ui'
import { deleteCategory } from '@/lib/actions/categories'
import type { Category } from '@/types'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { availableIcons } from '@/lib/utils/category-constants';
import { CategoryWithKeywordCount } from './CategoriesManager'

interface CategoryCardProps {
  category: CategoryWithKeywordCount
  onEdit?: (category: CategoryWithKeywordCount) => void
  onDelete?: (categoryId: string) => void
  onKeywords?: (category: CategoryWithKeywordCount) => void
  isDraggable?: boolean
  isOverlay?: boolean
}

function CategoryCardComponent({ category, onEdit, onDelete, onKeywords, isDraggable = false, isOverlay = false }: CategoryCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const { error, success } = useToast()

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    disabled: !isDraggable || isOverlay,
    data: { type: 'category', category },
  });

  const style = { transform: CSS.Transform.toString(transform), transition };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(category);
  };

  const handleDeleteRequest = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfirmingDelete(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteCategory(category.id);
      if (result.error) {
        error(result.error);
      } else {
        success('Категория успешно удалена');
        onDelete?.(category.id);
      }
    } catch (err) {
      error('Произошла ошибка при удалении');
    } finally {
      setIsDeleting(false);
      setIsConfirmingDelete(false);
    }
  };

  const handleCardClick = () => {
    if (isOverlay || !onKeywords) return;
    onKeywords(category);
  };

  const iconEmoji = availableIcons.find(i => i.key === category.icon)?.emoji || '📦';

  const cardContent = (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center space-x-1.5 flex-grow min-w-0">
        {!isOverlay && (
          <button {...listeners} {...attributes} data-drag-handle className="cursor-grab p-1 -ml-1 text-gray-400 hover:text-gray-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
          </button>
        )}
        {category.keywordCount > 0 && (
          <span className="text-xs font-bold text-gray-600 bg-gray-200 rounded-full px-2 py-0.5">
            {category.keywordCount}
          </span>
        )}
        <span className="text-lg">{iconEmoji}</span>
        <span className="font-medium text-gray-800 text-xs truncate group-hover:text-indigo-600">{category.name}</span>
      </div>
      {!isOverlay && (
        <div className="flex items-center space-x-0.5 flex-shrink-0 ml-1">
          <Button size="sm" variant="ghost" onClick={handleEditClick} title="Редактировать" className="p-1 h-auto">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDeleteRequest} isLoading={isDeleting} title="Удалить" className="p-1 h-auto">
             <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </Button>
        </div>
      )}
    </div>
  );

  if (isOverlay) {
    return <div style={{ backgroundColor: category.color ? `${category.color}20` : '#f3f4f6' }} className="rounded-lg p-2 shadow-2xl flex items-center scale-105 rotate-1">{cardContent}</div>;
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={{ ...style, backgroundColor: category.color ? `${category.color}20` : '#f3f4f6' }}
        onClick={handleCardClick}
        className={`group relative rounded-lg p-2 transition-all duration-200 flex items-center justify-between ${isDraggable ? 'cursor-pointer' : ''} hover:bg-indigo-50 ${
          isDragging ? 'opacity-30' : 'opacity-100'
        }`}
      >
        {cardContent}
      </div>
      <ConfirmationModal
        isOpen={isConfirmingDelete}
        onClose={() => setIsConfirmingDelete(false)}
        onConfirm={handleConfirmDelete}
        title={`Удалить категорию "${category.name}"?`}
        message="Это действие нельзя отменить. Расходы с этой категорией останутся, но будут не категоризированы."
        isLoading={isDeleting}
      />
    </>
  );
}

export const CategoryCard = memo(CategoryCardComponent);