/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // App shell + self-hosted fonts, so everything works offline.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/*.woff'],
        navigateFallback: '/index.html',
      },
      manifest: {
        id: '/',
        lang: 'en',
        dir: 'ltr',
        categories: ['food', 'lifestyle', 'productivity'],
        name: 'Fridge Follower',
        short_name: 'Fridge',
        description: 'Plan meals, track what is in the fridge, and build the shopping list. Works offline; data stays on your phone.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        // Reuse the open window instead of stacking a second copy (also what a TWA wants).
        launch_handler: { client_mode: 'navigate-existing' },
        shortcuts: [
          { name: 'Shopping list', short_name: 'Shop', url: '/shop', icons: [{ src: 'pwa-192.png', sizes: '192x192' }] },
          { name: 'Week plan', short_name: 'Plan', url: '/plan', icons: [{ src: 'pwa-192.png', sizes: '192x192' }] },
        ],
        background_color: '#0B0C1A',
        theme_color: '#0B0C1A',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
});
