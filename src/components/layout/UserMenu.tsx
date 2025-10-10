'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut } from '@/lib/actions/auth'
import { SettingsModal } from './SettingsModal'
import { SignOutButton } from './SignOutButton'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

interface UserMenuProps {
  userEmail: string
}

export function UserMenu({ userEmail }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const [isSigningOut, setIsSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSignOut = async () => {
    setError(null)
    setIsSigningOut(true)

    try {
      const result = await signOut()
      
      if (result?.error) {
        setError(result.error)
        setIsSigningOut(false)
        return
      }

      // Успешный выход - перенаправляем на страницу логина
      window.location.href = '/login'
    } catch (err) {
      console.error('Sign out error:', err)
      setError('Произошла ошибка при выходе из системы')
      setIsSigningOut(false)
    }
  }

  return (
    <>
      {isSigningOut && <LoadingOverlay text="Выходим из системы..." />}

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-3 text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded-lg px-3 py-2 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {userEmail.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-medium text-gray-900">
                {userEmail.split('@')[0]}
              </div>
              <div className="text-xs text-gray-500">
                {userEmail}
              </div>
            </div>
          </div>
          <svg 
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div className={`
          absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50
          transition-all duration-200 origin-top-right
          ${isOpen 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
          }
        `}>
          <div className="py-2">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-medium">
                    {userEmail.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {userEmail.split('@')[0]}
                  </div>
                  <div className="text-xs text-gray-500">
                    {userEmail}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2">
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                <span>Настройки</span>
              </button>
              
              <a
                href="/backup"
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                <span>Резервное копирование</span>
              </a>
            </div>

            <div className="p-2 border-t border-gray-100">
              <SignOutButton onClick={handleSignOut} disabled={isSigningOut} />
            </div>

            {error && (
              <div className="mx-4 mt-2 mb-1 bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-md text-xs">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />
    </>
  )
}
