import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHandlers } from './server/handlers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Dev-only wiring for the same API/webhook routes server.js exposes in production
// (see server/handlers.js), so `npm run dev` behaves identically to the deployed app.
function localApiPlugin() {
  const dbDir = path.resolve(__dirname, 'db')
  const { storageHandler, webhookTest, webhookTest2 } = createHandlers(dbDir)

  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use('/api/storage', storageHandler)
      server.middlewares.use('/webhook/test', webhookTest)
      server.middlewares.use('/webhook/test2', webhookTest2)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localApiPlugin()],
  server: {
    port: 5175,
  },
  resolve: {
    alias: {
      '@api': path.resolve(__dirname, 'api'),
      '@generated/utils': path.resolve(__dirname, 'utils'),
      '@generated/components': path.resolve(__dirname, 'components'),
      '@components': path.resolve(__dirname, 'components'),
      'monday-sdk-js': path.resolve(__dirname, 'stubs/monday-sdk-stub.js'),
    },
  },
})
