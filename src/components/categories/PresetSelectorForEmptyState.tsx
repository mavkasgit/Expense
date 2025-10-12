'use client'

import { presets } from '@/lib/presets';
import { PresetCard } from './PresetCard';
import type { Category, CategoryGroup } from '@/types';

interface PresetSelectorForEmptyStateProps {
  onSuccess: (newGroups: CategoryGroup[], newCategories: Category[]) => void;
}

export function PresetSelectorForEmptyState({ onSuccess }: PresetSelectorForEmptyStateProps) {
  return (
    <div className="w-full bg-white rounded-lg p-8">
      <div className="max-w-3xl mx-auto text-center mb-12">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Начните с готового шаблона
        </h2>
        <p className="mt-4 text-lg text-gray-600">
          У вас пока нет ни одной категории. Выберите готовый сценарий, чтобы быстро начать. Все группы и категории можно будет донастроить позже.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        {presets.map(preset => (
          <PresetCard key={preset.name} preset={preset} onSuccess={onSuccess} />
        ))}
      </div>
    </div>
  );
}
