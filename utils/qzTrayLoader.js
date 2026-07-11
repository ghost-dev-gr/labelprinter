// qzTrayLoader.js
// Dynamically loads QZ Tray library if not already present
export function loadQzTray() {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.qz) {
      resolve(window.qz);
      return;
    }

    // Check if script is already being loaded
    const existing = document.querySelector('script[src*="qz-tray"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.qz));
      existing.addEventListener('error', reject);
      return;
    }

    // Load the script
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.min.js';
    script.async = true;
    
    script.onload = () => {
      if (window.qz) {
        console.log('QZ Tray library loaded successfully');
        resolve(window.qz);
      } else {
        reject(new Error('QZ Tray loaded but window.qz not found'));
      }
    };
    
    script.onerror = () => {
      reject(new Error('Failed to load QZ Tray library'));
    };

    document.head.appendChild(script);
  });
}

// Auto-load on module import
let loadPromise = null;

export function ensureQzTrayLoaded() {
  if (!loadPromise) {
    loadPromise = loadQzTray();
  }
  return loadPromise;
}
