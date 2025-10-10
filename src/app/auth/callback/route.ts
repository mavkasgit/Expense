import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createServerClient()

    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('OAuth code exchange error:', error?.message)
        return NextResponse.redirect(`${origin}/login?error=oauth-error`)
      }

      if (data.session) {
        return NextResponse.redirect(`${origin}${next}`)
      }
    } catch (err: any) {
      console.error('OAuth callback exception:', err?.message ?? err)
      return NextResponse.redirect(`${origin}/login?error=exchange-exception`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=no-code`)
}