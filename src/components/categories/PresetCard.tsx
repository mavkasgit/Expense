'use client'

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { applyPreset } from '@/lib/actions/presets';
import type { Preset } from '@/lib/presets';
import { useToast } from '@/hooks/useToast';
import type { Category, CategoryGroup } from '@/types';

interface PresetCardProps {
  preset: Preset;
  onSuccess: (newGroups: CategoryGroup[], newCategories: Category[]) => void;
}

export function PresetCard({ preset, onSuccess }: PresetCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  const totalGroups = preset.groups.length;
  const totalCategories = preset.categories.length;
  const displayedCategories = preset.categories.slice(0, 5);
  const remainingCategories = totalCategories - displayedCategories.length;

  const handleSelect = async () => {
    setIsLoading(true);
    const result = await applyPreset(preset.name);
    setIsLoading(false);

    if (result.success && result.newGroups && result.newCategories) {
      onSuccess(result.newGroups, result.newCategories);
    } else {
      showToast(result.error || 'Произошла ошибка при применении пресета', 'error');
    }
  };

  return (
    <Card variant="elevated" className="flex flex-col h-full transition-all hover:border-indigo-500/50">
      <CardHeader>
        <CardTitle className="flex items-start gap-4">
          <span className="text-4xl mt-1">{preset.emoji}</span>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-indigo-600">
              {preset.name === 'Базовый' ? 'Быстрый старт' : preset.name === 'Продвинутый' ? 'Золотая середина' : 'Максимум деталей'}
            </span>
            <span className="text-xl font-bold text-gray-900">{preset.name}</span>
          </div>
        </CardTitle>
        <CardDescription className="pt-2 text-gray-600">{preset.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="grid grid-cols-2 gap-4 my-4 text-center border-y py-3">
          <div>
            <p className="text-3xl font-bold text-gray-900">{totalGroups}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">групп</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{totalCategories}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">категорий</p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <h4 className="font-semibold text-gray-800">Примеры групп</h4>
            <p className="text-gray-600 text-xs">{preset.groups.map(g => g.name).join(', ')}</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800">Примеры категорий</h4>
            <ul className="space-y-1 mt-1">
              {displayedCategories.map(c => (
                <li key={c.name} className="text-gray-600 text-xs flex items-center">
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full mr-2"></span>
                  {c.name}
                </li>
              ))}
              {remainingCategories > 0 && (
                <li className="text-gray-500 text-xs italic">... и ещё {remainingCategories} категорий</li>
              )}
            </ul>
          </div>
        </div>
      </CardContent>
      <CardFooter className="mt-4">
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={handleSelect}
          isLoading={isLoading}
        >
          Выбрать «{preset.name}»
        </Button>
      </CardFooter>
    </Card>
  );
}
