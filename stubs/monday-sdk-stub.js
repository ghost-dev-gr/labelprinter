// monday-sdk-stub.js
// Local replacement for the 'monday-sdk-js' package (aliased in vite.config.js) so the app
// can run standalone in a normal browser tab instead of inside a monday.com board iframe.
// Storage calls are backed by a real file (db/store.json) via the dev server's /api/storage
// route (see localDbPlugin in vite.config.js); everything else is a harmless no-op/log.

async function storageGetItem(key) {
  try {
    const res = await fetch(`/api/storage?key=${encodeURIComponent(key)}`);
    const json = await res.json();
    return { data: { value: json.value } };
  } catch (err) {
    console.error('[monday-sdk-stub] storage.getItem failed:', err);
    return { data: { value: null } };
  }
}

async function storageSetItem(key, value) {
  try {
    await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    return { data: { success: true } };
  } catch (err) {
    console.error('[monday-sdk-stub] storage.setItem failed:', err);
    return { data: { success: false } };
  }
}

function createClient() {
  return {
    execute(type, payload) {
      console.log(`[monday-sdk-stub] execute("${type}")`, payload);
      return Promise.resolve({ data: {} });
    },
    listen(type) {
      console.log(`[monday-sdk-stub] listen("${type}") registered — no monday events fire locally`);
      return () => {};
    },
    get(type) {
      console.log(`[monday-sdk-stub] get("${type}")`);
      return Promise.resolve({ data: {} });
    },
    api(query, options) {
      console.log('[monday-sdk-stub] api()', query, options);
      return Promise.resolve({ data: {} });
    },
    storage: {
      instance: {
        getItem: storageGetItem,
        setItem: storageSetItem,
      },
    },
  };
}

export default function monday() {
  return createClient();
}
