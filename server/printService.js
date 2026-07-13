// printService.js
// Prints a label directly from the server when a webhook arrives — no browser tab
// involved. Uses whatever template/connection settings you last saved in the app.

import fs from 'node:fs'
import path from 'node:path'
import { printLabelHtml } from '../utils/qzPrint.js'
import { flattenObject, resolveWebhookValue } from '../utils/flatten.js'

export function createPrintService(dbDir) {
  const settingsFile = path.join(dbDir, 'settings.json')

  function readStore() {
    try {
      return JSON.parse(fs.readFileSync(settingsFile, 'utf-8'))
    } catch {
      return {}
    }
  }

  async function printFromWebhookPayload(payload) {
    const boardId = payload?.event?.boardId
    if (!boardId) {
      console.log('[auto-print] payload has no boardId, skipping')
      return
    }

    const store = readStore()
    const templateRaw = store[`label_template_${boardId}`]
    const connectionRaw = store.qz_connection_settings

    if (!templateRaw) {
      console.log('[auto-print] no saved label template for board', boardId, '- skipping')
      return
    }
    if (!connectionRaw) {
      console.log('[auto-print] no saved connection settings - skipping')
      return
    }

    const template = JSON.parse(templateRaw)
    const connectionSettings = JSON.parse(connectionRaw)

    if (!template.fields || template.fields.length === 0) {
      console.log('[auto-print] template has no fields, skipping')
      return
    }
    if (!connectionSettings.printerOverride) {
      console.log('[auto-print] no printer configured, skipping')
      return
    }

    const flat = flattenObject(payload)
    const values = {}
    template.fields.forEach((f) => {
      values[f.columnId] = resolveWebhookValue(flat, f.columnId) ?? ''
    })

    console.log('[auto-print] printing from server for board', boardId, 'values:', values)

    await printLabelHtml(
      connectionSettings.printerOverride,
      template,
      values,
      [],
      { connSettings: connectionSettings, copies: 1 }
    )

    console.log('[auto-print] print job sent successfully')
  }

  return { printFromWebhookPayload }
}
