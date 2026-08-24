/**
 * @fileoverview Lightweight custom event bus for the Zenith extension.
 *
 * Event names follow the convention `zenith:{feature}:{action}`.
 *
 * @module core/events
 *
 * @example
 * import { on, off, emit } from './events.js';
 *
 * const handler = (data) => console.log('wallpaper changed', data);
 * on('zenith:wallpaper:change', handler);
 * emit('zenith:wallpaper:change', { id: 'abc' });
 * off('zenith:wallpaper:change', handler);
 */

/** @type {Map<string, Set<Function>>} Internal registry */
const listeners = new Map();

/**
 * Subscribe to an event.
 * @param {string} eventName - Event name (e.g. `'zenith:state:change'`).
 * @param {Function} callback - Handler invoked with emitted data.
 * @returns {void}
 */
export function on(eventName, callback) {
  if (typeof callback !== 'function') {
    throw new TypeError(`events.on: callback must be a function, got ${typeof callback}`);
  }
  let set = listeners.get(eventName);
  if (!set) {
    set = new Set();
    listeners.set(eventName, set);
  }
  set.add(callback);
}

/**
 * Unsubscribe from an event.
 * @param {string} eventName - Event name.
 * @param {Function} callback - Previously registered handler.
 * @returns {boolean} `true` if the callback was found and removed.
 */
export function off(eventName, callback) {
  const set = listeners.get(eventName);
  if (!set) return false;
  const deleted = set.delete(callback);
  if (set.size === 0) listeners.delete(eventName);
  return deleted;
}

/**
 * Emit an event, invoking all registered callbacks synchronously.
 * @param {string} eventName - Event name.
 * @param {*} [data] - Payload passed to each callback.
 * @returns {void}
 */
export function emit(eventName, data) {
  const set = listeners.get(eventName);
  if (!set) return;
  for (const cb of set) {
    try {
      cb(data);
    } catch (err) {
      console.error(`[events] Error in listener for "${eventName}":`, err);
    }
  }
}
