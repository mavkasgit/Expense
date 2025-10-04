'use client'

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Input } from '@/components/ui';
import { useState, useRef, useEffect } from 'react';
import type { CategoryGroup } from '@/types';
import { availableIcons, availableColors, getRandomColor } from '@/lib/utils/category-constants';
import { IconPicker } from '@/components/ui/IconPicker';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';

function EditGroupForm({ group, onSave, onCancel }: { group: CategoryGroup, onSave: Function, onCancel: Function }) {
  const [name, setName] = useState(group.name);
  const [color, setColor] = useState(group.color || '#6b7280');
  const [icon, setIcon] = useState(group.icon || 'folder');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 100);
  }, []);



  return (
    <div className="flex-1 space-y-3 p-4 bg-gray-50 border-t">
      <Input 
        ref={inputRef}
        value={name} 
        onChange={(e) => setName(e.target.value)} 
        placeholder="Название группы" 
        autoComplete="new-password"
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onSave(group, name, icon, color); }
          if (e.key === 'Escape') { onCancel(); }
        }}
      />
      <div className="flex items-center gap-2">
        <IconPicker
          value={icon}
          onChange={setIcon}
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: color }} />
              <span>Цвет</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-6 gap-1">
              {availableColors.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)} className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'ring-2 ring-offset-1 ring-blue-500 border-white' : 'border-transparent'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button type="button" variant="outline" size="sm" onClick={() => setColor(getRandomColor())} title="Случайный цвет">🎲</Button>

        <div className="flex-grow"></div>

        <Button variant="ghost" size="sm" onClick={() => onCancel()}>Отмена</Button>
        <Button variant="primary" size="sm" onClick={() => onSave(group, name, icon, color)}>Сохранить</Button>
      </div>
    </div>
  );
}

export function SortableGroupItem({ group, onEdit, onDelete, onSave, onCancel, editingGroup }: { group: CategoryGroup, onEdit: Function, onDelete: Function, onSave: Function, onCancel: Function, editingGroup: CategoryGroup | null }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-white border-2 rounded-lg transition-all duration-200 overflow-hidden">
      <div className={`flex items-center justify-between p-3 transition-opacity duration-200 ${editingGroup?.id === group.id ? 'opacity-50' : 'opacity-100'}`}>
        <div className="flex items-center space-x-3 flex-1">
          <button {...attributes} {...listeners} className="cursor-move p-2 text-gray-400 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: (group.color || '#ccc') + '20' }}>
            <span>{availableIcons.find(icon => icon.key === group.icon)?.emoji || '📁'}</span>
          </div>
          <div>
            <div className="font-medium text-gray-900">{group.name}</div>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(group)} className="text-blue-600 border-blue-600 hover:bg-blue-50 hover:text-blue-700">Редактировать</Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(group)}>Удалить</Button>
        </div>
      </div>
      {editingGroup?.id === group.id && (
        <div className="transition-all duration-300 ease-in-out">
          <EditGroupForm group={group} onSave={onSave} onCancel={onCancel} />
        </div>
      )}
    </div>
  );
}