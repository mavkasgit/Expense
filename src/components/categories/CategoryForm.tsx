'use client'

import { useState, useRef, useEffect } from 'react'
import { Input, Button, useToast } from '@/components/ui'
import { createCategory, updateCategory, getCategoryGroups } from '@/lib/actions/categories'
import type { Category, CreateCategoryData, CategoryGroup } from '@/types'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { IconPicker } from '@/components/ui/IconPicker';
import { availableColors, availableIcons, getRandomColor } from '@/lib/utils/category-constants';

interface CategoryFormProps {
  category?: Category
  onSuccess: (data?: any) => void
  onCancel: () => void
}

export function CategoryForm({ category, onSuccess, onCancel }: CategoryFormProps) {
  const [formData, setFormData] = useState<CreateCategoryData>({
    name: category?.name || '',
    color: category?.color || getRandomColor(),
    icon: category?.icon || 'shopping-bag',
    category_group_id: category?.category_group_id || null
  })
  const [groups, setGroups] = useState<CategoryGroup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const nameInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  // Автофокус на поле ввода названия
  useEffect(() => {
    if (nameInputRef.current) {
      nameInputRef.current.focus()
    }
  }, [])

  // Загружаем доступные группы
  useEffect(() => {
    const loadGroups = async () => {
      try {
        const result = await getCategoryGroups()
        if ('success' in result && result.data) {
          setGroups(result.data)
        }
      } catch (error) {
        toast.error('Не удалось загрузить группы')
      }
    }

    loadGroups()
  }, [toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setIsLoading(true)

    try {
      const result = category
        ? await updateCategory(category.id, formData)
        : await createCategory(formData)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(category ? 'Категория обновлена' : 'Категория создана')
        onSuccess(result.data)
      }
    } catch (error) {
      toast.error('Произошла ошибка при сохранении')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (field: keyof CreateCategoryData, value: string | null) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }



  const groupOptions = [
    { value: '', label: 'Без группы' },
    ...groups.map(g => ({
      value: g.id,
      label: g.name,
      color: g.color || undefined,
      icon: g.icon ? (
        <span className="text-lg mr-2">
          {availableIcons.find(icon => icon.key === g.icon)?.emoji || '📁'}
        </span>
      ) : (
        <span className="text-lg mr-2">📁</span>
      )
    }))
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      <Input
        ref={nameInputRef}
        label="Название категории"
        value={formData.name}
        onChange={(e) => handleChange('name', e.target.value)}
        error={errors.name}
        placeholder="Например: Продукты, Транспорт, Развлечения"
        required
        autoComplete="off"
        name={`category-name-${Date.now()}`}
      />

      <div>
        <SearchableSelect
          options={groupOptions}
          value={formData.category_group_id || ''}
          onChange={(value) => handleChange('category_group_id', value || null)}
          placeholder="Выберите группу..."
        />
      </div>

      <div className="flex items-center gap-2">
        <IconPicker
          value={formData.icon || 'shopping-bag'}
          onChange={(value) => handleChange('icon', value)}
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: formData.color || '#ccc' }} />
              <span>Цвет</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-6 gap-1">
              {availableColors.map(color => (
                <button key={color} type="button" onClick={() => handleChange('color', color)} className={`w-8 h-8 rounded-full border-2 transition-all ${formData.color === color ? 'ring-2 ring-offset-1 ring-blue-500 border-white' : 'border-transparent'}`} style={{ backgroundColor: color }} />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button type="button" variant="outline" size="sm" onClick={() => handleChange('color', getRandomColor())} title="Случайный цвет">🎲</Button>

        <div className="flex-grow"></div>

        <div className="flex items-center space-x-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isLoading}
          >
            Отмена
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            className="min-w-[120px]"
          >
            {category ? 'Обновить' : 'Создать'}
          </Button>
        </div>
      </div>
    </form>
  )
}
