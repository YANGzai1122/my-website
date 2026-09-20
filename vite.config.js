import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const isPages = mode === 'pages'

  return {
    base: isPages ? '/my-website/' : '/',
    define: {
      __STATIC_HOSTING__: JSON.stringify(isPages),
    },
    plugins: [react()],
    build: isPages ? { outDir: 'docs' } : undefined,
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': 'http://127.0.0.1:8787',
      },
    },
  }
})
