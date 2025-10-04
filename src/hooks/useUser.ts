'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseUserReturn {
  userEmail: string | undefined
  isLoading: boolean
  error: string | null
}

export function useUser(): UseUserReturn {
  const [userEmail, setUserEmail] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    
    const fetchUser = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError) {
          setError(authError.message)
        } else {
          setUserEmail(user?.email)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки пользователя')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchUser()
  }, [])

  return { userEmail, isLoading, error }
}