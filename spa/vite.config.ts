import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `envDir` is one level up, so load from repo root.
  const env = loadEnv(mode, path.resolve(__dirname, '../'), '')
  const port = (() => {
    // Don't read `PORT` here (that's typically the backend port).
    const raw = env.VITE_PORT || '5174'
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5174
  })()

  return {
    envDir: '../',
    base: '/',
    server: {
      port,
      strictPort: true,
    },
    preview: {
      port,
      strictPort: true,
    },
    plugins: [
      react({
        babel: {
          plugins: [['babel-plugin-react-compiler']],
        },
      }),
      VitePWA({
        registerType: 'prompt',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          navigateFallback: 'index.html',
          navigateFallbackAllowlist: [/^[^.]*$/],
        },
      }),
    ],
  }
})
