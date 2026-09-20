import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@engine': new URL('./src/engine', import.meta.url).pathname,
      '@schema': new URL('./src/types', import.meta.url).pathname,
      '@content': new URL('./content', import.meta.url).pathname,
    },
  },
  server: { port: 5173, host: '127.0.0.1' },
  build: { target: 'es2022', assetsInlineLimit: 0 },
})
