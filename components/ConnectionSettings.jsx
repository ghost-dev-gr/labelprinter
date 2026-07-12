// ConnectionSettings.jsx
// QZ Tray connection and printer configuration
import React, { useState, useEffect } from 'react';
import { listPrinters, printLabel } from '@generated/utils/qzPrint';
import { DEFAULT_CONNECTION_SETTINGS, saveConnectionSettings } from '@generated/utils/connectionSettings';
import { flattenObject } from '@generated/utils/flatten';
import { RefreshCw, Loader2, CheckCircle2, XCircle, Info, Settings, HelpCircle, FileText } from 'lucide-react';

export default function ConnectionSettings({ boardId, connectionSettings, setConnectionSettings, template, columns }) {
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({ success: null, message: '' });
    const [testPrinting, setTestPrinting] = useState(false);
    const [testPrintStatus, setTestPrintStatus] = useState({ success: null, message: '' });

  const settings = connectionSettings || DEFAULT_CONNECTION_SETTINGS;

  useEffect(() => {
    if (!connectionSettings) {
      setConnectionSettings(DEFAULT_CONNECTION_SETTINGS);
    }
  }, []);

  async function loadPrinters() {
    setLoading(true);
    setConnectionStatus({ success: null, message: '' });
    try {
      const printerList = await listPrinters(settings);
      setPrinters(printerList || []);
      setConnectionStatus({ success: true, message: 'Connected to QZ Tray successfully.' });
    } catch (err) {
      console.error('Failed to list printers:', err);
      setPrinters([]);
      setConnectionStatus({ success: false, message: err.message || 'Connection failed. Is QZ Tray running?' });
    } finally {
      setLoading(false);
    }
  }

  async function testConnection() {
    setTestingConnection(true);
    setConnectionStatus({ success: null, message: '' });
    try {
      const printerList = await listPrinters(settings);
      setConnectionStatus({
        success: true,
        message: `Found ${printerList.length} local printer${printerList.length !== 1 ? 's' : ''}.`
      });
    } catch (err) {
      console.error('Connection test failed:', err);
      setConnectionStatus({ success: false, message: err.message || 'Connection failed' });
    } finally {
      setTestingConnection(false);
    }
  }

  function updateSetting(key, value) {
    setConnectionSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    try {
      await saveConnectionSettings(settings);
      setConnectionStatus({ success: true, message: 'Settings saved successfully to monday.com storage.' });
      console.log('[ConnectionSettings] Settings saved:', settings);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setConnectionStatus({ success: false, message: 'Failed to save settings.' });
    }
  }

  async function handleTestPrint() {
    setTestPrinting(true);
    setTestPrintStatus({ success: null, message: '' });
    
    try {
      if (!template || !template.fields || template.fields.length === 0) {
        setTestPrintStatus({ success: false, message: 'Design a label in the Label Designer tab first.' });
        return;
      }

      // Print with the real values from the last webhook — same source auto-print uses —
      // instead of fake placeholder text, so this reflects your actual label exactly.
      const inboxRes = await fetch('/api/webhook-inbox');
      const inbox = await inboxRes.json();

      if (!inbox.payload) {
        setTestPrintStatus({ success: false, message: 'No webhook received yet — trigger one first so there is real data to print.' });
        return;
      }

      const flat = flattenObject(inbox.payload);
      const testValues = {};
      template.fields.forEach((f) => {
        testValues[f.columnId] = flat[f.columnId] ?? '';
      });

      const testColumns = columns && columns.length > 0 ? columns : [];

      const printerName = settings.printerOverride || 'default';
      console.log('[ConnectionSettings] Test print triggered - printer:', printerName, '- values:', testValues);

      await printLabel(
        printerName,
        template,
        testValues,
        testColumns,
        { connSettings: settings, copies: settings.copies || 1 }
      );

      setTestPrintStatus({
        success: true,
        message: `Test label sent to ${settings.printerOverride || 'default printer'} using your Label Designer template and the last webhook's data`
      });
      } catch (err) {
        console.error('[ConnectionSettings] Test print failed:', err);
        setTestPrintStatus({
          success: false,
          message: err.message || 'Print failed'
        });
      } finally {
        setTestPrinting(false);
      }
    }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Settings Panel */}
      <div className="lg:col-span-7 bg-card rounded-xl border border-border p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            Active Service Route
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure local websocket variables to interact with the QZ Tray background application.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="host" className="text-xs font-semibold text-muted-foreground">
              Host / Terminal IP
            </label>
            <input
              id="host"
              type="text"
              value={settings.host}
              onChange={(e) => updateSetting('host', e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none"
              placeholder="localhost"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="port" className="text-xs font-semibold text-muted-foreground">
              Websocket Port
            </label>
            <input
              id="port"
              type="number"
              value={settings.usingSecure ? settings.securePort : settings.insecurePort}
              onChange={(e) =>
                updateSetting(settings.usingSecure ? 'securePort' : 'insecurePort', Number(e.target.value))
              }
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5 bg-muted/40 p-3 rounded-lg border border-border">
          <input
            id="secure"
            type="checkbox"
            checked={settings.usingSecure}
            onChange={(e) => updateSetting('usingSecure', e.target.checked)}
            className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
          />
          <div className="grid gap-0.5">
            <label htmlFor="secure" className="text-xs font-medium text-foreground cursor-pointer select-none">
              Use secure connection (wss://)
            </label>
            <p className="text-[10px] text-muted-foreground">Recommended for secure workspaces or custom remote servers.</p>
          </div>
        </div>

        <div className="border-t border-border pt-5 space-y-4">
          <div>
            <label htmlFor="certificate" className="text-xs font-semibold text-foreground">Certificate (Optional)</label>
            <p className="text-[10px] text-muted-foreground mt-0.5">Paste your QZ Tray certificate in PEM format. Leave empty to use demo certificate.</p>
            <textarea
              id="certificate"
              value={settings.certificate || ''}
              onChange={(e) => updateSetting('certificate', e.target.value)}
              placeholder="-----BEGIN CERTIFICATE-----&#10;Your certificate here...&#10;-----END CERTIFICATE-----"
              className="mt-2 w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none resize-none"
            />
          </div>
          
          <div>
            <label htmlFor="privateKey" className="text-xs font-semibold text-foreground">Private Key (Optional)</label>
            <p className="text-[10px] text-muted-foreground mt-0.5">Paste your private key in PEM format. Required if using custom certificate.</p>
            <textarea
              id="privateKey"
              value={settings.privateKey || ''}
              onChange={(e) => updateSetting('privateKey', e.target.value)}
              placeholder="-----BEGIN PRIVATE KEY-----&#10;Your private key here...&#10;-----END PRIVATE KEY-----"
              className="mt-2 w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none resize-none"
            />
          </div>
        </div>

        <div className="border-t border-border pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="printer-select" className="text-xs font-semibold text-foreground">Target Printer Name</label>
              <p className="text-[10px] text-muted-foreground mt-0.5">Select your HPRT thermal label printer from the active system list</p>
            </div>
            <button
              onClick={loadPrinters}
              disabled={loading}
              className="h-8 px-3 rounded-md border border-border bg-background text-xs text-foreground hover:bg-secondary flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Listing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3" />
                  Fetch List
                </>
              )}
            </button>
          </div>
          <select
            id="printer-select"
            value={settings.printerOverride}
            onChange={(e) => updateSetting('printerOverride', e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none"
          >
            <option value="">Select an active printer...</option>
            {printers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {connectionStatus.message && (
          <div
            className={`rounded-lg p-3.5 flex items-start gap-3 border ${
              connectionStatus.success
                ? 'bg-green-100/50 dark:bg-green-950/20 border-green-500/20'
                : 'bg-destructive/5 border-destructive/20'
            }`}
          >
            {connectionStatus.success ? (
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-destructive mt-0.5" />
            )}
            <div>
              <p
                className={`text-xs font-semibold ${
                  connectionStatus.success ? 'text-green-800 dark:text-green-400' : 'text-destructive'
                }`}
              >
                {connectionStatus.success ? 'Terminal Bound' : 'Terminal Unreachable'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{connectionStatus.message}</p>
            </div>
          </div>
        )}

        {testPrintStatus.message && (
          <div
            className={`rounded-lg p-3.5 flex items-start gap-3 border ${
              testPrintStatus.success
                ? 'bg-blue-100/50 dark:bg-blue-950/20 border-blue-500/20'
                : 'bg-destructive/5 border-destructive/20'
            }`}
          >
            {testPrintStatus.success ? (
              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-destructive mt-0.5" />
            )}
            <div>
              <p
                className={`text-xs font-semibold ${
                  testPrintStatus.success ? 'text-blue-800 dark:text-blue-400' : 'text-destructive'
                }`}
              >
                {testPrintStatus.success ? 'Print Dispatched' : 'Print Failed'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{testPrintStatus.message}</p>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={testConnection}
            disabled={testingConnection}
            className="h-9 px-4 rounded-md border border-border bg-background text-xs font-semibold text-foreground hover:bg-secondary transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {testingConnection ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Socket'
            )}
          </button>
          
          <button
            onClick={handleTestPrint}
            disabled={testPrinting}
            className="h-9 px-4 rounded-md border border-primary/30 bg-primary/5 text-xs font-semibold text-primary hover:bg-primary/10 transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {testPrinting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Printing...
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5" />
                Test Print
              </>
            )}
          </button>
          
          <button
            onClick={handleSave}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm"
          >
            Save Configuration
          </button>
        </div>
      </div>

      {/* Connection Help Card */}
      <div className="lg:col-span-5 bg-card rounded-xl border border-border p-5 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
          <Info className="w-4 h-4 text-primary" />
          Terminal Routing Guide
        </h3>
        
        <div className="text-xs text-muted-foreground space-y-3.5 leading-relaxed">
          <p>
            Because different employees run separate physical terminals with independent thermal printers (like the HPRT HT600), these connection settings are preserved <strong>locally inside this browser</strong>.
          </p>
          <div className="p-3 bg-secondary/45 rounded-lg border border-border">
            <span className="font-semibold text-foreground block mb-1">Recommended Local Config:</span>
            <ul className="list-disc pl-4 space-y-1 text-[11px]">
              <li>Host: <code className="font-mono">localhost</code></li>
              <li>Secure connection: unchecked (HTTP/ws)</li>
              <li>Insecure Port: <code className="font-mono">8182</code></li>
            </ul>
          </div>
          <p>
            This allows direct background dispatching without constant secure-cert dialog warnings.
          </p>
        </div>

        {/* Diagnostic Tools */}
        <div className="pt-3 border-t border-border space-y-2">
          <h4 className="text-[10px] font-bold text-foreground uppercase tracking-wider opacity-70">
            Iframe Permission Diagnostics
          </h4>
          <button
            onClick={async () => {
              try {
                console.log('Window context - top === self:', window.top === window);
                console.log('navigator.usb available:', !!navigator.usb);
                
                if (!navigator.usb) {
                  console.error('USB API not available - iframe may lack permissions');
                  return;
                }
                
                const device = await navigator.usb.requestDevice({ filters: [] });
                console.log('USB device selected:', device);
              } catch (e) {
                console.error('USB device access error:', e);
              }
            }}
            className="h-8 px-3 rounded-md bg-secondary text-secondary-foreground text-[11px] font-medium hover:bg-secondary/80 transition-all border border-border"
          >
            Test USB Permissions
          </button>
          <p className="text-[10px] text-muted-foreground">
            Opens USB device picker to verify iframe has hardware access permissions. Check console for results.
          </p>
        </div>
      </div>
    </div>
  );
}
