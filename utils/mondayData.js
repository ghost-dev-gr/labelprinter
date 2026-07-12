// mondayData.js
// Replacement for monday.com board metadata storage (label templates), backed by a real
// file (db/store.json) via the dev server's /api/storage route (see vite.config.js).

function storageKey(boardId) {
  return `label_template_${boardId}`;
}

export async function loadTemplate(boardId) {
  try {
    const res = await fetch(`/api/storage?key=${encodeURIComponent(storageKey(boardId))}`);
    const json = await res.json();
    return json.value ? JSON.parse(json.value) : null;
  } catch (err) {
    console.error('[mondayData] Failed to load template:', err);
    return null;
  }
}

export async function saveTemplate(boardId, template) {
  try {
    await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: storageKey(boardId), value: JSON.stringify(template) }),
    });
  } catch (err) {
    console.error('[mondayData] Failed to save template:', err);
    throw err;
  }
}
