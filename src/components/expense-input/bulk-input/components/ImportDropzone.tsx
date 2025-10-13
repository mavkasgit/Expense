'use client';

import type { KeyboardEvent, MouseEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface ImportDropzoneProps {
  isDragOver: boolean;
  onBrowse: () => void;
  onPaste: (event: React.ClipboardEvent) => void;
  onImportFromClipboard: () => Promise<void> | void;
  fileName?: string;
  isFileLoading: boolean;
  fileStatusMessage?: string;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  onClearFile: () => void;
}

export function ImportDropzone({
  isDragOver,
  onBrowse,
  onPaste,
  onImportFromClipboard,
  fileName,
  isFileLoading,
  fileStatusMessage,
  onDragOver,
  onDragLeave,
  onDrop,
  onClearFile,
}: ImportDropzoneProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onBrowse();
    }
  };

  const handleClipboardButtonClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    await onImportFromClipboard();
  };

  const handleClearClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onClearFile();
  };

  const hasFile = Boolean(fileName);
  const fileExtension = fileName ? fileName.split('.').pop()?.toUpperCase() : '';

  return (
    <div
      className={cn(
        'group relative flex cursor-pointer flex-col gap-6 rounded-lg border-2 border-dashed p-8 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
        isDragOver
          ? 'border-blue-400 bg-blue-50'
          : hasFile
            ? 'border-emerald-400 bg-emerald-50/40 hover:border-emerald-500'
            : 'border-gray-300 bg-white hover:border-gray-400',
      )}
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
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-1 flex-col items-center gap-4 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={cn('h-14 w-14 text-gray-400 transition-colors', hasFile && 'text-emerald-500')}
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

          {hasFile ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-3">
                <div className="rounded-lg bg-white px-4 py-2 shadow-sm ring-1 ring-emerald-200">
                  <div className="flex items-center gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-900">{fileName}</p>
                      <p className="text-xs text-gray-500">{fileExtension} файл</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearClick}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      aria-label="Удалить файл"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-sm">
                {isFileLoading ? (
                  <span className="inline-flex items-center gap-2 font-medium text-indigo-600">
                    <span className="h-3 w-3 animate-spin rounded-full border border-indigo-400 border-t-transparent" aria-hidden />
                    {fileStatusMessage || 'Обрабатываем файл...'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 font-semibold text-emerald-600">
                    <span aria-hidden>✓</span>
                    Файл готов к разбору
                  </span>
                )}
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  onBrowse();
                }}
                className="flex items-center gap-2"
              >
                <span aria-hidden>🔄</span>
                <span>Заменить файл</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="block text-base font-semibold text-gray-900">
                  Перетащите файл сюда или нажмите в любом месте
                </span>
                <span className="block text-sm text-gray-500">
                  Поддерживаются CSV, Excel и HTML-файлы с таблицами
                </span>
              </div>

              {isFileLoading && (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600">
                  <span className="h-3 w-3 animate-spin rounded-full border border-indigo-400 border-t-transparent" aria-hidden />
                  {fileStatusMessage || 'Обрабатываем файл...'}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleClipboardButtonClick}
            className="flex-shrink-0"
          >
            <span className="flex items-center gap-2">
              <span aria-hidden>📋</span>
              <span>Буфер</span>
            </span>
          </Button>
        </div>
      </div>

      <div className="border-t pt-4 text-center text-xs text-gray-500">
        Вы можете вставить таблицу из буфера обмена с помощью Ctrl+V или кнопки &ldquo;Буфер&rdquo;
      </div>
    </div>
  );
}
