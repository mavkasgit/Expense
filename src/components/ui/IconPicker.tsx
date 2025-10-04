'use client'

import { useState, useEffect } from 'react'
import { Input, Button, Modal } from '@/components/ui'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { availableIcons } from '@/lib/utils/category-constants'
import { cn } from '@/lib/utils'

interface IconPickerProps {
    value: string
    onChange: (value: string) => void
    className?: string
}

export function IconPicker({ value, onChange, className }: IconPickerProps) {
    const [iconSearch, setIconSearch] = useState('')
    const [modalIconSearch, setModalIconSearch] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const selectedIconEmoji = availableIcons.find(i => i.key === value)?.emoji

    const filteredIcons = availableIcons.filter(icon =>
        icon.names.some(name => name.toLowerCase().includes(iconSearch.toLowerCase())) ||
        icon.emoji.includes(iconSearch)
    )

    const modalFilteredIcons = availableIcons.filter(icon =>
        icon.names.some(name => name.toLowerCase().includes(modalIconSearch.toLowerCase())) ||
        icon.emoji.includes(modalIconSearch)
    )

    // Показываем первые 21 иконку (3 ряда по 7) в попапе
    const visibleIcons = filteredIcons.slice(0, 21)
    const hasMoreIcons = filteredIcons.length > 21

    const handleIconSelect = (iconKey: string) => {
        onChange(iconKey)
        setIsOpen(false)
        setIsModalOpen(false)
        setIconSearch('')
        setModalIconSearch('')
    }

    const handleShowAll = () => {
        setIsOpen(false)
        setIsModalOpen(true)
        setModalIconSearch(iconSearch) // Переносим поиск в модальное окно
    }

    // Сброс состояния при закрытии
    useEffect(() => {
        if (!isOpen) {
            setIconSearch('')
        }
    }, [isOpen])

    useEffect(() => {
        if (!isModalOpen) {
            setModalIconSearch('')
        }
    }, [isModalOpen])

    return (
        <>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("flex items-center gap-2", className)}>
                        <span className="text-xl">{selectedIconEmoji}</span>
                        <span>Иконка</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-[320px] p-0"
                    side="bottom"
                    align="start"
                    sideOffset={8}
                    avoidCollisions={false}
                >
                    <div className="p-3 border-b">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Поиск иконки..."
                                value={iconSearch}
                                onChange={e => setIconSearch(e.target.value)}
                                autoComplete="new-password"
                                className="text-sm flex-1"
                            />
                            {hasMoreIcons && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleShowAll}
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 whitespace-nowrap"
                                >
                                    Все ({filteredIcons.length})
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="p-2 max-h-[200px] overflow-y-auto">
                        <div className="grid grid-cols-7 gap-1">
                            {visibleIcons.map(icon => (
                                <button
                                    key={icon.key}
                                    type="button"
                                    onClick={() => handleIconSelect(icon.key)}
                                    className={cn(
                                        "w-10 h-10 p-2 rounded-lg border-2 transition-all hover:bg-gray-50",
                                        value === icon.key
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200'
                                    )}
                                    title={icon.names[0]}
                                >
                                    {icon.emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    {filteredIcons.length === 0 && (
                        <div className="p-4 text-center text-gray-500 text-sm">
                            Иконки не найдены
                        </div>
                    )}
                </PopoverContent>
            </Popover>

            {/* Модальное окно со всеми иконками */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                size="lg"
            >
                <Input
                    placeholder="Поиск иконки..."
                    value={modalIconSearch}
                    onChange={e => setModalIconSearch(e.target.value)}
                    autoComplete="new-password"
                    className="mb-4"
                />

                <div className="max-h-[400px] overflow-y-auto border rounded-lg p-4">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '8px' }}>
                        {modalFilteredIcons.map(icon => (
                            <button
                                key={icon.key}
                                type="button"
                                onClick={() => handleIconSelect(icon.key)}
                                className={cn(
                                    "w-10 h-10 p-1 rounded-lg border-2 transition-all hover:bg-gray-50 flex items-center justify-center",
                                    value === icon.key
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200'
                                )}
                                title={icon.names[0]}
                            >
                                <span className="text-lg">{icon.emoji}</span>
                            </button>
                        ))}
                    </div>

                    {modalFilteredIcons.length === 0 && (
                        <div className="text-center text-gray-500 py-8">
                            Иконки не найдены
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-4 mt-4 border-t">
                    <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                        Отмена
                    </Button>
                </div>
            </Modal>
        </>
    )
}