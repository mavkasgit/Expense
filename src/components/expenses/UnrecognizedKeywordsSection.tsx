'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/hooks/useToast'
import { 
  getUnrecognizedKeywords, 
  assignCategoryToKeyword, 
  deleteUnrecognizedKeyword, 
  updateUnrecognizedKeyword,
  createKeywordWithSynonym,
  addSynonymToKeyword,
  getAllKeywords
} from '@/lib/actions/keywords'
import type { Category, UnrecognizedKeyword, CategoryKeyword, KeywordSynonym } from '@/types'

type CategoryKeywordWithDetails = CategoryKeyword & {
  categories?: Category | null
  keyword_synonyms?: KeywordSynonym[]
}

interface UnrecognizedKeywordsSectionProps {
  categories: Category[]
  isVisible: boolean
  onToggleVisibility: () => void
}

export function UnrecognizedKeywordsSection({ 
  categories, 
  isVisible, 
  onToggleVisibility 
}: UnrecognizedKeywordsSectionProps) {
  const [keywords, setKeywords] = useState<UnrecognizedKeyword[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [assigningKeywords, setAssigningKeywords] = useState<Set<string>>(new Set())
  const [editingKeyword, setEditingKeyword] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'frequency' | 'keyword'>('frequency')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [currentKeyword, setCurrentKeyword] = useState<UnrecognizedKeyword | null>(null)
  const [existingKeywords, setExistingKeywords] = useState<CategoryKeywordWithDetails[]>([])
  const [assignAction, setAssignAction] = useState<'new' | 'synonym' | 'new-with-synonym'>('new')
  const [newKeywordName, setNewKeywordName] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedExistingKeywordId, setSelectedExistingKeywordId] = useState('')
  const [showAllKeywords, setShowAllKeywords] = useState(false)
  const { showToast } = useToast()

  // Форматируем категории для SearchableSelect
  const categoryOptions = categories.map(category => ({
    value: category.id,
    label: category.name,
    color: category.color || '#6366f1',
    icon: category.icon || 'shopping-bag'
  }))

  // Сортированные ключевые слова
  const sortedKeywords = [...keywords].sort((a, b) => {
    if (sortBy === 'frequency') {
      return (b.frequency || 0) - (a.frequency || 0)
    }
    return a.keyword.localeCompare(b.keyword, 'ru')
  })

  // Ключевые слова для отображения (первые 5 или все)
  const displayedKeywords = showAllKeywords ? sortedKeywords : sortedKeywords.slice(0, 5)
  const hasMoreKeywords = sortedKeywords.length > 5

  // Загружаем неопознанные ключевые слова
  useEffect(() => {
    if (isVisible) {
      loadUnrecognizedKeywords()
    }
  }, [isVisible]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadUnrecognizedKeywords = async () => {
    setIsLoading(true)
    try {
      const result = await getUnrecognizedKeywords()
      if (result.success) {
        setKeywords(result.data || [])
      } else {
        showToast(result.error || 'Ошибка загрузки неопознанных ключевых слов', 'error')
      }
    } catch (error) {
      showToast('Произошла ошибка при загрузке', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const loadExistingKeywords = async () => {
    try {
      const result = await getAllKeywords()
      if (result.success) {
        setExistingKeywords((result.data || []) as CategoryKeywordWithDetails[])
      }
    } catch (error) {
      console.error('Ошибка загрузки существующих ключевых слов:', error)
    }
  }

  const handleOpenAssignModal = (keyword: UnrecognizedKeyword) => {
    setCurrentKeyword(keyword)
    setNewKeywordName(keyword.keyword)
    setAssignAction('new')
    setSelectedCategoryId('')
    setSelectedExistingKeywordId('')
    setShowAssignModal(true)
    loadExistingKeywords()
  }

  const handleAssignKeyword = async () => {
    if (!currentKeyword || !selectedCategoryId) {
      showToast('Выберите категорию', 'error')
      return
    }

    setAssigningKeywords(prev => new Set(prev).add(currentKeyword.id))
    
    try {
      let result

      switch (assignAction) {
        case 'new':
          // Создать новое ключевое слово
          result = await assignCategoryToKeyword({
            keyword: currentKeyword.keyword,
            category_id: selectedCategoryId
          })
          break

        case 'synonym':
          // Добавить как синоним к существующему
          if (!selectedExistingKeywordId) {
            showToast('Выберите существующее ключевое слово', 'error')
            return
          }
          result = await addSynonymToKeyword({
            keyword_id: selectedExistingKeywordId,
            synonym: currentKeyword.keyword
          })
          break

        case 'new-with-synonym':
          // Создать новое ключевое слово и добавить текущее как синоним
          if (!newKeywordName.trim()) {
            showToast('Введите название нового ключевого слова', 'error')
            return
          }
          result = await createKeywordWithSynonym({
            newKeyword: newKeywordName.trim(),
            synonym: currentKeyword.keyword,
            category_id: selectedCategoryId
          })
          break

        default:
          showToast('Неизвестное действие', 'error')
          return
      }

      if (result.success) {
        const actionText = assignAction === 'new' 
          ? 'создано как новое ключевое слово'
          : assignAction === 'synonym'
          ? 'добавлено как синоним'
          : 'создано новое ключевое слово с синонимом'
        
        showToast(`"${currentKeyword.keyword}" ${actionText}`, 'success')
        setKeywords(prev => prev.filter(k => k.id !== currentKeyword.id))
        setShowAssignModal(false)
      } else {
        showToast(result.error || 'Ошибка назначения', 'error')
      }
    } catch (error) {
      showToast('Произошла ошибка при назначении', 'error')
    } finally {
      setAssigningKeywords(prev => {
        const newSet = new Set(prev)
        newSet.delete(currentKeyword.id)
        return newSet
      })
    }
  }

  const handleDeleteKeyword = async (keyword: UnrecognizedKeyword) => {
    if (!confirm(`Удалить ключевое слово "${keyword.keyword}"?`)) {
      return
    }

    try {
      const result = await deleteUnrecognizedKeyword(keyword.id)
      if (result.success) {
        showToast('Ключевое слово удалено', 'success')
        setKeywords(prev => prev.filter(k => k.id !== keyword.id))
        setSelectedKeywords(prev => {
          const newSet = new Set(prev)
          newSet.delete(keyword.id)
          return newSet
        })
      } else {
        showToast(result.error || 'Ошибка удаления ключевого слова', 'error')
      }
    } catch (error) {
      showToast('Произошла ошибка при удалении', 'error')
    }
  }

  const handleEditKeyword = (keyword: UnrecognizedKeyword) => {
    setEditingKeyword(keyword.id)
    setEditValue(keyword.keyword)
  }

  const handleSaveKeyword = async (keywordId: string) => {
    if (!editValue.trim()) {
      showToast('Ключевое слово не может быть пустым', 'error')
      return
    }

    try {
      const result = await updateUnrecognizedKeyword(keywordId, editValue.trim())
      if (result.success) {
        showToast('Ключевое слово обновлено', 'success')
        setKeywords(prev => prev.map(k => 
          k.id === keywordId ? { ...k, keyword: editValue.trim() } : k
        ))
        setEditingKeyword(null)
        setEditValue('')
      } else {
        showToast(result.error || 'Ошибка обновления ключевого слова', 'error')
      }
    } catch (error) {
      showToast('Произошла ошибка при обновлении', 'error')
    }
  }

  const handleCancelEdit = () => {
    setEditingKeyword(null)
    setEditValue('')
  }

  const handleSelectKeyword = (keywordId: string, selected: boolean) => {
    setSelectedKeywords(prev => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(keywordId)
      } else {
        newSet.delete(keywordId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    const displayedIds = displayedKeywords.map(k => k.id)
    const allDisplayedSelected = displayedIds.every(id => selectedKeywords.has(id))
    
    if (allDisplayedSelected) {
      // Убираем выбор с отображаемых
      setSelectedKeywords(prev => {
        const newSet = new Set(prev)
        displayedIds.forEach(id => newSet.delete(id))
        return newSet
      })
    } else {
      // Выбираем все отображаемые
      setSelectedKeywords(prev => {
        const newSet = new Set(prev)
        displayedIds.forEach(id => newSet.add(id))
        return newSet
      })
    }
  }

  const handleBulkAssignCategory = async (categoryId: string) => {
    if (selectedKeywords.size === 0) {
      showToast('Выберите ключевые слова для назначения категории', 'warning')
      return
    }

    const selectedKeywordsList = keywords.filter(k => selectedKeywords.has(k.id))
    
    for (const keyword of selectedKeywordsList) {
      setAssigningKeywords(prev => new Set(prev).add(keyword.id))
      
      try {
        const result = await assignCategoryToKeyword({
          keyword: keyword.keyword,
          category_id: categoryId
        })

        if (result.success) {
          setKeywords(prev => prev.filter(k => k.id !== keyword.id))
        } else {
          showToast(`Ошибка назначения "${keyword.keyword}": ${result.error}`, 'error')
        }
      } catch (error) {
        showToast(`Ошибка назначения "${keyword.keyword}"`, 'error')
      } finally {
        setAssigningKeywords(prev => {
          const newSet = new Set(prev)
          newSet.delete(keyword.id)
          return newSet
        })
      }
    }

    setSelectedKeywords(new Set())
    showToast(`Назначено категорий: ${selectedKeywordsList.length}`, 'success')
  }

  const handleBulkDelete = async () => {
    if (selectedKeywords.size === 0) {
      showToast('Выберите ключевые слова для удаления', 'warning')
      return
    }

    if (!confirm(`Удалить выбранные ключевые слова (${selectedKeywords.size})?`)) {
      return
    }

    const selectedKeywordsList = keywords.filter(k => selectedKeywords.has(k.id))
    
    for (const keyword of selectedKeywordsList) {
      try {
        const result = await deleteUnrecognizedKeyword(keyword.id)
        if (result.success) {
          setKeywords(prev => prev.filter(k => k.id !== keyword.id))
        } else {
          showToast(`Ошибка удаления "${keyword.keyword}": ${result.error}`, 'error')
        }
      } catch (error) {
        showToast(`Ошибка удаления "${keyword.keyword}"`, 'error')
      }
    }

    setSelectedKeywords(new Set())
    showToast(`Удалено ключевых слов: ${selectedKeywordsList.length}`, 'success')
  }

  if (keywords.length === 0 && !isLoading) {
    return null // Не показываем секцию если нет неопознанных ключевых слов
  }

  return (
    <Card className="mb-6">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold text-gray-900">
              🔤 Неопознанные ключевые слова
            </h3>
            <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2 py-1 rounded-full">
              {keywords.length}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleVisibility}
          >
            {isVisible ? 'Скрыть' : 'Показать'}
          </Button>
        </div>

        {isVisible && (
          <>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-600 mt-2">Загрузка...</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-600">
                    Назначьте категории этим ключевым словам для улучшения автоматической категоризации расходов.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSortBy(sortBy === 'frequency' ? 'keyword' : 'frequency')}
                    >
                      Сортировка: {sortBy === 'frequency' ? 'По частоте' : 'По алфавиту'}
                    </Button>
                  </div>
                </div>

                {selectedKeywords.size > 0 && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-blue-800">
                        Выбrano: {selectedKeywords.size} ключевых слов
                      </span>
                      <div className="flex gap-2">
                        <SearchableSelect
                          options={categoryOptions}
                          value=""
                          onChange={(categoryId) => {
                            if (categoryId) {
                              handleBulkAssignCategory(categoryId)
                            }
                          }}
                          placeholder="Назначить категорию всем"
                          size="sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleBulkDelete}
                          className="text-red-600 hover:text-red-700"
                        >
                          Удалить выбранные
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left p-2 w-8">
                          <input
                            type="checkbox"
                            checked={displayedKeywords.length > 0 && displayedKeywords.every(k => selectedKeywords.has(k.id))}
                            onChange={handleSelectAll}
                            className="rounded border-gray-300"
                          />
                        </th>
                        <th className="text-left p-2">Ключевое слово</th>
                        <th className="text-left p-2 w-20">Частота</th>
                        <th className="text-left p-2 w-32">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedKeywords.map((keyword) => (
                        <tr key={keyword.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={selectedKeywords.has(keyword.id)}
                              onChange={(e) => handleSelectKeyword(keyword.id, e.target.checked)}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="p-2">
                            {editingKeyword === keyword.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSaveKeyword(keyword.id)
                                    } else if (e.key === 'Escape') {
                                      handleCancelEdit()
                                    }
                                  }}
                                  className="text-sm"
                                  autoFocus
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSaveKeyword(keyword.id)}
                                  className="text-green-600 hover:text-green-700 p-1"
                                >
                                  ✓
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleCancelEdit}
                                  className="text-gray-400 hover:text-gray-600 p-1"
                                >
                                  ✕
                                </Button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleEditKeyword(keyword)}
                                className="text-left hover:text-blue-600 transition-colors"
                                title="Нажмите для редактирования"
                              >
                                {keyword.keyword}
                              </button>
                            )}
                          </td>
                          <td className="p-2 text-sm text-gray-600">
                            {keyword.frequency}
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenAssignModal(keyword)}
                                disabled={assigningKeywords.has(keyword.id)}
                                className="text-xs"
                              >
                                {assigningKeywords.has(keyword.id) ? 'Назначение...' : 'Назначить'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteKeyword(keyword)}
                                className="text-red-400 hover:text-red-600 p-1"
                                title="Удалить"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {hasMoreKeywords && (
                  <div className="mt-4 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllKeywords(!showAllKeywords)}
                    >
                      {showAllKeywords 
                        ? `Показать только первые 5` 
                        : `Показать все (${sortedKeywords.length})`
                      }
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Модальное окно назначения */}
        <Modal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          title={`Назначить ключевое слово: "${currentKeyword?.keyword}"`}
        >
          <div className="space-y-4">
            <div className="space-y-3">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="assignAction"
                  value="new"
                  checked={assignAction === 'new'}
                  onChange={(e) => setAssignAction(e.target.value as any)}
                  className="text-blue-600"
                />
                <span>Создать новое ключевое слово</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="assignAction"
                  value="synonym"
                  checked={assignAction === 'synonym'}
                  onChange={(e) => setAssignAction(e.target.value as any)}
                  className="text-blue-600"
                />
                <span>Добавить как синоним к существующему</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="assignAction"
                  value="new-with-synonym"
                  checked={assignAction === 'new-with-synonym'}
                  onChange={(e) => setAssignAction(e.target.value as any)}
                  className="text-blue-600"
                />
                <span>Создать новое ключевое слово и добавить как синоним</span>
              </label>
            </div>

            {assignAction === 'new-with-synonym' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название нового ключевого слова
                </label>
                <Input
                  value={newKeywordName}
                  onChange={(e) => setNewKeywordName(e.target.value)}
                  placeholder="Например: Продукты"
                />
              </div>
            )}

            {assignAction === 'synonym' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Существующее ключевое слово
                </label>
                <SearchableSelect
                  options={existingKeywords.map(kw => ({
                    value: kw.id,
                    label: `${kw.keyword} (${kw.categories?.name || 'Без категории'})`,
                    color: kw.categories?.color || '#6366f1'
                  }))}
                  value={selectedExistingKeywordId}
                  onChange={(value) => setSelectedExistingKeywordId(value || '')}
                  placeholder="Выберите ключевое слово..."
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Категория
              </label>
              <SearchableSelect
                options={categoryOptions}
                value={selectedCategoryId}
                onChange={(value) => setSelectedCategoryId(value || '')}
                placeholder="Выберите категорию..."
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowAssignModal(false)}
              >
                Отмена
              </Button>
              <Button
                onClick={handleAssignKeyword}
                disabled={!selectedCategoryId || (assignAction === 'synonym' && !selectedExistingKeywordId)}
              >
                Назначить
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Card>
  )
}