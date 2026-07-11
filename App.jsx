// App.jsx
// Label Printer board view: Print items, Design labels, Configure QZ Tray connection

import React, { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { Printer, Layout, Settings, AlertCircle } from 'lucide-react';
import monday from 'monday-sdk-js';

import { loadTemplate } from '@generated/utils/mondayData';
import { loadConnectionSettings } from '@generated/utils/connectionSettings';
import LabelDesigner from '@generated/components/LabelDesigner';
import ConnectionSettings from '@generated/components/ConnectionSettings';

const mondayClient = monday();

const BOARD_ID = 18421089379;

const COLUMNS = [
  { id: 'sku', title: 'SKU' },
  { id: 'price', title: 'Price' },
  { id: 'totalPrice', title: 'Total Price' },
  { id: 'quantity', title: 'Quantity' }
];

export default function App() {
  const [boardId, setBoardId] = useState(BOARD_ID);
  const [template, setTemplate] = useState({
    widthMm: 100,
    heightMm: 60,
    rotation: 0,
    fields: []
  });
  const [connectionSettings, setConnectionSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Load the real QZ Tray client library from the official CDN
    const qzScript = document.createElement('script');
    qzScript.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.min.js';
    qzScript.async = true;
    qzScript.onload = () => console.log('QZ Tray library loaded (CDN):', typeof window.qz);
    qzScript.onerror = () => console.error('Failed to load QZ Tray library from CDN');
    document.head.appendChild(qzScript);

    async function loadWorkspaceData() {
      try {
        const tpl = await loadTemplate(BOARD_ID);

        if (tpl) {
          setTemplate(tpl);
        } else {
          // Setup initial user-friendly fallback fields
          setTemplate({
            widthMm: 100,
            heightMm: 60,
            rotation: 0,
            fields: [
              {
                id: 'f-init-name',
                columnId: 'name',
                x: 5,
                y: 8,
                width: 90,
                height: 10,
                fontSize: 4.5,
                align: 'left',
                bold: true,
                showLabel: false
              },
              {
                id: 'f-init-sku',
                columnId: 'sku',
                x: 5,
                y: 22,
                width: 45,
                height: 8,
                fontSize: 3.5,
                align: 'left',
                bold: false,
                showLabel: true
              },
              {
                id: 'f-init-price',
                columnId: 'price',
                x: 55,
                y: 22,
                width: 40,
                height: 8,
                fontSize: 4,
                align: 'right',
                bold: true,
                showLabel: true
              }
            ]
          });
        }

        // Machine-specific connection config loaded from monday storage
        const conn = await loadConnectionSettings();
        console.log('[App] Loaded connection settings:', conn);
        if (conn) {
          setConnectionSettings(conn);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading workspace labels data:', err);
        setError(err.message);
        setLoading(false);
      }
    }

    loadWorkspaceData();

    return () => {
      if (qzScript.parentNode) {
        qzScript.remove();
      }
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>Error loading print database context: {error}</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-9 h-9 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground font-medium">Initializing Workspace Environment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-start border-b border-border pb-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Printer className="w-7 h-7 text-primary" />
              Thermal Label Printer
            </h1>
            <p className="text-xs text-muted-foreground">
              Design your label layout and configure the QZ Tray connection - actual printing runs automatically via monday Automation
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg border border-border">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Workspace Sync Active</span>
            </div>
            
            <button
              onClick={async () => {
                console.log('[App] 🧪 Test button clicked - checking event system');
                console.log('[App] Current settings:', connectionSettings);
                console.log('[App] Current template:', template);
                
                // Try to get context
                const context = await mondayClient.get('context');
                console.log('[App] Monday context:', context);
                
                mondayClient.execute('notice', {
                  message: 'Test: App is running and can communicate with monday.com!',
                  type: 'success',
                  timeout: 3000
                });
              }}
              className="h-8 px-3 rounded-md bg-muted text-foreground text-[10px] font-semibold hover:bg-muted/80 transition-all border border-border"
            >
              🧪 Test Connection
            </button>
          </div>
        </div>

        <Tabs defaultValue="designer" className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-xs p-1 bg-secondary rounded-lg">
            <TabsTrigger value="designer" className="flex items-center gap-2 text-xs py-2 font-medium cursor-pointer">
              <Layout className="w-3.5 h-3.5" />
              Label Designer
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2 text-xs py-2 font-medium cursor-pointer">
              <Settings className="w-3.5 h-3.5" />
              Connection
            </TabsTrigger>
          </TabsList>

          <TabsContent value="designer" className="outline-none">
            <LabelDesigner
              boardId={boardId}
              columns={COLUMNS}
              template={template}
              setTemplate={setTemplate}
            />
          </TabsContent>

          <TabsContent value="settings" className="outline-none">
            <ConnectionSettings
              boardId={boardId}
              connectionSettings={connectionSettings}
              setConnectionSettings={setConnectionSettings}
            />
          </TabsContent>
        </Tabs>

        {/* Info footer */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">Interactive Hardware Notice</p>
              <p className="text-xs text-muted-foreground leading-normal">
                Make sure the QZ Tray desktop app is active in your terminal system tray to process background prints. You can grab the production client at{' '}
                <a
                  href="https://qz.io/download/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  qz.io/download
                </a>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
