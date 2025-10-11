'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { updateExpense } from '@/lib/actions/expenses'
import { useToast } from '@/hooks/useToast'
import type { ExpenseWithCategory } from '@/types'

interface InlineNotesEditorProps {
  expense: ExpenseWithCategory
  onUpdate: (updatedExpense: ExpenseWithCategory) => void
}

export function InlineNotesEditor({ expense, onUpdate }: InlineNotesEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [notes, setNotes] = useState(expense.notes || '')
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  // Фокус на поле при начале редактирования
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Начать редактирование
  const startEditing = () => {
    setNotes(expense.notes || '')
    setIsEditing(true)
  }

  // Отменить редактирование
  const cancelEditing = () => {
    setNotes(expense.notes || '')
    setIsEditing(false)
  }

  // Сохранить изменения
  const saveNotes = () => {
    if (notes === (expense.notes || '')) {
      setIsEditing(false)
      return
    }

    if (notes.length > 1000) {
      showToast('Примечание не должно превышать 1000 символов', 'error')
      return
    }

    startTransition(async () => {
      try {
        const result = await updateExpense(expense.id, {
          notes: notes || undefined
        })

        if ('error' in result) {
          showToast(result.error || 'Произошла ошибка', 'error')
          return
        }

        onUpdate(result.data)
        setIsEditing(false)
        showToast('Примечание обновлено', 'success')
      } catch (error) {
        console.error('Ошибка обновления примечания:', error)
        showToast('Произошла ошибка при обновлении', 'error')
      }
    })
  }

  // Обработка клавиш
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveNotes()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditing()
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <input
          ref={inputRef}
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={handleKeyPress}
          onBlur={saveNotes}
          placeholder="Добавить примечание..."
          maxLength={1000}
          disabled={isPending}
          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 min-w-0"
        />
        {isPending && (
          <div className="text-xs text-gray-500">Сохранение...</div>
        )}
      </div>
    )
  }

  return (
    <div 
      onClick={startEditing}
      className="flex-1 min-w-0 cursor-text hover:bg-gray-50 px-2 py-1 rounded transition-colors"
      title="Нажмите для редактирования примечания"
    >
      {expense.notes ? (
        <span className="text-sm text-gray-600 italic truncate block">
          {expense.notes}
        </span>
      ) : (
        <span className="text-sm text-gray-400 italic">
          Добавить примечание...
        </span>
      )}
    </div>
  )
}