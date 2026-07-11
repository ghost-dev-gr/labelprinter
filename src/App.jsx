import React, { useEffect, useState } from 'react';
import LabelDesigner from './components/LabelDesigner.jsx';
import PrintForm from './components/PrintForm.jsx';
import ConnectionSettings from './components/ConnectionSettings.jsx';
import { fetchSettings, saveSettings, DEFAULT_SETTINGS } from './utils/settingsApi';

export default function App() {
  const [tab, setTab] = useState('print');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  function updateTemplate(updater) {
    setSettings((s) => {
      const nextTemplate = typeof updater === 'function' ? updater(s.labelTemplate) : updater;
      const next = { ...s, labelTemplate: nextTemplate };
      saveSettings({ labelTemplate: nextTemplate });
      return next;
    });
  }

  if (loading) {
    return <div style={{ padding: 16, fontFamily: 'sans-serif' }}>Loading...</div>;
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>Label Printer</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #ddd' }}>
        {[
          { id: 'print', label: 'Print' },
          { id: 'designer', label: 'Label Designer' },
          { id: 'settings', label: 'Connection' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 14px',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid #0073ea' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontWeight: tab === t.id ? 'bold' : 'normal'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'print' && <PrintForm template={settings.labelTemplate} settings={settings} />}
      {tab === 'designer' && <LabelDesigner template={settings.labelTemplate} setTemplate={updateTemplate} />}
      {tab === 'settings' && <ConnectionSettings settings={settings} setSettings={setSettings} />}
    </div>
  );
}
