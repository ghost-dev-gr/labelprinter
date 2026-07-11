import React, { useState } from 'react';
import { printLabel } from '../utils/qzPrint';

export default function PrintForm({ template, connectionSettings }) {
  const [values, setValues] = useState({});
  const [status, setStatus] = useState('');
  const [printing, setPrinting] = useState(false);

  function updateValue(fieldId, val) {
    setValues((v) => ({ ...v, [fieldId]: val }));
  }

  async function handlePrint() {
    if (!template.fields || template.fields.length === 0) {
      setStatus('Design a label template first in the Label Designer tab.');
      return;
    }
    if (!connectionSettings || !connectionSettings.printerOverride) {
      setStatus('Pick a printer in the Connection tab first.');
      return;
    }

    setPrinting(true);
    setStatus('');
    try {
      await printLabel(connectionSettings.printerOverride, template, values, {
        connSettings: connectionSettings,
        copies: connectionSettings.copies
      });
      setStatus('Printed successfully.');
    } catch (err) {
      setStatus('Print failed: ' + err.message);
    }
    setPrinting(false);
  }

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif', maxWidth: 480 }}>
      <h2 style={{ fontSize: 16 }}>Print a Label</h2>

      {template.fields.length === 0 ? (
        <p>No fields defined yet - go to the Label Designer tab first.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {template.fields.map((f) => (
            <label key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {f.name}
              <input
                type="text"
                value={values[f.id] || ''}
                onChange={(e) => updateValue(f.id, e.target.value)}
              />
            </label>
          ))}
        </div>
      )}

      <button
        style={{ marginTop: 16 }}
        onClick={handlePrint}
        disabled={printing || template.fields.length === 0}
      >
        {printing ? 'Printing...' : 'Print'}
      </button>

      {status && <p style={{ marginTop: 8, fontSize: 13 }}>{status}</p>}
    </div>
  );
}
