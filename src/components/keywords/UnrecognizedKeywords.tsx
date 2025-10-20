'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { SimpleToast } from '@/components/ui/Toast'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { 
  getUnrecognizedKeywords,
  assignCategoryToKeyword,
  deleteUnrecognizedKeyword
} from '@/lib/actions/keywords'
import { formatDateLocaleRu } from '@/lib/utils/dateUtils'
import type { UnrecognizedKeyword, Category } from '@/types'

interface UnrecognizedKeywordsProps {
  categories: Category[]
  onKeywordAssigned?: () => void
}

export function UnrecognizedKeywords({ categories, onKeywordAssigned }: UnrecognizedKeywordsProps) {
  const [keywords, setKeywords] = useState<UnrecognizedKeyword[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [assigningKeyword, setAssigningKeyword] = useState<UnrecognizedKeyword | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Загрузка неопознанных ключевых слов
  const loadKeywords = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await getUnrecognizedKeywords()

      if (result.error) {
        setError(result.error)
      } else {
        setKeywords(result.data || [])
      }
    } catch (err) {
      setError('Произошла ошибка при загрузке неопознанных ключевых слов')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadKeywords()
  }, [])

  // Открытие модального окна назначения категории
  const openAssignModal = (keyword: UnrecognizedKeyword) => {
    setAssigningKeyword(keyword)
    setSelectedCategoryId('')
    setIsAssignModalOpen(true)
  }

  // Назначение категории ключевому слову
  const handleAssignCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!assigningKeyword || !selectedCategoryId) {
      setError('Выберите категорию')
      return
    }

    setLoading(true)
    const result = await assignCategoryToKeyword({
      keyword: assigningKeyword.keyword,
      category_id: selectedCategoryId
    })

    if (result.error) {
      setError(result.error)
      setToast({ message: result.error, type: 'error' })
    } else {
      setToast({ message: 'Категория успешно назначена ключевому слову', type: 'success' })
      setIsAssignModalOpen(false)
      setAssigningKeyword(null)
      await loadKeywords()
      onKeywordAssigned?.()
    }
    setLoading(false)
  }

  // Удаление неопознанного ключевого слова
  const handleDeleteKeyword = async (keyword: UnrecognizedKeyword) => {
    if (!confirm(`Удалить неопознанное ключевое слово &quot;${keyword.keyword}&quot;?`)) {
      return
    }

    setLoading(true)
    const result = await deleteUnrecognizedKeyword(keyword.id)

    if (result.error) {
      setError(result.error)
      setToast({ message: result.error, type: 'error' })
    } else {
      setToast({ message: 'Ключевое слово удалено', type: 'success' })
      await loadKeywords()
    }
    setLoading(false)
  }

  // Получение названия категории
  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId)
    return category?.name || 'Неизвестная категория'
  }

  if (loading && keywords.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Загрузка неопознанных ключевых слов...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          Неопознанные ключевые слова
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Назначьте категории для автоматической обработки похожих расходов в будущем
        </p>
      </div>

      {/* Ошибка */}
      {error && (
        <ErrorMessage error={error} onDismiss={() => setError(null)} showDismiss />
      )}

      {/* Список неопознанных ключевых слов */}
      {keywords.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-gray-500">
            Нет неопознанных ключевых слов
          </div>
          <p className="text-sm text-gray-400 mt-2">
            Все ключевые слова из ваших расходов уже имеют назначенные категории
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {keywords.map((keyword) => (
            <Card key={keyword.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">
                        {keyword.keyword}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Встречается {keyword.frequency || 1} раз
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                      <span>
                        Первое появление: {formatDateLocaleRu(keyword.first_seen || '')}
                      </span>
                      <span>
                        Последнее: {formatDateLocaleRu(keyword.last_seen || '')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openAssignModal(keyword)}
                    disabled={loading}
                  >
                    Назначить категорию
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteKeyword(keyword)}
                    disabled={loading}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Удалить
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Модальное окно назначения категории */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Назначить категорию для &quot;${assigningKeyword?.keyword}&quot;`}
      >
        <form onSubmit={handleAssignCategory} className="space-y-4">
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Категория *
            </label>
            <SearchableSelect<Category>
              options={categories}
              value={selectedCategoryId}
              onChange={(v) => setSelectedCategoryId(v || '')}
              getOptionValue={(c) => c.id}
              getOptionLabel={(c) => c.name}
              getOptionColor={(c) => c.color}
              placeholder="Выберите категорию"
              required
            />
          </div>



          {assigningKeyword && (
            <div className="bg-blue-50 p-3 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Информация:</strong> Это ключевое слово встречается {assigningKeyword.frequency || 1} раз в ваших расходах. 
                После назначения категории все неопознанные расходы с этим словом будут автоматически перекатегоризированы.
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAssignModalOpen(false)}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Назначение...' : 'Назначить категорию'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Toast уведомления */}
      {toast && (
        <SimpleToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}