/**
 * @fileoverview Storage abstraction for the Zenith extension.
 *
 * Provides two layers:
 * - **chrome.storage.local** — small JSON state via {@link loadJSON} / {@link saveJSON}.
 * - **IndexedDB** — large binary blobs (wallpapers, videos) via
 *   {@link loadBlob}, {@link saveBlob}, {@link deleteBlob}, {@link listBlobKeys}.
 *
 * All public methods return Promises and handle common edge-cases
 * (storage unavailable, quota exceeded, missing object stores).
 *
 * @module core/storage
 */

import { IDB_NAME, IDB_STORE, IDB_VERSION } from './constants.js';

/* ═══════════════════════════════════════════════════════════════════════
 *  chrome.storage.local helpers
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Detect whether the Chrome extension storage API is available.
 * @returns {boolean}
 */
function hasChromeStorage() {
  return (
    typeof chrome !== 'undefined' &&
    chrome.storage &&
    typeof chrome.storage.local?.get === 'function'
  );
}

/**
 * Read a JSON value from chrome.storage.local.
 *
 * Falls back to localStorage when the API is unavailable (e.g. local dev).
 *
 * @param {string} key - Storage key.
 * @returns {Promise<*>} Resolved value, or `null` if not found.
 */
export async function loadJSON(key) {
  if (!hasChromeStorage()) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error(`[storage] localStorage loadJSON("${key}") failed:`, err);
      return null;
    }
  }
  try {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  } catch (err) {
    console.error(`[storage] loadJSON("${key}") failed:`, err);
    return null;
  }
}

/**
 * Write a JSON value to chrome.storage.local.
 *
 * Falls back to localStorage when the API is unavailable (e.g. local dev).
 *
 * @param {string} key - Storage key.
 * @param {*} data - JSON-serialisable value.
 * @returns {Promise<void>}
 * @throws {Error} On quota exceeded or other write failures.
 */
export async function saveJSON(key, data) {
  if (!hasChromeStorage()) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.error(`[storage] localStorage saveJSON("${key}") failed:`, err);
    }
    return;
  }
  try {
    await chrome.storage.local.set({ [key]: data });
  } catch (err) {
    // Surface quota errors clearly
    if (err?.message?.includes('QUOTA_BYTES')) {
      console.error(`[storage] Quota exceeded writing key "${key}"`);
    }
    throw err;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 *  IndexedDB helpers
 * ═══════════════════════════════════════════════════════════════════════ */

/** @type {IDBDatabase|null} Cached database handle */
let dbCache = null;

/**
 * Open (or return cached) IndexedDB database.
 * Creates the object store on first run or version upgrade.
 *
 * @returns {Promise<IDBDatabase>}
 */
function getIDB() {
  if (dbCache) return Promise.resolve(dbCache);

  return new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDB.open(IDB_NAME, IDB_VERSION);
    } catch (err) {
      reject(new Error(`[storage] IndexedDB.open failed: ${err.message}`));
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };

    request.onsuccess = () => {
      dbCache = request.result;

      // Reset cache if the connection is unexpectedly closed
      dbCache.onclose = () => { dbCache = null; };
      dbCache.onversionchange = () => {
        dbCache.close();
        dbCache = null;
      };

      resolve(dbCache);
    };

    request.onerror = () =>
      reject(new Error(`[storage] IndexedDB open error: ${request.error?.message}`));
  });
}

/**
 * Wrap an IDBRequest in a Promise.
 * @param {IDBRequest} request
 * @returns {Promise<*>}
 */
function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Read a blob from IndexedDB by id.
 *
 * @param {string} id - Unique blob identifier.
 * @returns {Promise<Blob|null>} The stored blob, or `null` if not found.
 */
export async function loadBlob(id) {
  try {
    const db = await getIDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const result = await idbRequest(tx.objectStore(IDB_STORE).get(id));
    return result ?? null;
  } catch (err) {
    console.error(`[storage] loadBlob("${id}") failed:`, err);
    return null;
  }
}

/**
 * Store a blob in IndexedDB.
 *
 * @param {string} id - Unique blob identifier.
 * @param {Blob} blob - The binary data to store.
 * @returns {Promise<void>}
 * @throws {Error} On quota exceeded or write failure.
 */
export async function saveBlob(id, blob) {
  try {
    const db = await getIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    await idbRequest(tx.objectStore(IDB_STORE).put(blob, id));
  } catch (err) {
    if (err?.name === 'QuotaExceededError') {
      console.error(`[storage] IndexedDB quota exceeded saving blob "${id}"`);
    }
    throw err;
  }
}

/**
 * Delete a blob from IndexedDB.
 *
 * @param {string} id - Blob identifier to remove.
 * @returns {Promise<void>}
 */
export async function deleteBlob(id) {
  try {
    const db = await getIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    await idbRequest(tx.objectStore(IDB_STORE).delete(id));
  } catch (err) {
    console.error(`[storage] deleteBlob("${id}") failed:`, err);
  }
}

/**
 * List all keys stored in the blob object store.
 *
 * @returns {Promise<string[]>} Array of blob identifiers.
 */
export async function listBlobKeys() {
  try {
    const db = await getIDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const keys = await idbRequest(tx.objectStore(IDB_STORE).getAllKeys());
    return /** @type {string[]} */ (keys);
  } catch (err) {
    console.error('[storage] listBlobKeys() failed:', err);
    return [];
  }
}
