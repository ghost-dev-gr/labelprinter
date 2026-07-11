// PrintList.jsx
// Exact replica of monday.com table UI with Print button
import React, { useState, useEffect } from 'react';
import { PrintTestBoard } from '@api/BoardSDK';
import { printLabel } from '@generated/utils/qzPrint';
import { Printer, Loader2, Search, RefreshCw } from 'lucide-react';

const MONDAY_FONT =
  "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export default function PrintList({ boardId, columns, template, connectionSettings }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [printingItems, setPrintingItems] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadItems();
    
    // Auto-refresh every 5 seconds to sync with board
    const interval = setInterval(loadItems, 5000);
    return () => clearInterval(interval);
  }, [boardId]);

  async function loadItems() {
    try {
      if (!loading) {
        // Silent refresh - don't show loading spinner
        const board = new PrintTestBoard(boardId);
        const result = await board
          .items()
          .withColumns(['sku', 'price', 'totalPrice', 'quantity', 'printStatus', 'detectVibe'])
          .execute();
        setItems(result.items || []);
      } else {
        // Initial load - show spinner
        setLoading(true);
        const board = new PrintTestBoard(boardId);
        const result = await board
          .items()
          .withColumns(['sku', 'price', 'totalPrice', 'quantity', 'printStatus', 'detectVibe'])
          .execute();
        setItems(result.items || []);
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to load items:', err);
      if (loading) setLoading(false);
    }
  }

  async function printItem(itemId) {
    if (!template.fields || template.fields.length === 0) {
      alert('Please design a label template first in the Label Designer tab.');
      return;
    }
    if (!connectionSettings || !connectionSettings.printerOverride) {
      alert('Please configure printer connection in the Connection tab.');
      return;
    }

    setPrintingItems(prev => new Set(prev).add(itemId));
    const item = items.find((i) => i.id === itemId);

    if (!item) {
      setPrintingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      return;
    }

    try {
      const values = {
        name: item.name || '',
        group: item.group?.title || '',
        sku: item.sku || '',
        price: item.price || '',
        totalPrice: item.totalPrice || '',
        quantity: item.quantity || '',
        printStatus: item.printStatus || '',
        detectVibe: item.detectVibe || ''
      };

      const copies = item.quantity && Number(item.quantity) > 0 ? Number(item.quantity) : 1;

      await printLabel(
        connectionSettings.printerOverride,
        template,
        values,
        columns,
        { connSettings: connectionSettings, copies }
      );

      console.log(`Printed: ${item.name}`);
    } catch (err) {
      console.error(`Print failed:`, err);
      alert(`Print failed: ${err.message}`);
    }

    setPrintingItems(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  }

  // Search across ALL columns
  const filteredItems = items.filter(item => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    
    // Search in all text fields
    const nameMatch = (item.name || '').toLowerCase().includes(search);
    const groupMatch = (item.group?.title || '').toLowerCase().includes(search);
    const skuMatch = (item.sku || '').toLowerCase().includes(search);
    const priceMatch = (item.price || '').toLowerCase().includes(search);
    const totalPriceMatch = (item.totalPrice || '').toLowerCase().includes(search);
    const quantityMatch = (item.quantity || '').toString().toLowerCase().includes(search);
    const statusMatch = (item.printStatus || '').toLowerCase().includes(search);
    const detectVibeMatch = (item.detectVibe || '').toLowerCase().includes(search);
    
    return nameMatch || groupMatch || skuMatch || priceMatch || totalPriceMatch || 
           quantityMatch || statusMatch || detectVibeMatch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#f5f6f8]" style={{ fontFamily: MONDAY_FONT }}>
        <Loader2 className="w-8 h-8 animate-spin text-[#676879]" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#f5f6f8]" style={{ fontFamily: MONDAY_FONT }}>
      {/* Toolbar - monday.com style */}
      <div className="px-6 py-2.5 bg-white border-b border-[#e6e9ef]">
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#676879]" />
            <input
              type="text"
              placeholder="Search all columns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-8 w-full rounded-[4px] border border-[#d0d4e4] bg-white px-3 text-[13px] leading-none text-[#323338] placeholder:text-[#9699a6] focus:outline-none focus:border-[#0073ea] focus:shadow-[0_0_0_1px_#0073ea]"
            />
          </div>
          <button
            onClick={loadItems}
            className="h-8 px-3 rounded-[4px] border border-[#d0d4e4] bg-white text-[13px] text-[#323338] hover:bg-[#f5f6f8] flex items-center gap-1.5 transition-all"
            title="Refresh data from board"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <div className="text-[11px] text-[#9699a6] ml-2">
            Auto-syncing every 5s • Read-only
          </div>
        </div>
      </div>

      {/* Table wrapper */}
      <div className="flex-1 overflow-auto px-6 pt-5 pb-6">
        {filteredItems.length === 0 ? (
          <div className="flex items-center justify-center h-64 bg-white rounded-[8px] border border-[#e6e9ef]">
            <p className="text-[13px] text-[#676879]">
              {searchTerm ? 'No items match your search' : 'No items found'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-[8px] border border-[#e6e9ef] overflow-hidden">
            {/* Group header */}
            <div className="flex items-center gap-2 px-4 h-9 bg-white border-l-[4px] border-l-[#00c875]">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="text-[#676879] flex-shrink-0">
                <path d="M3 6L6 9L9 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-[13px] font-semibold text-[#00c875]">Group Title</span>
              <span className="text-[12px] text-[#9699a6]">{filteredItems.length} items</span>
            </div>

            {/* Table */}
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#f5f6f8] sticky top-0 z-10">
                  <th className="h-9 px-4 text-left font-medium text-[#676879] border-b border-r border-[#e6e9ef] w-11">
                    <label className="flex items-center">
                      <input type="checkbox" className="w-4 h-4 rounded-[3px] border-[#c3c6d4] accent-[#0073ea]" disabled />
                      <span className="sr-only">Select all items</span>
                    </label>
                  </th>
                  <th className="h-9 px-4 text-left font-medium text-[#676879] border-b border-r border-[#e6e9ef] min-w-[220px] tracking-normal">
                    Item
                  </th>
                  <th className="h-9 px-4 text-left font-medium text-[#676879] border-b border-r border-[#e6e9ef] w-[130px]">
                    SKU
                  </th>
                  <th className="h-9 px-4 text-left font-medium text-[#676879] border-b border-r border-[#e6e9ef] w-[130px]">
                    Price
                  </th>
                  <th className="h-9 px-4 text-left font-medium text-[#676879] border-b border-r border-[#e6e9ef] w-[130px]">
                    Total Price
                  </th>
                  <th className="h-9 px-4 text-left font-medium text-[#676879] border-b border-r border-[#e6e9ef] w-[140px]">
                    Print Status
                  </th>
                  <th className="h-9 px-4 text-center font-medium text-[#676879] border-b border-r border-[#e6e9ef] w-[110px]">
                    Quantity
                  </th>
                  <th className="h-9 px-4 text-left font-medium text-[#676879] border-b border-r border-[#e6e9ef] w-[120px]">
                    Detect Vibe
                  </th>
                  <th className="h-9 px-4 text-center font-medium text-[#676879] border-b border-[#e6e9ef] w-[130px]">
                    Print
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isPrinting = printingItems.has(item.id);

                  return (
                    <tr
                      key={item.id}
                      className="group hover:bg-[#f5f6f8] transition-colors"
                    >
                      <td className="h-9 px-4 border-b border-r border-[#e6e9ef]">
                        <input type="checkbox" className="w-4 h-4 rounded-[3px] border-[#c3c6d4] accent-[#0073ea]" disabled aria-label={`Select ${item.name || 'item'}`} />
                      </td>
                      <td className="h-9 px-4 text-[#323338] border-b border-r border-[#e6e9ef] truncate">
                        {item.name || '-'}
                      </td>
                      <td className="h-9 px-4 text-[#323338] border-b border-r border-[#e6e9ef]">
                        {item.sku || '-'}
                      </td>
                      <td className="h-9 px-4 text-[#323338] border-b border-r border-[#e6e9ef]">
                        {item.price || '-'}
                      </td>
                      <td className="h-9 px-4 text-[#323338] border-b border-r border-[#e6e9ef]">
                        {item.totalPrice || '-'}
                      </td>
                      <td className="h-9 px-2 border-b border-r border-[#e6e9ef]">
                        <div className={`inline-flex items-center justify-center h-full w-full px-2 text-[13px] font-medium ${
                          item.printStatus === 'Printed'
                            ? 'bg-[#00c875] text-white'
                            : 'bg-[#c4c4c4] text-white'
                        }`}>
                          {item.printStatus || 'Not Printed'}
                        </div>
                      </td>
                      <td className="h-9 px-4 text-center text-[#323338] border-b border-r border-[#e6e9ef]">
                        {item.quantity || '1'}
                      </td>
                      <td className="h-9 px-4 text-[#323338] border-b border-r border-[#e6e9ef]">
                        {item.detectVibe ? (
                          <span className="inline-flex items-center justify-center px-2 py-1 text-[12px] font-medium bg-[#e2e5e9] text-[#323338] rounded-sm">
                            {item.detectVibe}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="h-9 px-3 text-center border-b border-[#e6e9ef]">
                        <button
                          onClick={() => printItem(item.id)}
                          disabled={isPrinting}
                          className="inline-flex items-center justify-center gap-1.5 h-7 px-3 rounded-[4px] bg-[#0073ea] text-white text-[13px] font-medium hover:bg-[#0060b9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isPrinting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Printing...
                            </>
                          ) : (
                            <>
                              <Printer className="w-3.5 h-3.5" />
                              Print
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
