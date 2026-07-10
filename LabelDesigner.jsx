// LabelDesigner.jsx
// Drag-and-drop label designer with visual canvas and field controls

import React, { useRef } from 'react';
import { saveTemplate } from './mondayData';

const PX_PER_MM = 4;

export default function LabelDesigner({ boardId, columns, template, setTemplate }) {
  const dragState = useRef(null);

  function updateField(fieldId, patch) {
    setTemplate((t) => ({
      ...t,
      fields: t.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f))
    }));
  }

  function onPointerDown(fieldId, e) {
    const field = template.fields.find((f) => f.id === fieldId);
    dragState.current = {
      fieldId,
      startX: e.clientX,
      startY: e.clientY,
      origX: field.x,
      origY: field.y
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  function onPointerMove(e) {
    const d = dragState.current;
    if (!d) return;
    const dxMm = (e.clientX - d.startX) / PX_PER_MM;
    const dyMm = (e.clientY - d.startY) / PX_PER_MM;
    updateField(d.fieldId, {
      x: Math.max(0, Math.round(d.origX + dxMm)),
      y: Math.max(0, Math.round(d.origY + dyMm))
    });
  }

  function onPointerUp() {
    dragState.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }

  function addField(columnId) {
    setTemplate((t) => ({
      ...t,
      fields: [
        ...t.fields,
        {
          id: 'f-' + Date.now(),
          columnId,
          x: 5,
          y: 5,
          width: 40,
          height: 10,
          fontSize: 4,
          align: 'left',
          bold: false
        }
      ]
    }));
  }

  function removeField(fieldId) {
    setTemplate((t) => ({ ...t, fields: t.fields.filter((f) => f.id !== fieldId) }));
  }

  function columnTitle(columnId) {
    if (columnId === 'name') return 'Item Name';
    return columns.find((c) => c.id === columnId)?.title || columnId;
  }

  async function handleSaveTemplate() {
    try {
      await saveTemplate(boardId, template);
    } catch (err) {
      console.error('Failed to save template:', err);
    }
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-2">Label Designer</h2>
        <p className="text-sm text-muted-foreground">
          Configure label dimensions and drag fields onto the canvas
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="grid gap-2">
            <label htmlFor="width" className="text-sm font-medium text-foreground">
              Width (mm)
            </label>
            <input
              id="width"
              type="number"
              value={template.widthMm}
              onChange={(e) => setTemplate((t) => ({ ...t, widthMm: Number(e.target.value) }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="height" className="text-sm font-medium text-foreground">
              Height (mm)
            </label>
            <input
              id="height"
              type="number"
              value={template.heightMm}
              onChange={(e) => setTemplate((t) => ({ ...t, heightMm: Number(e.target.value) }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="rotation" className="text-sm font-medium text-foreground">
              Orientation
            </label>
            <select
              id="rotation"
              value={template.rotation}
              onChange={(e) => setTemplate((t) => ({ ...t, rotation: Number(e.target.value) }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={0}>Normal (0°)</option>
              <option value={90}>Rotated (90°)</option>
            </select>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground mb-3">Add Fields</p>
          <div className="flex flex-wrap gap-2">
            {[{ id: 'name', title: 'Item Name' }, ...columns].map((c) => (
              <button
                key={c.id}
                onClick={() => addField(c.id)}
                className="h-8 px-3 rounded-md border border-input bg-background text-sm text-foreground hover:bg-secondary transition-colors"
              >
                + {c.title}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground mb-3">Label Canvas</p>
          <div
            className="relative border border-border rounded-md bg-white"
            style={{
              width: template.widthMm * PX_PER_MM,
              height: template.heightMm * PX_PER_MM
            }}
          >
            {template.fields.map((f) => (
              <div
                key={f.id}
                onPointerDown={(e) => onPointerDown(f.id, e)}
                title="Drag to reposition"
                className="absolute border border-dashed border-primary cursor-move select-none overflow-hidden whitespace-nowrap"
                style={{
                  left: f.x * PX_PER_MM,
                  top: f.y * PX_PER_MM,
                  width: f.width * PX_PER_MM,
                  height: f.height * PX_PER_MM,
                  fontSize: f.fontSize * PX_PER_MM,
                  fontWeight: f.bold ? 'bold' : 'normal',
                  textAlign: f.align,
                  color: '#000'
                }}
              >
                {columnTitle(f.columnId)}
              </div>
            ))}
          </div>
        </div>

        {template.fields.length > 0 && (
          <div>
            <p className="text-sm font-medium text-foreground mb-3">Field Properties</p>
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left font-medium text-foreground">Field</th>
                    <th className="px-3 py-2 text-left font-medium text-foreground">Font (mm)</th>
                    <th className="px-3 py-2 text-left font-medium text-foreground">Align</th>
                    <th className="px-3 py-2 text-left font-medium text-foreground">Bold</th>
                    <th className="px-3 py-2 text-left font-medium text-foreground">Width (mm)</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {template.fields.map((f) => (
                    <tr key={f.id}>
                      <td className="px-3 py-2 text-foreground">{columnTitle(f.columnId)}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={f.fontSize}
                          onChange={(e) => updateField(f.id, { fontSize: Number(e.target.value) })}
                          className="h-7 w-20 rounded border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          aria-label={`Font size for ${columnTitle(f.columnId)}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={f.align}
                          onChange={(e) => updateField(f.id, { align: e.target.value })}
                          className="h-7 rounded border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          aria-label={`Alignment for ${columnTitle(f.columnId)}`}
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={f.bold}
                          onChange={(e) => updateField(f.id, { bold: e.target.checked })}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
                          aria-label={`Bold for ${columnTitle(f.columnId)}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={f.width}
                          onChange={(e) => updateField(f.id, { width: Number(e.target.value) })}
                          className="h-7 w-20 rounded border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          aria-label={`Width for ${columnTitle(f.columnId)}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => removeField(f.id)}
                          className="h-7 px-2 rounded text-xs text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveTemplate}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Save Template
          </button>
        </div>
      </div>
    </div>
  );
}
