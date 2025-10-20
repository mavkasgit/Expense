'use client'

import { useState, useCallback, useEffect } from 'react'
import { 
  getAllUserData, 
  restoreUserData,
  previewRestore,
  getUserDataStats,
} from '@/lib/actions/backup'
import { useToast } from '@/hooks/useToast'
import type { BackupData, DataStats } from '@/types/backup'

const keyTranslations: { [key: string]: string } = {
  expenses: 'Расходы',
  categories: 'Категории',
  categoryGroups: 'Группы категорий',
  categoryKeywords: 'Ключевые слова',
  keywordSynonyms: 'Синонимы слов',
  cities: 'Города',
  citySynonyms: 'Синонимы городов',
  unrecognizedCities: 'Неопознанные города',
  unrecognizedKeywords: 'Неопознанные слова',
  bankStatements: 'Банковские выписки',
};

export function BackupPageContent() {
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<BackupData | null>(null);
  const [dataStats, setDataStats] = useState<DataStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const [showRestorePreview, setShowRestorePreview] = useState(false);
  const [restorePreview, setRestorePreview] = useState<any>(null);
  const [isLoadingRestorePreview, setIsLoadingRestorePreview] = useState(false);
  const [restoreDataToConfirm, setRestoreDataToConfirm] = useState<BackupData | null>(null);
  
  const { showToast } = useToast();

  const loadStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const result = await getUserDataStats();
      if (result.success && result.stats) {
        setDataStats(result.stats);
      } else {
        showToast(result.error || 'Ошибка при загрузке статистики', 'error');
      }
    } catch (error) {
      console.error('Ошибка при загрузке статистики:', error);
      showToast('Неожиданная ошибка при загрузке статистики', 'error');
    } finally {
      setIsLoadingStats(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const result = await getAllUserData();
      if (!result.success || !result.data) {
        showToast(result.error || 'Ошибка при создании резервной копии', 'error');
        return;
      }
      const jsonString = JSON.stringify(result.data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const date = new Date().toISOString().split('T')[0];
      const userInfo = result.data.metadata?.userEmail?.split('@')[0] || 'user';
      const filename = `ExpenseTracker-${userInfo}-${date}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Резервная копия успешно создана и скачана', 'success');
    } catch (error) {
      console.error('Ошибка при создании резервной копии:', error);
      showToast('Неожиданная ошибка при создании резервной копии', 'error');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const processFile = useCallback((file: File) => {
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      showToast('Пожалуйста, выберите JSON файл', 'error');
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setPreviewData(data);
      } catch (error) {
        showToast('Некорректный JSON файл', 'error');
        setSelectedFile(null);
        setPreviewData(null);
      }
    };
    reader.readAsText(file);
  }, [showToast]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleRestorePreview = async () => {
    if (!previewData) {
      showToast('Сначала выберите файл резервной копии', 'error');
      return;
    }
    setIsLoadingRestorePreview(true);
    try {
      const result = await previewRestore(previewData);
      if (result.success) {
        setRestorePreview(result.preview);
        setRestoreDataToConfirm(previewData);
        setShowRestorePreview(true);
      } else {
        showToast(result.message, 'error');
      }
    } catch (error) {
      console.error('Ошибка предварительного просмотра:', error);
      showToast('Ошибка предварительного просмотра', 'error');
    } finally {
      setIsLoadingRestorePreview(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreDataToConfirm) {
      showToast('Нет данных для восстановления', 'error');
      return;
    }
    setIsRestoring(true);
    try {
      const result = await restoreUserData(restoreDataToConfirm);
      if (result.success) {
        showToast(result.message, 'success');
        handleCancelRestore();
        const fileInput = document.getElementById('backup-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        loadStats(); // Reload stats after restore
      } else {
        showToast(result.message, 'error');
      }
    } catch (error) {
      console.error('Ошибка при восстановлении:', error);
      showToast('Неожиданная ошибка при восстановлении данных', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCancelRestore = () => {
    setShowRestorePreview(false);
    setRestorePreview(null);
    setRestoreDataToConfirm(null);
    setSelectedFile(null);
    setPreviewData(null);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Backup Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Создание резервной копии</h2>
          <p className="text-gray-600 mb-6">Создайте полную резервную копию всех ваших данных. Файл будет автоматически скачан в формате JSON.</p>
          {isLoadingStats ? (
            <div className="bg-gray-50 p-4 rounded-lg mb-6 flex items-center justify-center h-24">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-current border-t-transparent text-blue-600"></div>
            </div>
          ) : dataStats && (
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h3 className="font-medium mb-2">Данные в базе:</h3>
              <div className="text-sm space-y-1">
                {Object.entries(dataStats).map(([key, value]) => key !== 'totalRecords' && (
                  <div className="flex justify-between" key={key}><span>{keyTranslations[key] || key}:</span><span className="font-medium">{value}</span></div>
                ))}
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-semibold"><span>Всего записей:</span><span>{dataStats.totalRecords}</span></div>
                </div>
              </div>
            </div>
          )}
          <button onClick={handleCreateBackup} disabled={isCreatingBackup || isLoadingStats} className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {isCreatingBackup ? 'Создание копии...' : 'Скачать резервную копию'}
          </button>
        </div>

        {/* Restore Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Восстановление из резервной копии</h2>
          <p className="text-gray-600 mb-6">Загрузите файл резервной копии. Все текущие данные будут заменены.</p>
          <div className="space-y-4">
            <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragOver ? 'bg-blue-50 border-blue-400' : 'border-gray-300 hover:border-gray-400'}`}>
              <div className="mx-auto w-12 h-12 text-gray-400"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg></div>
              <p className="text-lg font-medium text-gray-900">{isDragOver ? 'Отпустите файл' : 'Перетащите файл сюда'}</p>
              <p className="text-sm text-gray-500 mt-1">или</p>
              <label className="mt-2 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"><span>Выберите файл</span><input id="backup-file" type="file" accept=".json" onChange={handleFileSelect} className="hidden"/></label>
            </div>
            {selectedFile && (
              <div className="bg-blue-50 p-4 rounded-lg flex items-center space-x-3">
                <p className="text-sm font-medium text-blue-900 truncate flex-1">{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</p>
                <button onClick={handleCancelRestore} className="flex-shrink-0 text-blue-600 hover:text-blue-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            )}
            <button onClick={handleRestorePreview} disabled={!previewData || isLoadingRestorePreview} className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoadingRestorePreview ? 'Анализ...' : 'Предварительный просмотр'}
            </button>
          </div>
        </div>
      </div>

      {/* Restore Preview Modal */}
      {showRestorePreview && restorePreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">⚠️ Подтверждение восстановления</h2>
              <button onClick={handleCancelRestore} className="text-gray-400 hover:text-gray-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-red-800">ВНИМАНИЕ: Все текущие данные будут удалены!</h3>
              <p className="mt-2 text-sm text-red-700">Это действие необратимо. Убедитесь, что вы выбрали правильный файл резервной копии.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-red-800 mb-3">Текущие данные (будут удалены)</h3>
                <div className="space-y-2 text-sm">{Object.entries(restorePreview.currentData).map(([key, value]) => key !== 'totalRecords' && <div className="flex justify-between" key={`current-${key}`}><span>{keyTranslations[key] || key}:</span><span className="font-medium">{value as any}</span></div>)}<div className="border-t pt-2 mt-2"><div className="flex justify-between font-bold text-red-800"><span>Всего:</span><span>{restorePreview.currentData.totalRecords}</span></div></div></div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-800 mb-3">Данные из резервной копии (будут восстановлены)</h3>
                <div className="space-y-2 text-sm">{Object.entries(restorePreview.backupData).map(([key, value]) => key !== 'totalRecords' && <div className="flex justify-between" key={`backup-${key}`}><span>{keyTranslations[key] || key}:</span><span className="font-medium">{value as any}</span></div>)}<div className="border-t pt-2 mt-2"><div className="flex justify-between font-bold text-green-800"><span>Всего:</span><span>{restorePreview.backupData.totalRecords}</span></div></div></div>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={handleCancelRestore} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Отмена</button>
              <button onClick={handleConfirmRestore} disabled={isRestoring} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {isRestoring ? 'Восстановление...' : 'Подтвердить и восстановить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}