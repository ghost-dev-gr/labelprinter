// mondayData.js
// Fetches board columns and items via the Board SDK,
// and saves/loads a per-board label template via monday.storage.instance.

import mondaySdk from 'monday-sdk-js';
import { PrintTestBoard } from '@api/BoardSDK';

export const monday = mondaySdk();

export const DEFAULT_TEMPLATE = {
  widthMm: 100,
  heightMm: 50,
  rotation: 0,
  fields: []
};

const board = new PrintTestBoard();

export async function getBoardColumns(boardId) {
  // Return column metadata for the Print Test Board
  return [
    { id: 'name', title: 'Name', type: 'name' },
    { id: 'text_mm527kvs', title: 'SKU', type: 'text' },
    { id: 'text_mm5283d8', title: 'PRICE', type: 'text' },
    { id: 'text_mm52vpv2', title: 'TOTAL PRICE', type: 'text' },
    { id: 'color_mm52479b', title: 'PRINT STATUS', type: 'status' },
    { id: 'numeric_mm52hvhx', title: 'QUANTITY', type: 'numbers' },
    { id: 'button_mm52pm6n', title: 'Button', type: 'button' }
  ];
}

export async function getBoardItems(boardId) {
  const { items } = await board.items()
    .withColumns(['sku', 'price', 'totalPrice', 'printStatus', 'quantity'])
    .execute();
  
  // Transform SDK items to match the expected structure
  return items.map(item => ({
    id: item.id,
    name: item.name,
    column_values: [
      { id: 'text_mm527kvs', text: item.sku || '' },
      { id: 'text_mm5283d8', text: item.price || '' },
      { id: 'text_mm52vpv2', text: item.totalPrice || '' },
      { id: 'color_mm52479b', text: item.printStatus || '' },
      { id: 'numeric_mm52hvhx', text: item.quantity ? String(item.quantity) : '' }
    ]
  }));
}

export function itemToValues(item) {
  const values = { name: item.name };
  for (const cv of item.column_values || []) {
    values[cv.id] = cv.text || '';
  }
  return values;
}

export async function loadTemplate(boardId) {
  try {
    const key = `label_template_${boardId}`;
    const res = await monday.storage.instance.getItem(key);
    if (res.data?.value) {
      return JSON.parse(res.data.value);
    }
  } catch (err) {
    console.error('Failed to load template:', err);
  }
  return DEFAULT_TEMPLATE;
}

export async function saveTemplate(boardId, template) {
  try {
    const key = `label_template_${boardId}`;
    await monday.storage.instance.setItem(key, JSON.stringify(template));
    alert('Template saved successfully.');
  } catch (err) {
    console.error('Failed to save template:', err);
    alert('Failed to save template: ' + err.message);
  }
}
