/**
 * @fileoverview In-memory state cache with debounced chrome.storage persistence.
 *
 * Features:
 * - Deep merge with {@link DEFAULT_STATE} on init (handles missing fields).
 * - Dot-notation get / set (`'wallpaper.overlay'`).
 * - Path-based subscriptions that fire only on relevant changes.
 * - Debounced persistence (300 ms by default).
 * - State migration support via `_version` check.
 *
 * @module core/state
 *
 * @example
 * import { initState, getState, setState, subscribe } from './state.js';
 *
 * await initState();
 * subscribe('wallpaper.overlay', (value) => applyOverlay(value));
 * setState('wallpaper.overlay', 0.5);
 * console.log(getState('wallpaper.overlay')); // 0.5
 */

import { DEFAULT_STATE, STORAGE_KEY, DEBOUNCE_MS, STATE_VERSION, EVENT_PREFIX } from './constants.js';
import { loadJSON, saveJSON } from './storage.js';
import { emit } from './events.js';

/* ═══════════════════════════════════════════════════════════════════════
 *  Internal helpers
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Deep-merge `source` into `target`. Only plain objects are merged
 * recursively; arrays and primitives in `source` overwrite `target`.
 *
 * @param {object} target - Base object (mutated in-place).
 * @param {object} source - Object whose values take precedence.
 * @returns {object} The mutated `target`.
 */
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];

    if (
      srcVal !== null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal)
    ) {
      deepMerge(tgtVal, srcVal);
    } else {
      target[key] = srcVal;
    }
  }
  return target;
}

/**
 * Create a mutable deep clone of a frozen/nested object.
 * Uses structuredClone where available, falling back to JSON round-trip.
 *
 * @param {*} obj
 * @returns {*}
 */
function clone(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  try {
    return structuredClone(obj);
  } catch {
    return JSON.parse(JSON.stringify(obj));
  }
}

/**
 * Resolve a dot-notation path against an object.
 *
 * @param {object} obj
 * @param {string} path - e.g. `'wallpaper.overlay'`
 * @returns {*} Value at path, or `undefined` if the path doesn't exist.
 */
function getByPath(obj, path) {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[key];
  }
  return current;
}

/**
 * Set a value at a dot-notation path, creating intermediate objects as needed.
 *
 * @param {object} obj
 * @param {string} path
 * @param {*} value
 */
function setByPath(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] == null || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Migrations
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Registry of migration functions keyed by *target* version.
 * Each function receives the state object and mutates it in-place.
 *
 * @type {Record<number, (state: object) => void>}
 *
 * @example
 * // When bumping STATE_VERSION to 2, add:
 * // migrations[2] = (state) => { state.newField = 'default'; };
 */
const migrations = {};

/**
 * Run any pending migrations sequentially.
 * @param {object} state
 * @returns {object} Migrated state.
 */
function migrate(state) {
  let version = state._version ?? 0;
  while (version < STATE_VERSION) {
    version++;
    if (typeof migrations[version] === 'function') {
      try {
        migrations[version](state);
      } catch (err) {
        console.error(`[state] Migration to v${version} failed:`, err);
      }
    }
    state._version = version;
  }
  return state;
}

/* ═══════════════════════════════════════════════════════════════════════
 *  State singleton
 * ═══════════════════════════════════════════════════════════════════════ */

/** @type {object|null} Current in-memory state */
let state = null;

/** @type {number|null} Debounce timer id for persistence */
let persistTimer = null;

/** @type {Map<string, Set<Function>>} Path-based subscribers */
const subscribers = new Map();

/**
 * Schedule a debounced persist of the entire state to chrome.storage.local.
 */
function schedulePersist() {
  if (persistTimer != null) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    persistTimer = null;
    try {
      await saveJSON(STORAGE_KEY, state);
    } catch (err) {
      console.error('[state] Persist failed:', err);
    }
  }, DEBOUNCE_MS);
}

/**
 * Notify all subscribers whose path is a prefix of (or equal to) the
 * changed path, and vice-versa.
 *
 * For example, changing `'wallpaper.overlay'` notifies subscribers of
 * `'wallpaper.overlay'` AND `'wallpaper'` (parent), but also
 * specific children if someone subscribes to a sub-path.
 *
 * @param {string} changedPath
 */
function notifySubscribers(changedPath) {
  for (const [subPath, callbacks] of subscribers) {
    // Fire if the changed path starts with the subscribed path or vice-versa
    if (changedPath.startsWith(subPath) || subPath.startsWith(changedPath)) {
      const value = getByPath(state, subPath);
      for (const cb of callbacks) {
        try {
          cb(value);
        } catch (err) {
          console.error(`[state] Subscriber error for "${subPath}":`, err);
        }
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Public API
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Initialise the state cache.
 *
 * Loads persisted state from chrome.storage.local, deep-merges with
 * {@link DEFAULT_STATE} to fill any missing fields, and runs migrations
 * if the stored `_version` is behind {@link STATE_VERSION}.
 *
 * Must be called once at startup before any other state operations.
 *
 * @returns {Promise<object>} The initialised state.
 */
export async function initState() {
  const stored = await loadJSON(STORAGE_KEY);

  // Start from a mutable clone of defaults
  state = clone(DEFAULT_STATE);

  if (stored && typeof stored === 'object') {
    // Merge stored values on top of defaults
    deepMerge(state, stored);

    // Run migrations if version is outdated
    if ((state._version ?? 0) < STATE_VERSION) {
      migrate(state);
      schedulePersist(); // persist migrated state
    }
  } else {
    // First launch — persist defaults
    schedulePersist();
  }

  emit(`${EVENT_PREFIX}:state:init`, state);
  return state;
}

/**
 * Get the full state or a value at a dot-notation path.
 *
 * @param {string} [path] - Dot-notation path (e.g. `'settings.clockFormat'`).
 * @returns {*} The state value, or `undefined` if the path doesn't resolve.
 * @throws {Error} If called before {@link initState}.
 */
export function getState(path) {
  if (state === null) {
    throw new Error('[state] getState called before initState()');
  }
  if (!path) return state;
  return getByPath(state, path);
}

/**
 * Set a value at a dot-notation path.
 *
 * Triggers a debounced persist and emits a change event on the event bus.
 *
 * @param {string} path - Dot-notation path (e.g. `'wallpaper.blur'`).
 * @param {*} value - New value.
 * @returns {void}
 * @throws {Error} If called before {@link initState}.
 */
export function setState(path, value) {
  if (state === null) {
    throw new Error('[state] setState called before initState()');
  }
  if (typeof path !== 'string' || path.length === 0) {
    throw new TypeError('[state] setState requires a non-empty path string');
  }

  setByPath(state, path, value);

  // Emit a namespaced event (e.g. `zenith:state:wallpaper.blur`)
  emit(`${EVENT_PREFIX}:state:${path}`, value);

  // Notify path-based subscribers
  notifySubscribers(path);

  // Schedule persistence
  schedulePersist();
}

/**
 * Subscribe to changes at a specific state path.
 *
 * The callback is invoked with the current value at `path` whenever
 * that path (or an ancestor/descendant) is modified via {@link setState}.
 *
 * @param {string} path - Dot-notation path to watch.
 * @param {Function} callback - Handler receiving the new value.
 * @returns {Function} Unsubscribe function.
 */
export function subscribe(path, callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('[state] subscribe callback must be a function');
  }

  let set = subscribers.get(path);
  if (!set) {
    set = new Set();
    subscribers.set(path, set);
  }
  set.add(callback);

  // Return unsubscribe function for convenience
  return () => {
    set.delete(callback);
    if (set.size === 0) subscribers.delete(path);
  };
}
