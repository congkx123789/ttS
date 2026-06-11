// Safe localStorage/sessionStorage polyfill for sandboxed or cross-origin iframes
try {
  const testVal = window.localStorage;
  if (!testVal) {
    throw new Error('localStorage is null');
  }
  // Try writing/reading to trigger security restrictions early
  const testKey = '__storage_test__';
  window.localStorage.setItem(testKey, testKey);
  window.localStorage.removeItem(testKey);
} catch (e) {
  console.warn('[Storage Polyfill] localStorage is blocked or throws an error. Using in-memory fallback.', e);
  const memoryStorage = {};
  const mockStorage = {
    getItem: (key) => (key in memoryStorage ? memoryStorage[key] : null),
    setItem: (key, value) => { memoryStorage[key] = String(value); },
    removeItem: (key) => { delete memoryStorage[key]; },
    clear: () => {
      for (const k in memoryStorage) {
        delete memoryStorage[k];
      }
    },
    key: (index) => Object.keys(memoryStorage)[index] || null,
    get length() {
      return Object.keys(memoryStorage).length;
    }
  };
  try {
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true
    });
  } catch (err) {
    console.error('[Storage Polyfill] Failed to redefine window.localStorage:', err);
  }
}

try {
  const testVal = window.sessionStorage;
  if (!testVal) {
    throw new Error('sessionStorage is null');
  }
  const testKey = '__session_storage_test__';
  window.sessionStorage.setItem(testKey, testKey);
  window.sessionStorage.removeItem(testKey);
} catch (e) {
  console.warn('[Storage Polyfill] sessionStorage is blocked or throws an error. Using in-memory fallback.', e);
  const memoryStorage = {};
  const mockStorage = {
    getItem: (key) => (key in memoryStorage ? memoryStorage[key] : null),
    setItem: (key, value) => { memoryStorage[key] = String(value); },
    removeItem: (key) => { delete memoryStorage[key]; },
    clear: () => {
      for (const k in memoryStorage) {
        delete memoryStorage[k];
      }
    },
    key: (index) => Object.keys(memoryStorage)[index] || null,
    get length() {
      return Object.keys(memoryStorage).length;
    }
  };
  try {
    Object.defineProperty(window, 'sessionStorage', {
      value: mockStorage,
      writable: true,
      configurable: true
    });
  } catch (err) {
    console.error('[Storage Polyfill] Failed to redefine window.sessionStorage:', err);
  }
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
