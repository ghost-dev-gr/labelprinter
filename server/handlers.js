// handlers.js
// Shared HTTP handlers for the local settings API and monday.com webhook receivers.
// Used by both the Vite dev server (vite.config.js) and the production server (server.js),
// so dev and deployed behavior stay identical.

import fs from 'node:fs'
import path from 'node:path'
import './qzClient.js'
import { listPrinters } from '../utils/qzPrint.js'
import { createPrintService } from './printService.js'

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
  const printService = createPrintService(dbDir)

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

  // Webhooks only carry a group's internal id (e.g. "topics"), never its display title.
  // Look the title up via monday's GraphQL API using the API token saved from the Label
  // Designer's "From Last Webhook" card.
  async function fetchGroupTitle(boardId, groupId, token) {
    try {
      const res = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
        },
        body: JSON.stringify({
          query: `query { boards(ids: ${Number(boardId)}) { groups { id title } } }`,
        }),
      })
      const json = await res.json()
      if (json.errors) {
        console.error('[monday-api] GraphQL error fetching group title:', json.errors)
        return null
      }
      const groups = json?.data?.boards?.[0]?.groups || []
      const match = groups.find((g) => g.id === groupId)
      return match ? match.title : null
    } catch (err) {
      console.error('[monday-api] Failed to fetch group title:', err)
      return null
    }
  }

  async function enrichPayload(parsed) {
    const event = parsed && typeof parsed === 'object' ? parsed.event : null
    if (!event || !event.boardId || !event.groupId) return parsed

    const token = readStore().monday_api_token
    if (!token) return parsed

    const groupTitle = await fetchGroupTitle(event.boardId, event.groupId, token)
    if (!groupTitle) return parsed

    console.log(`[monday-api] resolved groupId "${event.groupId}" -> title "${groupTitle}"`)
    return { ...parsed, event: { ...event, groupTitle } }
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
    // In production (server.js) req.url still has the full "/webhook/<name>" path. Under
    // `npm run dev`, Vite's middleware mounting strips the "/webhook" prefix before calling
    // this handler, leaving just "/<name>" — handle both so dev and prod behave identically.
    const name = url.pathname.replace(/^\/webhook\//, '').replace(/^\//, '').replace(/\/$/, '') || 'test'

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
      const enriched = await enrichPayload(parsed)
      fs.mkdirSync(dbDir, { recursive: true })
      fs.writeFileSync(
        inboxFile,
        JSON.stringify({ receivedAt: new Date().toISOString(), payload: enriched }, null, 2)
      )
      console.log(`[webhook:${name}] is the active data source — saved to ${inboxFile}`)

      // Fire-and-forget: don't make monday.com's webhook wait on the print job.
      printService.printFromWebhookPayload(enriched).catch((err) => {
        console.error('[auto-print] failed:', err)
      })
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

  // Proves the SERVER (not the browser) can connect to QZ Tray on its own — connects using
  // the same saved connection settings the browser uses, and lists printers. No browser tab
  // involved in this call at all.
  async function qzTestHandler(req, res) {
    const connectionRaw = readStore().qz_connection_settings
    if (!connectionRaw) {
      respondJson(res, 400, { success: false, error: 'No connection settings saved yet — configure a printer in the Connection tab first.' })
      return
    }

    let connectionSettings
    try {
      connectionSettings = JSON.parse(connectionRaw)
    } catch (err) {
      respondJson(res, 400, { success: false, error: 'Saved connection settings are corrupt: ' + err.message })
      return
    }

    try {
      console.log('[qz-test] Connecting to QZ Tray from the server...')
      const printers = await listPrinters(connectionSettings)
      console.log('[qz-test] Connected successfully. Printers:', printers)
      respondJson(res, 200, { success: true, printers })
    } catch (err) {
      console.error('[qz-test] Failed to connect from server:', err)
      respondJson(res, 500, { success: false, error: err.message || String(err) })
    }
  }

  return { storageHandler, webhookHandler, webhookInboxHandler, qzTestHandler }
}
