'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface AddRowsProps {
  onAddRows: (count: number) => void;
  className?: string;
}

export function AddRows({ onAddRows, className }: AddRowsProps) {
  const [count, setCount] = useState(1);

  const handleAdd = () => {
    if (count > 0) {
      onAddRows(count);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <div className="w-24">
          <Input
            type="number"
            min="1"
            value={count}
            onChange={e => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
            aria-label="Количество строк для добавления"
          />
        </div>
        <Button onClick={handleAdd}>+ Добавить строки</Button>
      </div>
    </div>
  );
}
