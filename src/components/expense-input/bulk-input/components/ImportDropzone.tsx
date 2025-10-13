'use client';

import type { KeyboardEvent } from 'react';

interface ImportDropzoneProps {
  isDragOver: boolean;
  onBrowse: () => void;
  onPaste: (event: React.ClipboardEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
}

export function ImportDropzone({
  isDragOver,
  onBrowse,
  onPaste,
  onDragOver,
  onDragLeave,
  onDrop,
}: ImportDropzoneProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onBrowse();
    }
  };

  return (
    <div
      className={`relative block w-full cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
        isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'
      }`}
      onClick={onBrowse}
      onPaste={onPaste}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Загрузить файл с таблицей расходов"
    >
      <div className="flex flex-col items-center gap-2 text-gray-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <span className="mt-2 block text-sm font-semibold text-gray-900">
          Перетащите файл сюда или нажмите для загрузки
        </span>
        <span className="block text-xs text-gray-500">
          CSV, Excel, HTML или просто вставьте из буфера обмена
        </span>
      </div>
    </div>
  );
}
