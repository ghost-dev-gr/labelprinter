import React, { useRef, useState } from 'react';
import { saveTemplate } from '../utils/settingsApi';

const PX_PER_MM = 4;

export default function LabelDesigner({ template, setTemplate }) {
  const dragState = useRef(null);
  const [newFieldName, setNewFieldName] = useState('');

  function updateField(fieldId, patch) {
    setTemplate((t) => ({
      ...t,
      fields: t.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f))
    }));
  }

  function onPointerDown(fieldId, e) {
    const field = template.fields.find((f) => f.id === fieldId);
    dragState.current = { fieldId, startX: e.clientX, startY: e.clientY, origX: field.x, origY: field.y };
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

  function addField() {
    const name = newFieldName.trim();
    if (!name) return;
    setTemplate((t) => ({
      ...t,
      fields: [
        ...t.fields,
        { id: 'f-' + Date.now(), name, x: 5, y: 5, width: 40, height: 10, fontSize: 5, align: 'left', bold: false }
      ]
    }));
    setNewFieldName('');
  }

  function removeField(fieldId) {
    setTemplate((t) => ({ ...t, fields: t.fields.filter((f) => f.id !== fieldId) }));
  }

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <label>
          Width (mm):{' '}
          <input
            type="number"
            value={template.widthMm}
            onChange={(e) => setTemplate((t) => ({ ...t, widthMm: Number(e.target.value) }))}
          />
        </label>
        <label>
          Height (mm):{' '}
          <input
            type="number"
            value={template.heightMm}
            onChange={(e) => setTemplate((t) => ({ ...t, heightMm: Number(e.target.value) }))}
          />
        </label>
        <label>
          Rotation:{' '}
          <select
            value={template.rotation}
            onChange={(e) => setTemplate((t) => ({ ...t, rotation: Number(e.target.value) }))}
          >
            <option value={0}>Normal</option>
            <option value={90}>Rotated 90°</option>
          </select>
        </label>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <input
          type="text"
          placeholder="Field name (e.g. Name, SKU, Price)"
          value={newFieldName}
          onChange={(e) => setNewFieldName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addField()}
        />
        <button onClick={addField}>+ Add Field</button>
      </div>

      <div
        style={{
          position: 'relative',
          width: template.widthMm * PX_PER_MM,
          height: template.heightMm * PX_PER_MM,
          border: '1px solid #999',
          background: '#fff'
        }}
      >
        {template.fields.map((f) => (
          <div
            key={f.id}
            onPointerDown={(e) => onPointerDown(f.id, e)}
            title="Drag to reposition"
            style={{
              position: 'absolute',
              left: f.x * PX_PER_MM,
              top: f.y * PX_PER_MM,
              width: f.width * PX_PER_MM,
              height: f.height * PX_PER_MM,
              fontSize: f.fontSize * PX_PER_MM,
              fontWeight: f.bold ? 'bold' : 'normal',
              textAlign: f.align,
              border: '1px dashed #66c',
              cursor: 'move',
              userSelect: 'none',
              overflow: 'hidden',
              whiteSpace: 'nowrap'
            }}
          >
            {f.name}
          </div>
        ))}
      </div>

      {template.fields.length > 0 && (
        <table style={{ marginTop: 12, fontSize: 13 }}>
          <thead>
            <tr>
              <th>Field</th><th>Font (mm)</th><th>Align</th><th>Bold</th><th>Width (mm)</th><th></th>
            </tr>
          </thead>
          <tbody>
            {template.fields.map((f) => (
              <tr key={f.id}>
                <td>{f.name}</td>
                <td>
                  <input
                    type="number"
                    value={f.fontSize}
                    style={{ width: 50 }}
                    onChange={(e) => updateField(f.id, { fontSize: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <select value={f.align} onChange={(e) => updateField(f.id, { align: e.target.value })}>
                    <option value="left">left</option>
                    <option value="center">center</option>
                    <option value="right">right</option>
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={f.bold}
                    onChange={(e) => updateField(f.id, { bold: e.target.checked })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={f.width}
                    style={{ width: 50 }}
                    onChange={(e) => updateField(f.id, { width: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <button onClick={() => removeField(f.id)}>remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button style={{ marginTop: 12 }} onClick={() => saveTemplate(template)}>
        Save Template
      </button>
    </div>
  );
}
