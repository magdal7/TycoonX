import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'auto',
      workbox: {
        // Precache the app shell (code, icons, branding). Large optional artwork
        // under /assets/game/** (CEO portraits, illustrations) is NOT precached;
        // it is cached at runtime, bounded, so install stays small and updates
        // stay reliable.
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        globIgnores: ['**/assets/game/**'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'tycoonx-images',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      manifest: {
        name: 'TycoonX — Build Your Tech Empire',
        short_name: 'TycoonX',
        description:
          'A premium, mobile-first tech-tycoon PWA. Recruit collectible CEOs, run production cycles and climb the ranks.',
        theme_color: '#091916',
        background_color: '#091916',
        display: 'standalone',
        start_url: '/',
        orientation: 'portrait',
        categories: ['games', 'entertainment'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  },
  resolve: {
    dedupe: ['react', 'react-dom']
  }
})
