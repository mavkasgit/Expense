'use client';

interface SelectedTableInfoProps {
  description: string;
  rowCount: number;
  columnCount: number;
  hasHeaders: boolean;
}

export function SelectedTableInfo({
  description,
  rowCount,
  columnCount,
  hasHeaders,
}: SelectedTableInfoProps) {
  return (
    <div className="w-full rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
      <span className="font-medium">Текущая таблица:</span> {description}
      <span className="ml-2 text-blue-600">
        ({rowCount} строк, {columnCount} столбцов, {hasHeaders ? 'есть заголовок' : 'без заголовка'})
      </span>
    </div>
  );
}
