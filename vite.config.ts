import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'lifeagent.svg',
        'lifeagent-192.png',
        'lifeagent-512.png',
        'lifeagent-maskable-512.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: 'LifeAgent 生活记录',
        short_name: 'LifeAgent',
        description: '记录计划与真实发生的生活，本地优先。',
        theme_color: '#f4f1e8',
        background_color: '#f4f1e8',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'zh-CN',
        icons: [
          { src: '/lifeagent-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/lifeagent-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/lifeagent-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/lifeagent.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    restoreMocks: true,
  },
})
