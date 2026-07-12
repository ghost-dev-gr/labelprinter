// LabelDesigner.jsx
// Drag-and-drop label designer with visual canvas, real-time sample data preview, and field controls
import React, { useRef, useState, useEffect } from 'react';
import { PrintTestBoard } from '@api/BoardSDK';
import { saveTemplate } from '@generated/utils/mondayData';
import { getFieldFootprint, getPrintedDimensions, computeFieldPlacement, renderLabelToCanvas, generateLabelImageDataUrl, printImageDataUrl, printLabel } from '@generated/utils/qzPrint';
import { flattenObject, resolveWebhookValue } from '@generated/utils/flatten';
import {
  LayoutGrid,
  Sparkles,
  Webhook,
  Printer,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
} from 'lucide-react';

// CSS spec-defined physical conversion (1in = 96px, 1in = 25.4mm) — used only to convert
// on-screen mouse-drag deltas into mm. The canvas itself renders with native CSS "mm" units
// (not a hand-picked px scale) so it's true-to-life size and matches the print output exactly.
const MM_TO_PX = 96 / 25.4;

export default function LabelDesigner({ boardId, template, setTemplate, connectionSettings }) {
  const dragState = useRef(null);
  const rotatedDragState = useRef(null);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testPrinting, setTestPrinting] = useState(false);
  const [testPrintStatus, setTestPrintStatus] = useState('');
  const [allColumns, setAllColumns] = useState([]);
  const [sampleData, setSampleData] = useState({});
  const [webhookFields, setWebhookFields] = useState([]);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookError, setWebhookError] = useState('');
  const [webhookName, setWebhookName] = useState('test2');
  const [webhookNameSaving, setWebhookNameSaving] = useState(false);
  const [apiToken, setApiToken] = useState('');
  const [apiTokenSaving, setApiTokenSaving] = useState(false);
  const [showRealView, setShowRealView] = useState(false);
  const [printPreview, setPrintPreview] = useState(null);
  const previewCanvasRef = useRef(null);

  // Quick Print — bypasses the field/template/webhook system entirely: type text, pick a
  // size, print. Its own tiny one-field template, built fresh on every print.
  const [quickText, setQuickText] = useState('');
  const [quickWidth, setQuickWidth] = useState(60);
  const [quickHeight, setQuickHeight] = useState(30);
  const [quickFontSize, setQuickFontSize] = useState(6);
  const [quickRotation, setQuickRotation] = useState(0);
  const [quickBold, setQuickBold] = useState(false);
  const [quickWrap, setQuickWrap] = useState(true);
  const [quickPrinting, setQuickPrinting] = useState(false);
  const [quickStatus, setQuickStatus] = useState('');

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
    async function loadQuickPrintSettings() {
      try {
        const res = await fetch(`/api/storage?key=quick_print_${boardId}`);
        const json = await res.json();
        if (!json.value) return;
        const saved = JSON.parse(json.value);
        if (saved.text !== undefined) setQuickText(saved.text);
        if (saved.width !== undefined) setQuickWidth(saved.width);
        if (saved.height !== undefined) setQuickHeight(saved.height);
        if (saved.fontSize !== undefined) setQuickFontSize(saved.fontSize);
        if (saved.rotation !== undefined) setQuickRotation(saved.rotation);
        if (saved.bold !== undefined) setQuickBold(saved.bold);
        if (saved.wrap !== undefined) setQuickWrap(saved.wrap);
      } catch (err) {
        console.error('Failed to load quick print settings:', err);
      }
    }
    loadWebhookName();
    loadApiToken();
    loadQuickPrintSettings();
  }, [boardId]);

  async function saveQuickPrintSettings() {
    try {
      await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: `quick_print_${boardId}`,
          value: JSON.stringify({
            text: quickText,
            width: quickWidth,
            height: quickHeight,
            fontSize: quickFontSize,
            rotation: quickRotation,
            bold: quickBold,
            wrap: quickWrap
          })
        }),
      });
    } catch (err) {
      console.error('Failed to save quick print settings:', err);
    }
  }

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

  // "Real View" — drawn by renderLabelToCanvas, the exact same function printLabel calls to
  // generate the real print image, so it can never show something different from what
  // actually prints. Shown alongside (never instead of) the editable canvas below.
  useEffect(() => {
    if (!showRealView || !previewCanvasRef.current) return;
    renderLabelToCanvas(previewCanvasRef.current, template, sampleData, allColumns, 150);
  }, [showRealView, template, sampleData, allColumns]);

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

  // Only floors values to something renderable (non-negative, at least 1mm) — no upper
  // bound against the label's own dimensions. You can size/position a field beyond the
  // label freely; nothing here second-guesses it.
  function clampFieldGeometry(field) {
    const next = { ...field };
    next.width = Math.max(1, next.width);
    next.height = Math.max(1, next.height);
    next.x = Math.max(0, next.x);
    next.y = Math.max(0, next.y);
    return next;
  }

  function updateField(fieldId, patch) {
    setTemplate((t) => ({
      ...t,
      fields: t.fields.map((f) => {
        if (f.id !== fieldId) return f;
        const merged = { ...f, ...patch };
        const geometryChanged = ['x', 'y', 'width', 'height'].some((k) => k in patch);
        return geometryChanged ? clampFieldGeometry(merged) : merged;
      })
    }));
  }

  function onPointerDown(fieldId, e) {
    const field = template.fields.find((f) => f.id === fieldId);
    if (!field) return;
    setSelectedFieldId(fieldId);
    const { footprintWidth, footprintHeight } = getFieldFootprint(field);
    dragState.current = {
      fieldId,
      startX: e.clientX,
      startY: e.clientY,
      origX: field.x,
      origY: field.y,
      fieldWidth: footprintWidth,
      fieldHeight: footprintHeight
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  function onPointerMove(e) {
    const d = dragState.current;
    if (!d) return;

    // The canvas is always shown unrotated (see the Label Canvas div below) — rotation is
    // applied only at print time, the same way real label design tools (Zebra Designer,
    // NiceLabel, DYMO Connect, etc.) work — so drag math is plain screen-space, no rotation
    // compensation needed.
    const dxMm = (e.clientX - d.startX) / MM_TO_PX;
    const dyMm = (e.clientY - d.startY) / MM_TO_PX;

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

  // Dragging directly in the rotated "Real View" — lets you position a field exactly where
  // you want it in the FINAL PRINTED result, with no mental rotation math required. A
  // screen-space drag delta here is a page-space delta (the Real View isn't itself further
  // CSS-rotated), so it has to be rotated by -labelRotation to find how much the field's
  // local (pre-rotation) x/y should change — the exact inverse of computeFieldPlacement's
  // forward rotation.
  function onRotatedPointerDown(fieldId, e) {
    const field = template.fields.find((f) => f.id === fieldId);
    if (!field) return;
    setSelectedFieldId(fieldId);
    rotatedDragState.current = {
      fieldId,
      startX: e.clientX,
      startY: e.clientY,
      origX: field.x,
      origY: field.y
    };
    window.addEventListener('pointermove', onRotatedPointerMove);
    window.addEventListener('pointerup', onRotatedPointerUp);
  }

  function onRotatedPointerMove(e) {
    const d = rotatedDragState.current;
    if (!d) return;

    const pageDx = (e.clientX - d.startX) / MM_TO_PX;
    const pageDy = (e.clientY - d.startY) / MM_TO_PX;

    const theta = ((template.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const localDx = pageDx * cos + pageDy * sin;
    const localDy = -pageDx * sin + pageDy * cos;

    updateField(d.fieldId, {
      x: Math.round(d.origX + localDx),
      y: Math.round(d.origY + localDy)
    });
  }

  function onRotatedPointerUp() {
    rotatedDragState.current = null;
    window.removeEventListener('pointermove', onRotatedPointerMove);
    window.removeEventListener('pointerup', onRotatedPointerUp);
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

    const { footprintWidth, footprintHeight } = getFieldFootprint(f);

    const patch = {};
    switch (position) {
      case 'left':
        patch.x = 0;
        break;
      case 'center-h':
        patch.x = Math.max(0, Math.round((template.widthMm - footprintWidth) / 2));
        break;
      case 'right':
        patch.x = Math.max(0, Math.round(template.widthMm - footprintWidth));
        break;
      case 'top':
        patch.y = 0;
        break;
      case 'center-v':
        patch.y = Math.max(0, Math.round((template.heightMm - footprintHeight) / 2));
        break;
      case 'bottom':
        patch.y = Math.max(0, Math.round(template.heightMm - footprintHeight));
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

  // Builds a throwaway one-field template on the fly and prints it immediately — no
  // interaction with the saved label template, webhook data, or the field list at all.
  async function handleQuickPrint() {
    setQuickStatus('');

    if (!quickText.trim()) {
      setQuickStatus('Type some text first.');
      return;
    }
    if (!connectionSettings || !connectionSettings.printerOverride) {
      setQuickStatus('Configure a printer in the Connection tab first.');
      return;
    }

    setQuickPrinting(true);
    try {
      const margin = 2;
      const quickTemplate = {
        widthMm: quickWidth,
        heightMm: quickHeight,
        rotation: quickRotation,
        fields: [{
          id: 'quick-field',
          columnId: 'quickText',
          x: margin,
          y: margin,
          width: Math.max(1, quickWidth - margin * 2),
          height: Math.max(1, quickHeight - margin * 2),
          fontSize: quickFontSize,
          align: 'center',
          verticalAlign: 'middle',
          bold: quickBold,
          wrap: quickWrap,
          rotation: 0
        }]
      };

      await printLabel(
        connectionSettings.printerOverride,
        quickTemplate,
        { quickText },
        [],
        { connSettings: connectionSettings, copies: 1 }
      );

      setQuickStatus(`Sent to ${connectionSettings.printerOverride}.`);
    } catch (err) {
      console.error('Quick print failed:', err);
      setQuickStatus('Print failed: ' + err.message);
    } finally {
      setQuickPrinting(false);
    }
  }

  async function handleSaveTemplate() {
    setSaving(true);
    try {
      await saveTemplate(boardId, template);
      await saveQuickPrintSettings();
      alert('Template saved successfully!');
    } catch (err) {
      console.error('Failed to save template:', err);
      alert('Failed to save template: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Step 1: generate the exact PNG that would be sent to the printer (using the last
  // webhook's real data) and show it as a literal <img> — not a live canvas, not an
  // approximation. Step 2 (handleConfirmPrint) sends those exact same bytes, unchanged.
  async function handlePreviewPrint() {
    setTestPrintStatus('');
    setPrintPreview(null);

    if (!template.fields || template.fields.length === 0) {
      setTestPrintStatus('Add at least one field to the label first.');
      return;
    }

    setTestPrinting(true);
    try {
      const res = await fetch('/api/webhook-inbox');
      const inbox = await res.json();

      if (!inbox.payload) {
        setTestPrintStatus(`No webhook received yet — POST to /webhook/${webhookName} first.`);
        return;
      }

      const flat = flattenObject(inbox.payload);
      const values = {};
      template.fields.forEach((f) => {
        values[f.columnId] = resolveWebhookValue(flat, f.columnId) ?? '';
      });

      const dataUrl = generateLabelImageDataUrl(template, values, [], 300);
      setPrintPreview(dataUrl);
    } catch (err) {
      console.error('Failed to generate print preview:', err);
      setTestPrintStatus('Failed to generate preview: ' + err.message);
    } finally {
      setTestPrinting(false);
    }
  }

  // Step 2: sends the EXACT image shown in the preview — no regeneration — so what you
  // confirmed is byte-for-byte what reaches the printer.
  async function handleConfirmPrint() {
    if (!printPreview) return;
    if (!connectionSettings || !connectionSettings.printerOverride) {
      setTestPrintStatus('Configure a printer in the Connection tab first.');
      return;
    }

    setTestPrinting(true);
    try {
      await printImageDataUrl(
        connectionSettings.printerOverride,
        template,
        printPreview,
        { connSettings: connectionSettings, copies: 1 }
      );
      setTestPrintStatus(`Sent to ${connectionSettings.printerOverride}.`);
      setPrintPreview(null);
    } catch (err) {
      console.error('Print failed:', err);
      setTestPrintStatus('Print failed: ' + err.message);
    } finally {
      setTestPrinting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Quick Print — standalone, bypasses the field/template/webhook system entirely */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Printer className="w-4 h-4 text-primary" />
            Quick Print
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Type or paste any text, pick a size, and print it immediately — independent of the label template below.
          </p>
        </div>

        <textarea
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
          placeholder="Type or paste text to print..."
          className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="quick-width" className="text-[11px] font-medium text-muted-foreground">Width (mm)</label>
            <input
              id="quick-width"
              type="number"
              min="10"
              value={quickWidth}
              onChange={(e) => setQuickWidth(Number(e.target.value))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="quick-height" className="text-[11px] font-medium text-muted-foreground">Height (mm)</label>
            <input
              id="quick-height"
              type="number"
              min="5"
              value={quickHeight}
              onChange={(e) => setQuickHeight(Number(e.target.value))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="quick-font" className="text-[11px] font-medium text-muted-foreground">Font Size (mm)</label>
            <input
              id="quick-font"
              type="number"
              step="0.5"
              min="1"
              value={quickFontSize}
              onChange={(e) => setQuickFontSize(Number(e.target.value))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="quick-rotation" className="text-[11px] font-medium text-muted-foreground">Rotation</label>
            <select
              id="quick-rotation"
              value={quickRotation}
              onChange={(e) => setQuickRotation(Number(e.target.value))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none"
            >
              <option value="0">0°</option>
              <option value="90">90°</option>
              <option value="180">180°</option>
              <option value="270">270°</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={quickBold}
              onChange={(e) => setQuickBold(e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
            />
            Bold
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={quickWrap}
              onChange={(e) => setQuickWrap(e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
            />
            Wrap Text
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleQuickPrint}
            disabled={quickPrinting}
            className="h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            {quickPrinting ? 'Printing...' : 'Print This Text'}
          </button>
          {quickStatus && <p className="text-[11px] text-muted-foreground">{quickStatus}</p>}
        </div>
      </div>

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
            <p className="text-[10px] text-muted-foreground">Rotates the entire label (including text) at print time only — the canvas below always stays in normal reading orientation while you design.</p>
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
                    This canvas stays in normal orientation for editing — click "Show Real View" for the {template.rotation}° rotated result
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {template.rotation > 0 && (
                <button
                  onClick={() => setShowRealView((v) => !v)}
                  className={`h-9 px-4 rounded-md border text-xs font-medium transition-all ${
                    showRealView
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:bg-secondary'
                  }`}
                >
                  {showRealView ? 'Hide Real View' : 'Show Real View'}
                </button>
              )}
              <button
                onClick={handlePreviewPrint}
                disabled={testPrinting}
                title="Generate the exact image that would be sent to the printer, for you to check first"
                className="h-9 px-4 rounded-md border border-primary/30 bg-primary/5 text-primary text-xs font-medium hover:bg-primary/10 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                {testPrinting ? 'Working...' : 'Preview Print Image'}
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={saving}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>

          {testPrintStatus && (
            <p className="text-[11px] text-muted-foreground -mt-4">{testPrintStatus}</p>
          )}

          {printPreview && (
            <div className="rounded-xl border-2 border-primary bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">
                  This is the exact PNG that will be sent to the printer — not a canvas, not a live preview, the literal file.
                </p>
              </div>
              <div className="flex justify-center bg-secondary/30 rounded-lg p-4 overflow-auto">
                <img src={printPreview} alt="Exact print image" className="max-w-full h-auto border border-border shadow-md" />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setPrintPreview(null)}
                  className="h-9 px-4 rounded-md border border-border bg-background text-xs font-medium text-foreground hover:bg-secondary transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPrint}
                  disabled={testPrinting}
                  className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {testPrinting ? 'Sending...' : 'Confirm & Print This Exact Image'}
                </button>
              </div>
            </div>
          )}

          {/* Label Canvas — always editable, regardless of rotation */}
          <div className="flex flex-wrap justify-center gap-6 p-8 bg-secondary/30 rounded-lg border border-dashed border-border overflow-auto min-h-[400px]">
            <div className="flex flex-col items-center gap-2">
              <div
                className="relative border border-foreground/30 bg-white shadow-lg rounded-[1px]"
                style={{
                  width: `${template.widthMm}mm`,
                  height: `${template.heightMm}mm`,
                  backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1.5px)',
                  backgroundSize: '8px 8px',
                  fontFamily: 'Arial, Helvetica, sans-serif'
                }}
              >
                {template.fields.map((f) => {
                  const isSelected = selectedFieldId === f.id;
                  const displayVal = sampleData[f.columnId] || `[${columnTitle(f.columnId)}]`;
                  const { footprintWidth, footprintHeight, rotation } = getFieldFootprint(f);

                  const contentClassName = `absolute select-none text-black transition-all ${
                    f.wrap ? 'overflow-visible' : 'overflow-hidden'
                  } ${
                    isSelected
                      ? 'outline-2 outline-dashed outline-primary outline-offset-1 bg-primary/5'
                      : 'hover:outline-1 hover:outline-dashed hover:outline-primary/50'
                  }`;

                  const verticalAlignMap = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };

                  const contentStyle = {
                    width: `${f.width}mm`,
                    height: f.wrap ? 'auto' : `${f.height}mm`,
                    minHeight: `${f.height}mm`,
                    fontSize: `${f.fontSize}mm`,
                    fontWeight: f.bold ? 'bold' : 'normal',
                    textAlign: f.align || 'left',
                    lineHeight: 1.2,
                    display: 'flex',
                    alignItems: verticalAlignMap[f.verticalAlign] || 'center',
                    justifyContent: f.align === 'center' ? 'center' : f.align === 'right' ? 'flex-end' : 'flex-start'
                  };

                  const content = (
                    <>
                      {f.showLabel && (
                        <span className="opacity-40 text-[75%] font-normal mr-1 select-none">
                          {columnTitle(f.columnId)}:
                        </span>
                      )}
                      <span className={f.wrap ? 'whitespace-normal break-words' : 'truncate'}>{displayVal}</span>
                    </>
                  );

                  if (!rotation) {
                    return (
                      <div
                        key={f.id}
                        onPointerDown={(e) => onPointerDown(f.id, e)}
                        className={`${contentClassName} cursor-move`}
                        style={{ left: `${f.x}mm`, top: `${f.y}mm`, ...contentStyle }}
                      >
                        {content}
                      </div>
                    );
                  }

                  // Outer div reserves the field's own-rotation footprint (width/height
                  // swapped only for a 90/270 field rotation) — this is what dragging,
                  // clamping and alignment position against, in the label's own local frame.
                  return (
                    <div
                      key={f.id}
                      onPointerDown={(e) => onPointerDown(f.id, e)}
                      className="absolute cursor-move"
                      style={{ left: `${f.x}mm`, top: `${f.y}mm`, width: `${footprintWidth}mm`, height: `${footprintHeight}mm` }}
                    >
                      <div
                        className={contentClassName}
                        style={{
                          left: '50%',
                          top: '50%',
                          ...contentStyle,
                          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                          transformOrigin: 'center center'
                        }}
                      >
                        {content}
                      </div>
                    </div>
                  );
                })}
              </div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Editable (normal orientation)</span>
            </div>

            {showRealView && template.rotation > 0 && (() => {
              const { pageWidth, pageHeight } = getPrintedDimensions(template);
              return (
                <div className="flex flex-col items-center gap-2">
                  <div className="relative" style={{ width: `${pageWidth}mm`, height: `${pageHeight}mm` }}>
                    {/* Actual <canvas> drawn by renderLabelToCanvas — the EXACT SAME function
                        printLabel calls to generate the real print image. Not a CSS
                        approximation — this IS the print output, shown on screen instead of
                        sent to a printer, so it cannot drift out of sync with what prints. */}
                    <canvas
                      ref={previewCanvasRef}
                      className="absolute inset-0 w-full h-full border border-foreground/30 bg-white shadow-lg rounded-[1px]"
                      style={{ imageRendering: 'crisp-edges' }}
                    />
                    {/* Transparent draggable overlays, positioned via computeFieldPlacement —
                        the same placement math the canvas above was drawn with. Drag here to
                        position fields directly in the final rotated result, no mental
                        rotation math required. */}
                    {template.fields.map((f) => {
                      const placement = computeFieldPlacement(template, f);
                      const isSelected = selectedFieldId === f.id;
                      return (
                        <div
                          key={f.id}
                          onPointerDown={(e) => onRotatedPointerDown(f.id, e)}
                          title={columnTitle(f.columnId)}
                          className={`absolute cursor-move ${
                            isSelected
                              ? 'outline-2 outline-dashed outline-primary bg-primary/10'
                              : 'outline-1 outline-dashed outline-primary/30 hover:outline-primary/60 hover:bg-primary/5'
                          }`}
                          style={{
                            left: `${placement.left}mm`,
                            top: `${placement.top}mm`,
                            width: `${f.width}mm`,
                            height: `${f.height}mm`,
                            transform: placement.rotation ? `rotate(${placement.rotation}deg)` : undefined,
                            transformOrigin: 'center center'
                          }}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Real View ({template.rotation}° rotated, as printed) — drag fields here directly</span>
                </div>
              );
            })()}
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

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/40 p-4 rounded-lg border border-border">
                      <div className="space-y-1.5">
                        <label htmlFor={`field-x-${f.id}`} className="text-[11px] font-medium text-muted-foreground">X (mm)</label>
                        <input
                          id={`field-x-${f.id}`}
                          type="number"
                          min="0"
                          value={f.x}
                          onChange={(e) => updateField(f.id, { x: Number(e.target.value) })}
                          className="h-8 w-full rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor={`field-y-${f.id}`} className="text-[11px] font-medium text-muted-foreground">Y (mm)</label>
                        <input
                          id={`field-y-${f.id}`}
                          type="number"
                          min="0"
                          value={f.y}
                          onChange={(e) => updateField(f.id, { y: Number(e.target.value) })}
                          className="h-8 w-full rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none"
                        />
                      </div>

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
                        <label htmlFor={`field-align-${f.id}`} className="text-[11px] font-medium text-muted-foreground">Horizontal Align</label>
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
                        <label htmlFor={`field-valign-${f.id}`} className="text-[11px] font-medium text-muted-foreground">Vertical Align</label>
                        <select
                          id={`field-valign-${f.id}`}
                          value={f.verticalAlign || 'middle'}
                          onChange={(e) => updateField(f.id, { verticalAlign: e.target.value })}
                          className="h-8 w-full rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none"
                        >
                          <option value="top">Top</option>
                          <option value="middle">Middle</option>
                          <option value="bottom">Bottom</option>
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
                        {template.rotation > 0 && f.rotation > 0 && (
                          <p className="text-[10px] text-destructive">
                            Stacks with the label's {template.rotation}° print rotation above — this field will
                            appear rotated {(template.rotation + f.rotation) % 360}° total. Leave this at 0° if
                            you just want the whole label (including this field) to rotate together.
                          </p>
                        )}
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
    </div>
  );
}
