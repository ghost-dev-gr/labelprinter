// handlers.js
// Shared HTTP handlers for the local settings API and monday.com webhook receivers.
// Used by both the Vite dev server (vite.config.js) and the production server (server.js),
// so dev and deployed behavior stay identical.

import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_ACTIVE_WEBHOOK_NAME = 'test2'

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function respondJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export function createHandlers(dbDir) {
  const settingsFile = path.join(dbDir, 'settings.json')
  const inboxFile = path.join(dbDir, 'webhook-inbox.json')

  function readStore() {
    try {
      return JSON.parse(fs.readFileSync(settingsFile, 'utf-8'))
    } catch {
      return {}
    }
  }

  function writeStore(store) {
    fs.mkdirSync(dbDir, { recursive: true })
    fs.writeFileSync(settingsFile, JSON.stringify(store, null, 2))
  }

  function getActiveWebhookName() {
    return readStore().active_webhook_name || DEFAULT_ACTIVE_WEBHOOK_NAME
  }

  async function storageHandler(req, res) {
    const url = new URL(req.url, 'http://localhost')

    if (req.method === 'GET') {
      const key = url.searchParams.get('key')
      const store = readStore()
      respondJson(res, 200, { value: store[key] ?? null })
      return
    }

    if (req.method === 'POST') {
      try {
        const { key, value } = JSON.parse(await readRequestBody(req))
        const store = readStore()
        store[key] = value
        writeStore(store)
        respondJson(res, 200, { success: true })
      } catch (err) {
        respondJson(res, 400, { error: String(err) })
      }
      return
    }

    res.statusCode = 405
    res.end()
  }

  // Handles ANY /webhook/<name> path — no auth. Every path echoes back what it received
  // (and answers monday.com's { challenge } verification handshake), but only the path
  // matching the configured "active" name (see active_webhook_name in settings, editable
  // from the Label Designer's "From Last Webhook" card) gets saved as the data source for
  // the Label Designer field picker and App.jsx's auto-print polling.
  async function webhookHandler(req, res) {
    const url = new URL(req.url, 'http://localhost')
    const name = url.pathname.replace(/^\/webhook\//, '').replace(/\/$/, '') || 'test'

    const raw = await readRequestBody(req)
    let parsed = raw
    try {
      parsed = raw ? JSON.parse(raw) : {}
    } catch {
      // not JSON, leave as raw string
    }

    // monday.com verifies a new webhook URL by POSTing { challenge } once and expects
    // that exact value echoed straight back before it will start sending real events.
    if (parsed && typeof parsed === 'object' && parsed.challenge) {
      console.log(`[webhook:${name}] verification challenge received:`, parsed.challenge)
      respondJson(res, 200, { challenge: parsed.challenge })
      return
    }

    console.log(`[webhook:${name}] received payload:`, JSON.stringify(parsed))

    const isActiveSource = name === getActiveWebhookName()
    if (isActiveSource) {
      fs.mkdirSync(dbDir, { recursive: true })
      fs.writeFileSync(
        inboxFile,
        JSON.stringify({ receivedAt: new Date().toISOString(), payload: parsed }, null, 2)
      )
      console.log(`[webhook:${name}] is the active data source — saved to ${inboxFile}`)
    }

    respondJson(res, 200, { received: true, webhook: name, isActiveSource, body: parsed })
  }

  // Lets the frontend read back the most recent webhook payload (for the Label Designer's
  // "import fields from last webhook" picker and App.jsx's auto-print polling).
  function webhookInboxHandler(req, res) {
    try {
      const raw = fs.readFileSync(inboxFile, 'utf-8')
      respondJson(res, 200, JSON.parse(raw))
    } catch {
      respondJson(res, 200, { receivedAt: null, payload: null })
    }
  }

  return { storageHandler, webhookHandler, webhookInboxHandler }
}
