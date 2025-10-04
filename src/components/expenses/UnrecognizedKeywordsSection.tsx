'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SearchableSelect } from '@/components/ui/SearchableSelect'

import { useToast } from '@/hooks/useToast'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import {
  getUnrecognizedKeywords,
  assignCategoryToKeyword,
  deleteUnrecognizedKeyword,
  updateUnrecognizedKeyword,
  addSynonymToKeyword,
  getAllKeywords,
  bulkAssignCategoryToKeywords,
  bulkAddSynonymsToKeyword,
  bulkDeleteUnrecognizedKeywords
} from '@/lib/actions/keywords'
import { availableIcons } from '@/lib/utils/category-constants'
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
  const [showAllKeywords, setShowAllKeywords] = useState(false)
  const [existingKeywords, setExistingKeywords] = useState<CategoryKeywordWithDetails[]>([])
  const [keywordActions, setKeywordActions] = useState<Record<string, 'new' | 'synonym'>>({})
  const [keywordCategories, setKeywordCategories] = useState<Record<string, string>>({})
  const [keywordExistingIds, setKeywordExistingIds] = useState<Record<string, string>>({})

  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set())
  const [bulkNewCategoryId, setBulkNewCategoryId] = useState('')
  const [bulkSynonymKeywordId, setBulkSynonymKeywordId] = useState('')
  const [newKeywordText, setNewKeywordText] = useState('')
  const [newKeywordCategoryId, setNewKeywordCategoryId] = useState('')
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const [isCreatingKeyword, setIsCreatingKeyword] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; keyword: UnrecognizedKeyword | null }>({
    isOpen: false,
    keyword: null
  })
  const { showToast } = useToast()

  // Форматируем категории для SearchableSelect
  const categoryOptions = categories.map(category => {
    const iconEmoji = availableIcons.find(i => i.key === category.icon)?.emoji || '📦'
    return {
      value: category.id,
      label: category.name,
      color: category.color || '#6366f1',
      icon: <span className="mr-2 text-base">{iconEmoji}</span>
    }
  })

  // Ключевые слова отсортированные по частоте (по убыванию)
  const sortedKeywords = [...keywords].sort((a, b) => (b.frequency || 0) - (a.frequency || 0))

  // Ключевые слова для отображения (первые 5 или все)
  const displayedKeywords = showAllKeywords ? sortedKeywords : sortedKeywords.slice(0, 5)
  const hasMoreKeywords = sortedKeywords.length > 5

  // Загружаем неопознанные ключевые слова
  useEffect(() => {
    if (isVisible) {
      loadUnrecognizedKeywords()
      loadExistingKeywords()
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

  const getKeywordAction = (keywordId: string): 'new' | 'synonym' => {
    return keywordActions[keywordId] || 'new'
  }

  const setKeywordAction = (keywordId: string, action: 'new' | 'synonym') => {
    setKeywordActions(prev => ({ ...prev, [keywordId]: action }))
  }

  const getKeywordCategory = (keywordId: string): string => {
    return keywordCategories[keywordId] || ''
  }

  const setKeywordCategory = (keywordId: string, categoryId: string) => {
    setKeywordCategories(prev => ({ ...prev, [keywordId]: categoryId }))
  }

  const getKeywordExistingId = (keywordId: string): string => {
    return keywordExistingIds[keywordId] || ''
  }

  const setKeywordExistingId = (keywordId: string, existingId: string) => {
    setKeywordExistingIds(prev => ({ ...prev, [keywordId]: existingId }))
  }





  const handleKeywordSelect = (keywordId: string, selected: boolean) => {
    // Сохраняем текущую позицию скролла
    const scrollPosition = window.scrollY

    setSelectedKeywords(prev => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(keywordId)
      } else {
        newSet.delete(keywordId)
      }
      return newSet
    })

    // Восстанавливаем позицию скролла после обновления состояния
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollPosition)
    })
  }

  const handleSelectAll = () => {
    // Сохраняем текущую позицию скролла
    const scrollPosition = window.scrollY

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

    // Восстанавливаем позицию скролла после обновления состояния
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollPosition)
    })
  }

  const handleBulkAssign = async (action: 'new' | 'synonym', categoryId?: string, existingKeywordId?: string) => {
    if (selectedKeywords.size === 0) {
      showToast('Выберите ключевые слова для массового назначения', 'warning')
      return
    }

    const selectedKeywordsList = keywords.filter(k => selectedKeywords.has(k.id))
    const keywordTexts = selectedKeywordsList.map(k => k.keyword)
    const keywordIds = selectedKeywordsList.map(k => k.id)

    // Показываем индикатор загрузки для всех выбранных
    setAssigningKeywords(prev => {
      const newSet = new Set(prev)
      keywordIds.forEach(id => newSet.add(id))
      return newSet
    })

    try {
      let result

      if (action === 'new') {
        if (!categoryId) {
          showToast('Выберите категорию для массового назначения', 'error')
          return
        }
        result = await bulkAssignCategoryToKeywords({
          keywords: keywordTexts,
          category_id: categoryId
        })
      } else {
        if (!existingKeywordId) {
          showToast('Выберите ключевое слово для массового назначения', 'error')
          return
        }
        result = await bulkAddSynonymsToKeyword({
          keyword_id: existingKeywordId,
          synonyms: keywordTexts
        })
      }

      if (result.success) {
        // Удаляем все обработанные ключевые слова из списка
        setKeywords(prev => prev.filter(k => !selectedKeywords.has(k.id)))
        setSelectedKeywords(new Set())
        showToast(`Успешно обработано: ${result.count} ключевых слов`, 'success')
      } else {
        showToast(result.error || 'Ошибка массового назначения', 'error')
      }
    } catch (error) {
      showToast('Произошла ошибка при массовом назначении', 'error')
    } finally {
      // Убираем индикатор загрузки
      setAssigningKeywords(prev => {
        const newSet = new Set(prev)
        keywordIds.forEach(id => newSet.delete(id))
        return newSet
      })
    }
  }

  const handleBulkConfirm = async () => {
    if (selectedKeywords.size === 0) {
      showToast('Выберите ключевые слова для подтверждения', 'warning')
      return
    }

    const selectedList = keywords.filter(k => selectedKeywords.has(k.id))
    const keywordTexts = selectedList.map(k => k.keyword).join(', ')

    if (!confirm(`Подтвердить назначение для выбранных ключевых слов:\n${keywordTexts}`)) {
      return
    }

    let successCount = 0
    const keywordIds = selectedList.map(k => k.id)

    // Показываем индикатор загрузки для всех выбранных
    setAssigningKeywords(prev => {
      const newSet = new Set(prev)
      keywordIds.forEach(id => newSet.add(id))
      return newSet
    })

    try {
      for (const keyword of selectedList) {
        const action = getKeywordAction(keyword.id)
        const categoryId = getKeywordCategory(keyword.id)

        // Проверяем, что все необходимые поля заполнены
        if (action === 'new' && !categoryId) {
          showToast(`Для "${keyword.keyword}" не выбрана категория`, 'error')
          continue
        }

        if (action === 'synonym') {
          const existingId = getKeywordExistingId(keyword.id)
          if (!existingId) {
            showToast(`Для "${keyword.keyword}" не выбрано существующее ключевое слово`, 'error')
            continue
          }
        }

        // Выполняем назначение
        try {
          let result

          if (action === 'new') {
            result = await assignCategoryToKeyword({
              keyword: keyword.keyword,
              category_id: categoryId
            })
          } else {
            const existingId = getKeywordExistingId(keyword.id)
            result = await addSynonymToKeyword({
              keyword_id: existingId,
              synonym: keyword.keyword
            })
          }

          if (result.success) {
            successCount++
          } else {
            showToast(`Ошибка назначения "${keyword.keyword}": ${result.error}`, 'error')
          }
        } catch (error) {
          showToast(`Ошибка назначения "${keyword.keyword}"`, 'error')
        }
      }

      if (successCount > 0) {
        // Удаляем успешно обработанные ключевые слова
        setKeywords(prev => prev.filter(k => !selectedKeywords.has(k.id)))
        setSelectedKeywords(new Set())
        showToast(`Успешно подтверждено: ${successCount} ключевых слов`, 'success')
      }
    } finally {
      // Убираем индикатор загрузки
      setAssigningKeywords(prev => {
        const newSet = new Set(prev)
        keywordIds.forEach(id => newSet.delete(id))
        return newSet
      })
    }
  }

  const handleBulkDelete = async () => {
    if (selectedKeywords.size === 0) {
      showToast('Выберите ключевые слова для удаления', 'warning')
      return
    }

    if (!confirm(`Удалить выбранные ключевые слова (${selectedKeywords.size})?`)) {
      return
    }

    const selectedKeywordIds = Array.from(selectedKeywords)

    try {
      const result = await bulkDeleteUnrecognizedKeywords(selectedKeywordIds)

      if (result.success) {
        // Удаляем все выбранные ключевые слова из списка
        setKeywords(prev => prev.filter(k => !selectedKeywords.has(k.id)))
        setSelectedKeywords(new Set())
        showToast(`Удалено ключевых слов: ${result.count}`, 'success')
      } else {
        showToast(result.error || 'Ошибка массового удаления', 'error')
      }
    } catch (error) {
      showToast('Произошла ошибка при массовом удалении', 'error')
    }
  }

  const handleAssignKeyword = async (keyword: UnrecognizedKeyword) => {
    const action = getKeywordAction(keyword.id)
    const categoryId = getKeywordCategory(keyword.id)

    // Проверяем категорию только для создания нового ключевого слова
    if (action === 'new' && !categoryId) {
      showToast('Выберите категорию', 'error')
      return
    }

    setAssigningKeywords(prev => new Set(prev).add(keyword.id))

    try {
      let result

      if (action === 'new') {
        // Создать новое ключевое слово
        result = await assignCategoryToKeyword({
          keyword: keyword.keyword,
          category_id: categoryId
        })
      } else {
        // Добавить как синоним к существующему
        const existingId = getKeywordExistingId(keyword.id)
        if (!existingId) {
          showToast('Выберите существующее ключевое слово', 'error')
          return
        }
        result = await addSynonymToKeyword({
          keyword_id: existingId,
          synonym: keyword.keyword
        })
      }

      if (result.success) {
        const actionText = action === 'new'
          ? 'создано как новое ключевое слово'
          : 'добавлено как синоним'

        showToast(`"${keyword.keyword}" ${actionText}`, 'success')
        setKeywords(prev => prev.filter(k => k.id !== keyword.id))

        // Очищаем состояния для этого ключевого слова
        setKeywordActions(prev => {
          const newState = { ...prev }
          delete newState[keyword.id]
          return newState
        })
        setKeywordCategories(prev => {
          const newState = { ...prev }
          delete newState[keyword.id]
          return newState
        })
        setKeywordExistingIds(prev => {
          const newState = { ...prev }
          delete newState[keyword.id]
          return newState
        })


      } else {
        showToast(result.error || 'Ошибка назначения', 'error')
      }
    } catch (error) {
      showToast('Произошла ошибка при назначении', 'error')
    } finally {
      setAssigningKeywords(prev => {
        const newSet = new Set(prev)
        newSet.delete(keyword.id)
        return newSet
      })
    }
  }

  const handleDeleteKeyword = (keyword: UnrecognizedKeyword) => {
    setDeleteConfirm({ isOpen: true, keyword })
  }

  const confirmDeleteKeyword = async () => {
    if (!deleteConfirm.keyword) return

    try {
      const result = await deleteUnrecognizedKeyword(deleteConfirm.keyword.id)
      if (result.success) {
        showToast('Ключевое слово удалено', 'success')
        setKeywords(prev => prev.filter(k => k.id !== deleteConfirm.keyword!.id))
      } else {
        showToast(result.error || 'Ошибка удаления ключевого слова', 'error')
      }
    } catch (error) {
      showToast('Произошла ошибка при удалении', 'error')
    } finally {
      setDeleteConfirm({ isOpen: false, keyword: null })
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
          <div className="flex items-center space-x-3">
            {isVisible && (
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCreatePanel}
                  onChange={(e) => setShowCreatePanel(e.target.checked)}
                  className="w-4 h-4 rounded border-0 text-green-600 focus:ring-0 focus:ring-offset-0"
                />
                <span className="text-sm text-green-700">
                  ➕ Создать новое
                </span>
              </label>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleVisibility}
            >
              {isVisible ? 'Скрыть' : 'Показать'}
            </Button>
          </div>
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


                {/* Панель создания нового ключевого слова */}
                {showCreatePanel && (
                  <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-medium text-green-800">
                        ➕ Добавить новое ключевое слово
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                      <Input
                        value={newKeywordText}
                        onChange={(e) => setNewKeywordText(e.target.value)}
                        placeholder="Введите ключевое слово"
                        className="text-sm h-8"
                      />
                      <SearchableSelect
                        options={categoryOptions}
                        value={newKeywordCategoryId}
                        onChange={(value) => setNewKeywordCategoryId(value || '')}
                        placeholder="Выберите категорию"
                        size="sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-600 hover:text-green-700 h-8"
                        onClick={async () => {
                          if (!newKeywordText.trim()) {
                            showToast('Введите ключевое слово', 'error')
                            return
                          }
                          if (!newKeywordCategoryId) {
                            showToast('Выберите категорию', 'error')
                            return
                          }

                          setIsCreatingKeyword(true)
                          try {
                            const result = await assignCategoryToKeyword({
                              keyword: newKeywordText.trim(),
                              category_id: newKeywordCategoryId
                            })

                            if (result.success) {
                              showToast(`Ключевое слово "${newKeywordText.trim()}" создано`, 'success')
                              setNewKeywordText('')
                              setNewKeywordCategoryId('')
                            } else {
                              showToast(result.error || 'Ошибка создания ключевого слова', 'error')
                            }
                          } catch (error) {
                            showToast('Произошла ошибка при создании', 'error')
                          } finally {
                            setIsCreatingKeyword(false)
                          }
                        }}
                        disabled={!newKeywordText.trim() || !newKeywordCategoryId || isCreatingKeyword}
                      >
                        {isCreatingKeyword ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                            <span>Создание...</span>
                          </div>
                        ) : (
                          'Создать ключевое слово'
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                <p className="text-sm text-gray-600 mb-4">
                  Назначьте категории этим ключевым словам для улучшения автоматической категоризации расходов.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left p-2 w-48">Ключевое слово</th>
                        <th className="text-left p-2 w-20">Частота</th>
                        <th className="text-left p-2 w-80">Создать как новое слово</th>
                        <th className="text-left p-2 w-80">Создать как синоним</th>
                        <th className="text-left p-2 w-32">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-8">
                              <input
                                type="checkbox"
                                checked={displayedKeywords.length > 0 && displayedKeywords.every(k => selectedKeywords.has(k.id))}
                                onChange={handleSelectAll}
                                className="w-4 h-4 rounded border-0 text-blue-600 focus:ring-0 focus:ring-offset-0"
                                title="Выбрать все"
                              />
                            </div>
                            <span>Действия</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedKeywords.map((keyword) => (
                        <tr
                          key={keyword.id}
                          className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedKeywords.has(keyword.id) ? 'bg-blue-50 border-blue-200' : ''
                            }`}
                        >
                          <td className="p-2 cursor-text align-top min-h-[60px]">
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
                                  className="text-sm h-10"
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
                          <td className="p-2 text-sm text-gray-600 align-top min-h-[60px]">
                            {keyword.frequency}
                          </td>
                          <td className="p-2 align-top min-h-[60px]">
                            <div className="space-y-2 h-full flex flex-col justify-start">
                              <label className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  name={`action-${keyword.id}`}
                                  checked={getKeywordAction(keyword.id) === 'new'}
                                  onChange={() => setKeywordAction(keyword.id, 'new')}
                                  className="text-blue-600"
                                />
                                <span className="text-xs">Как новое слово</span>
                              </label>
                              {getKeywordAction(keyword.id) === 'new' && (
                                <div className="space-y-1">
                                  <div className="h-10">
                                    <SearchableSelect
                                      options={categoryOptions}
                                      value={getKeywordCategory(keyword.id)}
                                      onChange={(value) => setKeywordCategory(keyword.id, value || '')}
                                      placeholder="Выберите категорию"
                                      size="sm"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-2 align-top min-h-[60px]">
                            <div className="space-y-2 h-full flex flex-col justify-start">
                              <label className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  name={`action-${keyword.id}`}
                                  checked={getKeywordAction(keyword.id) === 'synonym'}
                                  onChange={() => setKeywordAction(keyword.id, 'synonym')}
                                  className="text-blue-600"
                                />
                                <span className="text-xs">Как синоним</span>
                              </label>
                              {getKeywordAction(keyword.id) === 'synonym' && (
                                <div className="space-y-1">
                                  <div className="h-10">
                                    <SearchableSelect
                                      options={existingKeywords.map(kw => {
                                        const iconEmoji = availableIcons.find(i => i.key === kw.categories?.icon)?.emoji || '📦'
                                        return {
                                          value: kw.id,
                                          label: `${kw.keyword} (${kw.categories?.name || 'Без категории'})`,
                                          color: kw.categories?.color || '#6366f1',
                                          icon: <span className="mr-2 text-base">{iconEmoji}</span>
                                        }
                                      })}
                                      value={getKeywordExistingId(keyword.id)}
                                      onChange={(value) => setKeywordExistingId(keyword.id, value || '')}
                                      placeholder="Выберите ключевое слово"
                                      size="sm"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-2 align-top min-h-[60px]">
                            <div className="flex items-center w-full h-full">
                              <div className="flex items-center justify-center w-8">
                                <input
                                  type="checkbox"
                                  checked={selectedKeywords.has(keyword.id)}
                                  onChange={(e) => handleKeywordSelect(keyword.id, e.target.checked)}
                                  className="w-4 h-4 rounded border-0 text-blue-600 focus:ring-0 focus:ring-offset-0"
                                  title="Выбрать для массовых операций"
                                />
                              </div>
                              <div className="flex items-center justify-center w-8 mx-4">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAssignKeyword(keyword)}
                                  disabled={
                                    assigningKeywords.has(keyword.id) ||
                                    (getKeywordAction(keyword.id) === 'new' && !getKeywordCategory(keyword.id)) ||
                                    (getKeywordAction(keyword.id) === 'synonym' && !getKeywordExistingId(keyword.id))
                                  }
                                  className="w-8 h-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 disabled:text-gray-400 disabled:hover:bg-transparent"
                                  title="Подтвердить назначение"
                                >
                                  {assigningKeywords.has(keyword.id) ? (
                                    <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                                  ) : (
                                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </Button>
                              </div>
                              <div className="flex items-center justify-center w-8">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteKeyword(keyword)}
                                  className="w-8 h-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  title="Удалить ключевое слово"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </Button>
                              </div>
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

                {/* Панель массовых действий */}
                {selectedKeywords.size > 0 && (
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="mb-3">
                      <span className="text-sm font-medium text-blue-800">
                        Выбрано: {selectedKeywords.size} ключевых слов
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-blue-800">Создать как новые слова:</label>
                        <SearchableSelect
                          options={categoryOptions}
                          value={bulkNewCategoryId}
                          onChange={(categoryId) => setBulkNewCategoryId(categoryId || '')}
                          placeholder="Выберите категорию"
                          size="sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-blue-800">Добавить как синонимы:</label>
                        <SearchableSelect
                          options={existingKeywords.map(kw => {
                            const iconEmoji = availableIcons.find(i => i.key === kw.categories?.icon)?.emoji || '📦'
                            return {
                              value: kw.id,
                              label: `${kw.keyword} (${kw.categories?.name || 'Без категории'})`,
                              color: kw.categories?.color || '#6366f1',
                              icon: <span className="mr-2 text-base">{iconEmoji}</span>
                            }
                          })}
                          value={bulkSynonymKeywordId}
                          onChange={(keywordId) => setBulkSynonymKeywordId(keywordId || '')}
                          placeholder="Выберите ключевое слово"
                          size="sm"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (bulkNewCategoryId) {
                            handleBulkAssign('new', bulkNewCategoryId)
                            setBulkNewCategoryId('')
                          } else {
                            showToast('Выберите категорию для создания новых слов', 'warning')
                          }
                        }}
                        disabled={!bulkNewCategoryId}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        Создать как новые
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (bulkSynonymKeywordId) {
                            handleBulkAssign('synonym', undefined, bulkSynonymKeywordId)
                            setBulkSynonymKeywordId('')
                          } else {
                            showToast('Выберите ключевое слово для синонимов', 'warning')
                          }
                        }}
                        disabled={!bulkSynonymKeywordId}
                        className="text-purple-600 hover:text-purple-700"
                      >
                        Добавить как синонимы
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkConfirm}
                        className="text-green-600 hover:text-green-700"
                      >
                        ✓ Подтвердить настройки
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkDelete}
                        className="text-red-600 hover:text-red-700"
                      >
                        ✕ Удалить выбранные
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}


      </div>

      <ConfirmationModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, keyword: null })}
        onConfirm={confirmDeleteKeyword}
        title="Удалить ключевое слово"
        message={`Вы уверены, что хотите удалить ключевое слово "${deleteConfirm.keyword?.keyword}"?`}
        confirmText="Удалить"
        cancelText="Отмена"
      />
    </Card>
  )
}