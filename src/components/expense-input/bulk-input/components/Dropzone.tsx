'use client'

import { forwardRef } from 'react'

interface DropzoneProps {
  isDragOver: boolean
  onClick: () => void
  onPaste: (event: React.ClipboardEvent<HTMLDivElement>) => void
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void
  onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}

export const Dropzone = forwardRef<HTMLInputElement, DropzoneProps>(function Dropzone(
  { isDragOver, onClick, onPaste, onDragOver, onDragLeave, onDrop, onFileChange },
  fileInputRef
) {
  return (
    <div
      className={`relative block w-full rounded-lg border-2 border-dashed border-gray-300 p-12 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors cursor-pointer ${
        isDragOver ? 'bg-blue-50 border-blue-400' : 'bg-white'
      }`}
      onPaste={onPaste}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label="Загрузить файл"
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
          Перетащите файлы сюда или нажмите для загрузки
        </span>
        <span className="block text-xs text-gray-500">
          CSV, Excel, HTML или просто вставьте из буфера обмена
        </span>
      </div>
      <input ref={fileInputRef} type="file" accept="*/*" onChange={onFileChange} className="hidden" />
    </div>
  )
})
