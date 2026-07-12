// LabelDesigner.jsx
// Drag-and-drop label designer with visual canvas, real-time sample data preview, and field controls
import React, { useRef, useState, useEffect } from 'react';
import { PrintTestBoard } from '@api/BoardSDK';
import { saveTemplate } from '@generated/utils/mondayData';
import { flattenObject, resolveWebhookValue } from '@generated/utils/flatten';
import {
  LayoutGrid,
  Sparkles,
  Webhook,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
} from 'lucide-react';

const PX_PER_MM = 4.2; // Visual scale for canvas

export default function LabelDesigner({ boardId, template, setTemplate }) {
  const dragState = useRef(null);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [allColumns, setAllColumns] = useState([]);
  const [sampleData, setSampleData] = useState({});
  const [webhookFields, setWebhookFields] = useState([]);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookError, setWebhookError] = useState('');
  const [webhookName, setWebhookName] = useState('test2');
  const [webhookNameSaving, setWebhookNameSaving] = useState(false);
  const [apiToken, setApiToken] = useState('');
  const [apiTokenSaving, setApiTokenSaving] = useState(false);

  // Load the configured "active" webhook name (which /webhook/<name> path feeds this picker)
  // and the monday.com API token used to resolve group titles from webhook group ids.
  useEffect(() => {
    async function loadWebhookName() {
      try {
        const res = await fetch('/api/storage?key=active_webhook_name');
        const json = await res.json();
        if (json.value) setWebhookName(json.value);
      } catch (err) {
        console.error('Failed to load active webhook name:', err);
      }
    }
    async function loadApiToken() {
      try {
        const res = await fetch('/api/storage?key=monday_api_token');
        const json = await res.json();
        if (json.value) setApiToken(json.value);
      } catch (err) {
        console.error('Failed to load monday API token:', err);
      }
    }
    loadWebhookName();
    loadApiToken();
  }, []);

  async function saveWebhookName() {
    const name = webhookName.trim() || 'test2';
    setWebhookName(name);
    setWebhookNameSaving(true);
    try {
      await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'active_webhook_name', value: name }),
      });
    } catch (err) {
      console.error('Failed to save active webhook name:', err);
    } finally {
      setWebhookNameSaving(false);
    }
  }

  async function saveApiToken() {
    setApiTokenSaving(true);
    try {
      await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'monday_api_token', value: apiToken.trim() }),
      });
    } catch (err) {
      console.error('Failed to save monday API token:', err);
    } finally {
      setApiTokenSaving(false);
    }
  }

  // Fetch all columns and sample data from the board
  useEffect(() => {
    async function fetchColumnsAndSample() {
      try {
        const board = new PrintTestBoard(boardId);
        const result = await board
          .items()
          .withColumns(['sku', 'price', 'totalPrice', 'quantity', 'printStatus', 'detectVibe'])
          .execute();

        // Build column list: name, group, and all board columns
        const columns = [
          { id: 'name', title: 'Item Name' },
          { id: 'group', title: 'Group Name' },
          { id: 'sku', title: 'SKU' },
          { id: 'price', title: 'PRICE' },
          { id: 'totalPrice', title: 'TOTAL PRICE' },
          { id: 'quantity', title: 'QUANTITY' },
          { id: 'printStatus', title: 'PRINT STATUS' },
          { id: 'detectVibe', title: 'Detect Vibe' }
        ];
        
        setAllColumns(columns);

        // Use first item as sample data
        if (result.items && result.items.length > 0) {
          const firstItem = result.items[0];
          setSampleData({
            name: firstItem.name || 'Sample Item',
            group: firstItem.group?.title || 'Group Title',
            sku: firstItem.sku || 'SKU-12345',
            price: firstItem.price || '$99.99',
            totalPrice: firstItem.totalPrice || '$99.99',
            quantity: firstItem.quantity || '1',
            printStatus: firstItem.printStatus || 'Not Printed',
            detectVibe: firstItem.detectVibe || ''
          });
        } else {
          // Fallback sample data
          setSampleData({
            name: 'Thermal Printer HPRT HT600',
            group: 'Group Title',
            sku: 'SKU-HPRT-600X',
            price: '$289.99',
            totalPrice: '$289.99',
            quantity: '2',
            printStatus: 'Not Printed',
            detectVibe: ''
          });
        }
      } catch (err) {
        console.error('Failed to fetch columns:', err);
        // Fallback columns
        setAllColumns([
          { id: 'name', title: 'Item Name' },
          { id: 'group', title: 'Group Name' },
          { id: 'sku', title: 'SKU' },
          { id: 'price', title: 'PRICE' }
        ]);
        setSampleData({
          name: 'Sample Item',
          group: 'Group Title',
          sku: 'SKU-123',
          price: '$99.99'
        });
      }
    }

    fetchColumnsAndSample();
  }, [boardId]);

  async function importWebhookFields() {
    setWebhookLoading(true);
    setWebhookError('');
    try {
      const res = await fetch('/api/webhook-inbox');
      const json = await res.json();

      if (!json.payload) {
        setWebhookError(`No webhook received yet. POST to /webhook/${webhookName} first.`);
        setWebhookFields([]);
        return;
      }

      const flat = flattenObject(json.payload);
      const fields = Object.entries(flat).map(([webhookPath, value]) => ({
        id: `webhook:${webhookPath}`,
        title: webhookPath,
        value: resolveWebhookValue(flat, webhookPath) ?? value,
      }));

      setWebhookFields(fields);

      // Make these selectable/labelable like any other field, and preview their real values.
      setAllColumns((prev) => [
        ...prev.filter((c) => !c.id.startsWith('webhook:')),
        ...fields.map((f) => ({ id: f.id, title: f.title })),
      ]);
      setSampleData((prev) => {
        const merged = { ...prev };
        fields.forEach((f) => { merged[f.id] = String(f.value ?? ''); });
        return merged;
      });
    } catch (err) {
      console.error('Failed to import webhook fields:', err);
      setWebhookError('Failed to load the last webhook payload.');
    } finally {
      setWebhookLoading(false);
    }
  }

  function updateField(fieldId, patch) {
    setTemplate((t) => ({
      ...t,
      fields: t.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f))
    }));
  }

  function onPointerDown(fieldId, e) {
    const field = template.fields.find((f) => f.id === fieldId);
    if (!field) return;
    setSelectedFieldId(fieldId);
    dragState.current = {
      fieldId,
      startX: e.clientX,
      startY: e.clientY,
      origX: field.x,
      origY: field.y,
      fieldWidth: field.width,
      fieldHeight: field.height
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  function onPointerMove(e) {
    const d = dragState.current;
    if (!d) return;

    // The canvas itself is visually rotated (template.rotation), so a screen-space mouse
    // delta has to be rotated back into the canvas's local (unrotated) coordinate space —
    // otherwise dragging feels like it's moving in the wrong direction once rotated.
    const dxScreen = e.clientX - d.startX;
    const dyScreen = e.clientY - d.startY;
    const theta = ((template.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const dxMm = (dxScreen * cos + dyScreen * sin) / PX_PER_MM;
    const dyMm = (-dxScreen * sin + dyScreen * cos) / PX_PER_MM;

    // Clamp against the field's actual size, not a fixed margin — otherwise a tall/wide
    // field can be dragged mostly (or entirely) outside the label with no way back.
    const maxX = Math.max(0, template.widthMm - d.fieldWidth);
    const maxY = Math.max(0, template.heightMm - d.fieldHeight);
    const newX = Math.max(0, Math.min(maxX, Math.round(d.origX + dxMm)));
    const newY = Math.max(0, Math.min(maxY, Math.round(d.origY + dyMm)));

    updateField(d.fieldId, { x: newX, y: newY });
  }

  function onPointerUp() {
    dragState.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }

  function addField(columnId) {
    const existingField = template.fields.find(f => f.columnId === columnId);
    if (existingField) {
      setSelectedFieldId(existingField.id);
      return;
    }

    const newId = 'f-' + Date.now();
    setTemplate((t) => ({
      ...t,
      fields: [
        ...t.fields,
        {
          id: newId,
          columnId,
          x: 5,
          y: 5 + (t.fields.length * 8),
          width: 50,
          height: 8,
          fontSize: 3.5,
          align: 'left',
          bold: columnId === 'name' || columnId === 'price',
          showLabel: columnId !== 'name'
        }
      ]
    }));
    setSelectedFieldId(newId);
  }

  function alignField(fieldId, position) {
    const f = template.fields.find((field) => field.id === fieldId);
    if (!f) return;

    const patch = {};
    switch (position) {
      case 'left':
        patch.x = 0;
        break;
      case 'center-h':
        patch.x = Math.max(0, Math.round((template.widthMm - f.width) / 2));
        break;
      case 'right':
        patch.x = Math.max(0, Math.round(template.widthMm - f.width));
        break;
      case 'top':
        patch.y = 0;
        break;
      case 'center-v':
        patch.y = Math.max(0, Math.round((template.heightMm - f.height) / 2));
        break;
      case 'bottom':
        patch.y = Math.max(0, Math.round(template.heightMm - f.height));
        break;
      default:
        return;
    }
    updateField(fieldId, patch);
  }

  function removeField(fieldId) {
    setTemplate((t) => ({ ...t, fields: t.fields.filter((f) => f.id !== fieldId) }));
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  }

  function columnTitle(columnId) {
    return allColumns.find((c) => c.id === columnId)?.title || columnId;
  }

  async function handleSaveTemplate() {
    setSaving(true);
    try {
      await saveTemplate(boardId, template);
      alert('Template saved successfully!');
    } catch (err) {
      console.error('Failed to save template:', err);
      alert('Failed to save template: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Configuration Column */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-card rounded-xl border border-border p-5 space-y-5 shadow-sm">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-primary" />
              Label Dimensions
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Set physical label width and height in millimeters</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="width" className="text-xs font-medium text-muted-foreground">Width (mm)</label>
              <input
                id="width"
                type="number"
                min="20"
                max="150"
                value={template.widthMm}
                onChange={(e) => setTemplate((t) => ({ ...t, widthMm: Number(e.target.value) }))}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="height" className="text-xs font-medium text-muted-foreground">Height (mm)</label>
              <input
                id="height"
                type="number"
                min="10"
                max="150"
                value={template.heightMm}
                onChange={(e) => setTemplate((t) => ({ ...t, heightMm: Number(e.target.value) }))}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="rotation" className="text-xs font-medium text-muted-foreground">Physical Print Rotation</label>
            <p className="text-[10px] text-muted-foreground">Rotates the entire label (including text) on the printer, exactly as previewed below.</p>
            <select
              id="rotation"
              value={template.rotation || 0}
              onChange={(e) => setTemplate((t) => ({ ...t, rotation: Number(e.target.value) }))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="0">0° (No rotation)</option>
              <option value="90">90° (Rotate label right)</option>
              <option value="180">180° (Rotate label upside down)</option>
              <option value="270">270° (Rotate label left)</option>
            </select>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 space-y-4 shadow-sm">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Available Fields
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Click to add a field to your label</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {allColumns.map((c) => {
              const isUsed = template.fields.some(f => f.columnId === c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => addField(c.id)}
                  className={`h-8 px-3 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-all ${
                    isUsed 
                      ? 'border-primary/30 bg-primary/5 text-primary' 
                      : 'border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  <span>+</span>
                  {c.title}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Webhook className="w-4 h-4 text-primary" />
                From Last Webhook
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Pull fields from the most recent webhook payload</p>
            </div>
            <button
              onClick={importWebhookFields}
              disabled={webhookLoading}
              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all disabled:opacity-50 flex-shrink-0"
            >
              {webhookLoading ? 'Loading...' : 'Import'}
            </button>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="webhook-name" className="text-[11px] font-medium text-muted-foreground">
              Data source webhook path
            </label>
            <div className="flex gap-2">
              <div className="flex items-center h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs text-foreground">
                <span className="text-muted-foreground mr-0.5 select-none">/webhook/</span>
                <input
                  id="webhook-name"
                  type="text"
                  value={webhookName}
                  onChange={(e) => setWebhookName(e.target.value)}
                  onBlur={saveWebhookName}
                  className="flex-1 bg-transparent focus:outline-none"
                  placeholder="test2"
                />
              </div>
              <button
                onClick={saveWebhookName}
                disabled={webhookNameSaving}
                className="h-8 px-3 rounded-md border border-border bg-background text-xs text-foreground hover:bg-secondary transition-all disabled:opacity-50 flex-shrink-0"
              >
                {webhookNameSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Only webhooks POSTed to this exact path feed the picker below and auto-print. Other paths still echo back but are ignored.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="monday-api-token" className="text-[11px] font-medium text-muted-foreground">
              monday.com API token (resolves group names)
            </label>
            <div className="flex gap-2">
              <input
                id="monday-api-token"
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                onBlur={saveApiToken}
                className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none"
                placeholder="Paste your monday.com API token"
              />
              <button
                onClick={saveApiToken}
                disabled={apiTokenSaving}
                className="h-8 px-3 rounded-md border border-border bg-background text-xs text-foreground hover:bg-secondary transition-all disabled:opacity-50 flex-shrink-0"
              >
                {apiTokenSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Webhooks only include a group's internal id. With a token saved, incoming webhooks
              get their real group name resolved automatically as <code className="font-mono">event.groupTitle</code>.
            </p>
          </div>

          {webhookError && (
            <p className="text-[11px] text-destructive">{webhookError}</p>
          )}

          {webhookFields.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {webhookFields.map((f) => {
                const isUsed = template.fields.some(field => field.columnId === f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => addField(f.id)}
                    title={String(f.value)}
                    className={`h-8 px-3 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-all ${
                      isUsed
                        ? 'border-primary/30 bg-primary/5 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  >
                    <span>+</span>
                    {f.title}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Designer Canvas Column */}
      <div className="lg:col-span-8 space-y-6">
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Label Canvas</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Drag fields to position them
                {template.rotation > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary text-[11px] font-medium rounded">
                    Print rotation: {template.rotation}° (whole label rotates together, exactly as shown)
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleSaveTemplate}
              disabled={saving}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>

          {/* Label Canvas */}
          <div className="flex justify-center items-center p-8 bg-secondary/30 rounded-lg border border-dashed border-border overflow-auto min-h-[400px]">
            <div
              className="relative border border-foreground/30 bg-white shadow-lg rounded-[1px]"
              style={{
                width: template.widthMm * PX_PER_MM,
                height: template.heightMm * PX_PER_MM,
                backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1.5px)',
                backgroundSize: '8px 8px',
                transform: `rotate(${template.rotation || 0}deg)`,
                transformOrigin: 'center center',
                transition: 'transform 0.3s ease'
              }}
            >
              {template.fields.map((f) => {
                const isSelected = selectedFieldId === f.id;
                const displayVal = sampleData[f.columnId] || `[${columnTitle(f.columnId)}]`;
                return (
                  <div
                    key={f.id}
                    onPointerDown={(e) => onPointerDown(f.id, e)}
                    className={`absolute select-none text-black transition-all cursor-move ${
                      f.wrap ? 'overflow-visible' : 'overflow-hidden'
                    } ${
                      isSelected
                        ? 'outline-2 outline-dashed outline-primary outline-offset-1 bg-primary/5'
                        : 'hover:outline-1 hover:outline-dashed hover:outline-primary/50'
                    }`}
                    style={{
                      left: f.x * PX_PER_MM,
                      top: f.y * PX_PER_MM,
                      width: f.width * PX_PER_MM,
                      height: f.wrap ? 'auto' : f.height * PX_PER_MM,
                      minHeight: f.height * PX_PER_MM,
                      fontSize: f.fontSize * PX_PER_MM,
                      fontWeight: f.bold ? 'bold' : 'normal',
                      textAlign: f.align || 'left',
                      lineHeight: 1.2,
                      display: 'flex',
                      alignItems: f.wrap ? 'flex-start' : 'center',
                      justifyContent: f.align === 'center' ? 'center' : f.align === 'right' ? 'flex-end' : 'flex-start',
                      transform: f.rotation ? `rotate(${f.rotation}deg)` : undefined,
                      transformOrigin: 'center center'
                    }}
                  >
                    {f.showLabel && (
                      <span className="opacity-40 text-[75%] font-normal mr-1 select-none">
                        {columnTitle(f.columnId)}:
                      </span>
                    )}
                    <span className={f.wrap ? 'whitespace-normal break-words' : 'truncate'}>{displayVal}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Field Properties */}
          {selectedFieldId && (
            <div className="border-t border-border pt-4 animate-in fade-in-50">
              {(() => {
                const f = template.fields.find(field => field.id === selectedFieldId);
                if (!f) return null;
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                        Edit Field: {columnTitle(f.columnId)}
                      </h4>
                      <button
                        onClick={() => removeField(f.id)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Remove Field
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-muted/40 p-4 rounded-lg border border-border">
                      <div className="space-y-1.5">
                        <label htmlFor={`field-font-size-${f.id}`} className="text-[11px] font-medium text-muted-foreground">Font Size (mm)</label>
                        <input
                          id={`field-font-size-${f.id}`}
                          type="number"
                          step="0.5"
                          min="1"
                          max="20"
                          value={f.fontSize}
                          onChange={(e) => updateField(f.id, { fontSize: Number(e.target.value) })}
                          className="h-8 w-full rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none"
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <label htmlFor={`field-width-${f.id}`} className="text-[11px] font-medium text-muted-foreground">Width (mm)</label>
                        <input
                          id={`field-width-${f.id}`}
                          type="number"
                          min="5"
                          value={f.width}
                          onChange={(e) => updateField(f.id, { width: Number(e.target.value) })}
                          className="h-8 w-full rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor={`field-height-${f.id}`} className="text-[11px] font-medium text-muted-foreground">Height (mm)</label>
                        <input
                          id={`field-height-${f.id}`}
                          type="number"
                          min="3"
                          value={f.height}
                          onChange={(e) => updateField(f.id, { height: Number(e.target.value) })}
                          className="h-8 w-full rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor={`field-align-${f.id}`} className="text-[11px] font-medium text-muted-foreground">Alignment</label>
                        <select
                          id={`field-align-${f.id}`}
                          value={f.align || 'left'}
                          onChange={(e) => updateField(f.id, { align: e.target.value })}
                          className="h-8 w-full rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none"
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor={`field-rotation-${f.id}`} className="text-[11px] font-medium text-muted-foreground">Text Rotation</label>
                        <select
                          id={`field-rotation-${f.id}`}
                          value={f.rotation || 0}
                          onChange={(e) => updateField(f.id, { rotation: Number(e.target.value) })}
                          className="h-8 w-full rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none"
                        >
                          <option value="0">0°</option>
                          <option value="90">90°</option>
                          <option value="180">180°</option>
                          <option value="270">270°</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-6 pt-5">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-muted-foreground select-none">
                          <input
                            type="checkbox"
                            checked={f.bold || false}
                            onChange={(e) => updateField(f.id, { bold: e.target.checked })}
                            className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
                          />
                          Bold
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-muted-foreground select-none">
                          <input
                            type="checkbox"
                            checked={f.showLabel || false}
                            onChange={(e) => updateField(f.id, { showLabel: e.target.checked })}
                            className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
                          />
                          Show Label
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-muted-foreground select-none">
                          <input
                            type="checkbox"
                            checked={f.wrap || false}
                            onChange={(e) => updateField(f.id, { wrap: e.target.checked })}
                            className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
                          />
                          Wrap Text
                        </label>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-muted-foreground">Position</label>
                      <div className="flex items-center gap-1.5 bg-muted/40 p-2 rounded-lg border border-border w-fit">
                        <button
                          type="button"
                          title="Align left"
                          onClick={() => alignField(f.id, 'left')}
                          className="h-8 w-8 flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                        >
                          <AlignHorizontalJustifyStart className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Center horizontally"
                          onClick={() => alignField(f.id, 'center-h')}
                          className="h-8 w-8 flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                        >
                          <AlignHorizontalJustifyCenter className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Align right"
                          onClick={() => alignField(f.id, 'right')}
                          className="h-8 w-8 flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                        >
                          <AlignHorizontalJustifyEnd className="w-4 h-4" />
                        </button>
                        <div className="w-px h-6 bg-border mx-1" />
                        <button
                          type="button"
                          title="Align top"
                          onClick={() => alignField(f.id, 'top')}
                          className="h-8 w-8 flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                        >
                          <AlignVerticalJustifyStart className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Center vertically"
                          onClick={() => alignField(f.id, 'center-v')}
                          className="h-8 w-8 flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                        >
                          <AlignVerticalJustifyCenter className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Align bottom"
                          onClick={() => alignField(f.id, 'bottom')}
                          className="h-8 w-8 flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                        >
                          <AlignVerticalJustifyEnd className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
