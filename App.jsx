// App.jsx
// Label Printer board view: Print items, Design labels, Configure QZ Tray connection

import React, { useEffect, useState } from 'react';
import { monday, getBoardColumns, getBoardItems, loadTemplate, DEFAULT_TEMPLATE } from './mondayData';
import { loadConnectionSettings } from './connectionSettings';
import PrintList from './PrintList';
import LabelDesigner from './LabelDesigner';
import ConnectionSettings from './ConnectionSettings';
import lnaSource from './lnaSource';
import qzTraySource from './qzTraySource';

export default function App() {
  const [boardId, setBoardId] = useState(null);
  const [columns, setColumns] = useState([]);
  const [items, setItems] = useState([]);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [connSettings, setConnSettings] = useState(loadConnectionSettings());
  const [tab, setTab] = useState('print');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load the QZ Tray client library. Its source is embedded as a string constant
    // (qzTraySource, the same file previously loaded from the jsdelivr CDN) and
    // injected inline via textContent, matching lnaSource below - avoids depending
    // on any external CDN or this project's static asset hosting being reachable.
    const script = document.createElement('script');
    script.textContent = qzTraySource;
    document.head.appendChild(script);
    console.log('QZ Tray library loaded (inline):', typeof window.qz);

    // Load QZ's Local Network Access detection helper. Its source is embedded as a
    // string constant (lnaSource, copied verbatim from
    // https://demo.qz.io/js/sample/lna.bundle.min.js) and injected inline via
    // textContent rather than a src= URL, so it doesn't depend on this project's
    // static asset hosting (which returned its HTML fallback page instead of the
    // file when loaded via src, causing a "Unexpected token '<'" syntax error).
    // Exposes window.lna.detectLna(), used in qzPrint.js to wrap the connect() call
    // and get a proper LnaError with a .denied flag instead of a generic failure.
    // Runs natively in Chrome/Brave/Edge - no polyfills needed (those in QZ's own
    // demo page are only for legacy browsers like IE11).
    const lnaScript = document.createElement('script');
    lnaScript.textContent = lnaSource;
    document.head.appendChild(lnaScript);
    console.log('LNA detection library loaded (inline):', typeof window.lna);

    monday.listen('context', async (res) => {
      try {
        let id = res?.data?.boardId || res?.data?.boardIds?.[0];
        
        if (!id) {
          console.warn('No boardId in context, using connected board 18421089379');
          id = 18421089379;
        }
        
        setBoardId(id);
        
        const [cols, its, tpl] = await Promise.all([
          getBoardColumns(id),
          getBoardItems(id),
          loadTemplate(id)
        ]);
        
        setColumns(cols);
        setItems(its);
        setTemplate(tpl);
        setLoading(false);
      } catch (err) {
        console.error('Error loading board data:', err);
        setError(err.message);
        setLoading(false);
      }
    });

    return () => {
      script.remove();
      lnaScript.remove();
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Error: {error}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading board data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background">
        <div className="flex h-14 items-center px-6">
          <h1 className="text-base font-semibold text-foreground">Label Printer</h1>
          <div className="ml-8 flex gap-1">
            <button
              onClick={() => setTab('print')}
              className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                tab === 'print'
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
              aria-pressed={tab === 'print'}
            >
              Print
            </button>
            <button
              onClick={() => setTab('design')}
              className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                tab === 'design'
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
              aria-pressed={tab === 'design'}
            >
              Design Label
            </button>
            <button
              onClick={() => setTab('connection')}
              className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                tab === 'connection'
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
              aria-pressed={tab === 'connection'}
            >
              Connection
            </button>
          </div>
        </div>
      </header>

      <main className="p-6">
        {tab === 'print' && (
          <PrintList items={items} template={template} connSettings={connSettings} />
        )}

        {tab === 'design' && (
          <LabelDesigner
            boardId={boardId}
            columns={columns}
            template={template}
            setTemplate={setTemplate}
          />
        )}

        {tab === 'connection' && (
          <ConnectionSettings settings={connSettings} setSettings={setConnSettings} />
        )}
      </main>
    </div>
  );
}
