// server.js
// Production server: serves the built React app (dist/) plus the settings API and
// monday.com webhook receivers. This is what Coolify runs — the app's public URL
// (whatever domain Coolify assigns) is the base for the webhook endpoints below:
//   https://<your-coolify-domain>/webhook/test
//   https://<your-coolify-domain>/webhook/test2

import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createHandlers } from './server/handlers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 5175

const dbDir = path.resolve(__dirname, 'db')
const distDir = path.resolve(__dirname, 'dist')
const { storageHandler, webhookTest, webhookTest2, webhookInboxHandler } = createHandlers(dbDir)

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

function serveStatic(req, res) {
  const urlPath = req.url.split('?')[0]
  const filePath = path.join(distDir, urlPath === '/' ? 'index.html' : urlPath)

  if (!filePath.startsWith(distDir)) {
    res.statusCode = 403
    res.end('Forbidden')
    return
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Not a known static asset — fall back to index.html for the client-side app.
      fs.readFile(path.join(distDir, 'index.html'), (err2, indexData) => {
        if (err2) {
          res.statusCode = 404
          res.end('Not found')
          return
        }
        res.setHeader('Content-Type', 'text/html')
        res.end(indexData)
      })
      return
    }

    res.setHeader('Content-Type', MIME_TYPES[path.extname(filePath)] || 'application/octet-stream')
    res.end(data)
  })
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0]

  if (urlPath === '/api/storage') return storageHandler(req, res)
  if (urlPath === '/api/webhook-inbox') return webhookInboxHandler(req, res)
  if (urlPath === '/webhook/test') return webhookTest(req, res)
  if (urlPath === '/webhook/test2') return webhookTest2(req, res)

  return serveStatic(req, res)
})

server.listen(PORT, () => {
  console.log(`monday-printer server listening on port ${PORT}`)
  console.log(`Webhook URLs (append your deployed domain):`)
  console.log(`  /webhook/test`)
  console.log(`  /webhook/test2`)
})
