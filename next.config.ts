import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Принудительно используем Node.js runtime для всех серверных компонентов
  serverExternalPackages: ['@supabase/supabase-js'],
  webpack: (config, { isServer }) => {
    // Это предотвращает ошибку "Critical dependency" от @supabase/realtime-js
    if (isServer) {
      config.externals.push('ws')
    }
    return config
  },
}

export default nextConfig