/**
 * Zenith — Tile System Controller
 *
 * Manages the shortcut tiles grid. Performs selective DOM reconciliation,
 * setups pointer event dragging and resizing, and triggers favicon resolution.
 *
 * @module features/tiles/tiles
 */

import { getState, setState, subscribe } from '../../core/state.js';
import { $, createElement } from '../../core/dom.js';
import { setupDraggable } from './drag.js';
import { setupResizable } from './resize.js';

/* ------------------------------------------------------------------ */
/*  Internal references                                               */
/* ------------------------------------------------------------------ */

/** @type {HTMLElement|null} Container element */
let containerEl = null;

/* ------------------------------------------------------------------ */
/*  Favicon resolution                                                */
/* ------------------------------------------------------------------ */

/**
 * Extract clean hostname from a URL.
 *
 * @param {string} urlString
 * @returns {string}
 */
function getHostname(urlString) {
  try {
    return new URL(urlString).hostname;
  } catch (e) {
    return urlString;
  }
}

/**
 * Extract the first letter of domain/title for fallbacks.
 *
 * @param {string} url
 * @param {string} title
 * @returns {string}
 */
function getLetterFallback(url, title) {
  if (title && title.trim().length > 0) {
    return title.trim().charAt(0).toUpperCase();
  }
  const hostname = getHostname(url);
  return hostname.charAt(0).toUpperCase();
}

/**
 * Resolve a favicon using the hybrid strategy:
 * 1. Google Favicon service (primary for robust cross-origin fetching)
 * 2. Fallback to direct /favicon.ico
 * 3. Fallback to null (triggers letter icon)
 *
 * @param {string} url
 * @returns {Promise<string|null>} The resolved favicon URL or null.
 */
export async function resolveFavicon(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const cleanUrl = `${parsed.protocol}//${parsed.hostname}`;
      
      // Google gstatic faviconV2 API is excellent for high-res touch-icons (128x128)
      const primaryUrl = `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(cleanUrl)}&size=128`;
      const fallbackUrl = `https://www.google.com/s2/favicons?sz=128&domain=${parsed.hostname}`;

      const img = new Image();
      img.onload = () => resolve(primaryUrl);
      img.onerror = () => {
        const fallbackImg = new Image();
        fallbackImg.onload = () => resolve(fallbackUrl);
        fallbackImg.onerror = () => resolve(null);
        fallbackImg.src = fallbackUrl;
      };
      img.src = primaryUrl;
    } catch (err) {
      resolve(null);
    }
  });
}

/**
 * Append letter fallback element into a wrapper.
 *
 * @param {HTMLElement} wrapper
 * @param {string} url
 * @param {string} title
 */
function appendLetterFallback(wrapper, url, title) {
  wrapper.innerHTML = '';
  const letter = getLetterFallback(url, title);
  const fallback = createElement('div', {
    className: 'tile__letter-fallback',
    textContent: letter,
  });
  wrapper.appendChild(fallback);
}

/**
 * Build and insert favicon image with robust error handling fallback.
 *
 * @param {HTMLElement} wrapper - Favicon wrapper element.
 * @param {string} faviconUrl - Image source URL.
 * @param {string} url - Tile navigation URL.
 * @param {string} title - Tile display title.
 */
function appendFaviconImage(wrapper, faviconUrl, url, title) {
  wrapper.innerHTML = '';
  const favImg = createElement('img', {
    className: 'tile__favicon',
    src: faviconUrl,
    alt: '',
    draggable: 'false',
  });
  
  // If the image fails to load (broken link, offline, CORS, 404), replace with letter
  favImg.onerror = () => {
    appendLetterFallback(wrapper, url, title);
  };
  
  wrapper.appendChild(favImg);
}

/* ------------------------------------------------------------------ */
/*  Tile DOM Creation                                                 */
/* ------------------------------------------------------------------ */

/**
 * Create a single Tile DOM element.
 *
 * @param {object} tile - The tile state object.
 * @returns {HTMLElement}
 */
function createTileEl(tile) {
  const width = tile.width || 96;
  const height = tile.height || 96;
  
  const tileEl = createElement('div', {
    className: 'zenith-tile',
    'data-id': tile.id,
    tabIndex: 0, // Make focusable via Tab
  });

  // Size constraints and coordinates set via custom CSS properties
  tileEl.style.setProperty('--tile-x', `${tile.x || 100}px`);
  tileEl.style.setProperty('--tile-y', `${tile.y || 100}px`);
  tileEl.style.setProperty('--tile-width', `${width}px`);
  tileEl.style.setProperty('--tile-height', `${height}px`);
  
  // Initial title hiding check
  tileEl.classList.toggle('zenith-tile--no-title', height < 64);

  // Favicon Wrapper
  const favWrapper = createElement('div', { className: 'tile__favicon-wrapper' });
  if (tile.favicon) {
    appendFaviconImage(favWrapper, tile.favicon, tile.url, tile.title);
  } else {
    appendLetterFallback(favWrapper, tile.url, tile.title);
  }
  tileEl.appendChild(favWrapper);

  // Title
  const titleEl = createElement('div', {
    className: 'tile__title',
    textContent: tile.title || getHostname(tile.url),
    title: tile.title || tile.url,
  });
  tileEl.appendChild(titleEl);

  // Controls (Delete only - resize is drag-based now)
  const controlsEl = createElement('div', { className: 'tile__controls' });
  
  const deleteBtn = createElement('button', {
    className: 'tile__btn tile__btn--delete',
    textContent: '×',
    title: 'Delete',
  });
  controlsEl.appendChild(deleteBtn);
  tileEl.appendChild(controlsEl);

  // Free-form Drag-to-Resize Handle
  const resizeHandleEl = createElement('div', {
    className: 'tile__resize-handle',
    title: 'Drag to Resize',
  });
  tileEl.appendChild(resizeHandleEl);

  // -- Event Bindings --

  // Delete Click Handler
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    if (confirm(`Remove "${tile.title || tile.url}" shortcut?`)) {
      const state = getState();
      const filtered = state.tiles.filter((t) => t.id !== tile.id);
      setState('tiles', filtered);
    }
  };

  // Keyboard navigation action
  tileEl.onkeydown = (e) => {
    if (e.key === 'Enter') {
      window.location.href = tile.url;
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (confirm(`Remove "${tile.title || tile.url}" shortcut?`)) {
        const state = getState();
        const filtered = state.tiles.filter((t) => t.id !== tile.id);
        setState('tiles', filtered);
      }
    }
  };

  // Drag and Drop translation handler
  setupDraggable(tileEl, tile, (finalX, finalY) => {
    updateTileProperties(tile.id, { x: finalX, y: finalY });
  });

  // Resize dimension handler
  setupResizable(tileEl, resizeHandleEl, tile, (finalW, finalH) => {
    updateTileProperties(tile.id, { width: finalW, height: finalH });
  });

  // Click / Navigate detection
  // Ignore clicks that occur after drag actions
  let dragStartX = 0;
  let dragStartY = 0;

  tileEl.addEventListener('pointerdown', (e) => {
    dragStartX = e.clientX;
    dragStartY = e.clientY;
  });

  tileEl.addEventListener('click', (e) => {
    if (e.target.closest('.tile__controls') || e.target.closest('.tile__resize-handle')) {
      return;
    }

    // Calculate distance traveled during press to differentiate click vs drag
    const travelDist = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
    if (travelDist < 6) {
      window.location.href = tile.url;
    }
  });

  return tileEl;
}

/**
 * Update multiple properties of a single tile in the global state.
 *
 * @param {string} id
 * @param {object} updates - Map of key/values to update.
 */
function updateTileProperties(id, updates) {
  const state = getState();
  const updated = state.tiles.map((t) => {
    if (t.id === id) {
      return { ...t, ...updates };
    }
    return t;
  });
  setState('tiles', updated);
}

/* ------------------------------------------------------------------ */
/*  DOM Reconciliation (Diffing)                                      */
/* ------------------------------------------------------------------ */

/**
 * Sync the DOM tiles with the current state array.
 * Performs surgical updates instead of a full reload to avoid breaking drag capture.
 */
function reconcileTiles() {
  if (!containerEl) return;

  const { tiles } = getState();
  const currentDomIds = new Set();

  // 1. Update existing or add new tiles
  tiles.forEach((tile) => {
    currentDomIds.add(tile.id);
    const existingEl = containerEl.querySelector(`[data-id="${tile.id}"]`);

    if (existingEl) {
      // Tile exists - update position if not currently dragged
      if (!existingEl.classList.contains('dragging')) {
        existingEl.style.setProperty('--tile-x', `${tile.x}px`);
        existingEl.style.setProperty('--tile-y', `${tile.y}px`);
      }

      // Update dimensions if not currently resizing
      if (!existingEl.classList.contains('resizing')) {
        const width = tile.width || 96;
        const height = tile.height || 96;
        existingEl.style.setProperty('--tile-width', `${width}px`);
        existingEl.style.setProperty('--tile-height', `${height}px`);
        existingEl.classList.toggle('zenith-tile--no-title', height < 64);
      }

      // Sync title text
      const titleEl = existingEl.querySelector('.tile__title');
      if (titleEl && titleEl.textContent !== (tile.title || getHostname(tile.url))) {
        titleEl.textContent = tile.title || getHostname(tile.url);
        titleEl.title = tile.title || tile.url;
      }

      // Sync favicon / letter fallback
      const wrapper = existingEl.querySelector('.tile__favicon-wrapper');
      if (wrapper) {
        const imgEl = wrapper.querySelector('img');
        const letterEl = wrapper.querySelector('.tile__letter-fallback');

        if (tile.favicon) {
          // If we have a resolved favicon url in state but no image or a mismatch image
          if (!imgEl || imgEl.src !== tile.favicon) {
            appendFaviconImage(wrapper, tile.favicon, tile.url, tile.title);
          }
        } else {
          // No resolved favicon in state - show letter fallback
          if (!letterEl) {
            appendLetterFallback(wrapper, tile.url, tile.title);
          }
        }
      }
      
      // Resolve favicon asynchronously if missing or low-res (sz=64) from state
      if (!tile.favicon || tile.favicon.includes('sz=64')) {
        resolveFavicon(tile.url).then((faviconUrl) => {
          if (faviconUrl && faviconUrl !== tile.favicon) {
            updateTileProperties(tile.id, { favicon: faviconUrl });
          }
        });
      }
    } else {
      // New tile - create and append
      const newEl = createTileEl(tile);
      containerEl.appendChild(newEl);
      
      // Resolve favicon asynchronously if missing or low-res (sz=64) from state
      if (!tile.favicon || tile.favicon.includes('sz=64')) {
        resolveFavicon(tile.url).then((faviconUrl) => {
          if (faviconUrl && faviconUrl !== tile.favicon) {
            updateTileProperties(tile.id, { favicon: faviconUrl });
          }
        });
      }
    }
  });

  // 2. Remove deleted tiles
  const allDomTiles = containerEl.querySelectorAll('.zenith-tile');
  allDomTiles.forEach((domTile) => {
    const id = domTile.getAttribute('data-id');
    if (!currentDomIds.has(id)) {
      domTile.remove();
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Initialize the Tile System feature.
 * Appends container, performs initial render, and subscribes to updates.
 */
export async function init() {
  const app = $('#zenith-app');
  if (!app) {
    console.error('[Zenith:Tiles] #zenith-app not found.');
    return;
  }

  // Create grid container
  containerEl = createElement('div', {
    id: 'zenith-tiles-container',
  });
  app.appendChild(containerEl);

  // Render initial list
  reconcileTiles();

  // Subscribe to state changes
  subscribe('tiles', () => {
    reconcileTiles();
  });

  console.log('[Zenith:Tiles] Initialized');
}
