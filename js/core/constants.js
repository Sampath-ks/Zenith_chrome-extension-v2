/**
 * @fileoverview App-wide constants for the Zenith Chrome Extension.
 * @module core/constants
 */

/** @type {string} Application name */
export const APP_NAME = 'Zenith';

/** @type {number} Current state schema version (bump when migrating) */
export const STATE_VERSION = 1;

/** @type {string} Key used in chrome.storage.local for persisted state */
export const STORAGE_KEY = 'zenith-state';

/* ── IndexedDB configuration ─────────────────────────────────────────── */

/** @type {string} IndexedDB database name */
export const IDB_NAME = 'zenith-blobs';

/** @type {string} IndexedDB object-store name for wallpaper blobs */
export const IDB_STORE = 'wallpapers';

/** @type {number} IndexedDB schema version */
export const IDB_VERSION = 1;

/* ── Tile sizes ───────────────────────────────────────────────────────── */

/**
 * Predefined tile dimensions (px).
 * @type {{ small: number, medium: number, large: number }}
 */
export const TILE_SIZES = Object.freeze({
  small: 64,
  medium: 96,
  large: 140,
});

/* ── Default application state ────────────────────────────────────────── */

/**
 * Full default state shape.
 * Used as the seed on first launch and as the merge-base for missing fields.
 * @type {object}
 */
export const DEFAULT_STATE = Object.freeze({
  _version: STATE_VERSION,
  wallpaper: Object.freeze({
    type: 'image',
    activeId: null,
    gradient: null,
    overlay: 0.3,
    blur: 0,
    customList: [], // Library of custom backgrounds
  }),
  tiles: [],
  savedLayouts: [],
  settings: Object.freeze({
    timeVisible: true,
    greetingEnabled: false,
    greetingName: '',
    clockFormat: '12h',
    dockPosition: 'right',
    snapGrid: false,
    snapGridSize: 20,
    performanceMode: false,
  }),
  today: Object.freeze({
    date: '',           // 'YYYY-MM-DD' — used for daily reset detection
    tasks: [],          // [{ id: string, text: string, completed: boolean }]
    note: '',           // Quick note text
  }),
  onboarding: Object.freeze({
    tutorialCompleted: false, // Set to true after completing the 2-step tutorial
  }),
  monetization: Object.freeze({
    lastDonationPrompt: null, // Timestamp of last prompt (ms)
  }),
});

/* ── Media limits ─────────────────────────────────────────────────────── */

/** @type {number} Hard cap for uploaded video files (MB) */
export const MAX_VIDEO_SIZE_MB = 150;

/** @type {number} Threshold that triggers a size warning (MB) */
export const VIDEO_WARNING_SIZE_MB = 50;

/** @type {number} Maximum pixel dimension (width or height) for images */
export const MAX_IMAGE_DIMENSION = 3840;

/** @type {number} JPEG / WebP quality factor (0–1) */
export const IMAGE_QUALITY = 0.85;

/* ── Timing ───────────────────────────────────────────────────────────── */

/** @type {number} Default debounce delay for state persistence (ms) */
export const DEBOUNCE_MS = 300;

/* ── Events ───────────────────────────────────────────────────────────── */

/** @type {string} Prefix for all custom event names (`zenith:{feature}:{action}`) */
export const EVENT_PREFIX = 'zenith';

/* ── Bundled assets ───────────────────────────────────────────────────── */

/**
 * Relative paths to wallpapers shipped with the extension.
 * @type {string[]}
 */
export const BUNDLED_WALLPAPERS = Object.freeze([
  'assets/wallpapers/default-01.jpg',
  'assets/wallpapers/default-02.jpg',
  'assets/wallpapers/default-03.jpg',
]);

/**
 * Curated list of dark, cinematic gradient presets for OLED screens.
 * @type {string[]}
 */
export const GRADIENT_PRESETS = Object.freeze([
  'linear-gradient(135deg, #09090b 0%, #000000 100%)', // OLED Obsidian
  'linear-gradient(135deg, #0f0c20 0%, #030206 100%)', // Cosmic Indigo
  'linear-gradient(135deg, #05161c 0%, #010405 100%)', // Abyssal Blue
  'linear-gradient(135deg, #0c1810 0%, #010402 100%)', // Emerald Shadows
  'linear-gradient(135deg, #1c0e0e 0%, #040101 100%)', // Crimson Twilight
  'linear-gradient(135deg, #120b1c 0%, #030206 100%)', // Violet Eclipse
]);

