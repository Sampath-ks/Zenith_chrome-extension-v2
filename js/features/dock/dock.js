/**
 * Zenith — Floating Dock
 *
 * Implements the Floating Action Dock on the right edge. Provides actions
 * to add shortcut tiles (via a clean modal), open settings, and trigger layout backups.
 *
 * @module features/dock/dock
 */

import { getState, setState } from '../../core/state.js';
import { $, createElement } from '../../core/dom.js';
import { open as openSettings, exportLayout, importLayout } from '../settings/settings.js';

/* ------------------------------------------------------------------ */
/*  Internal references                                               */
/* ------------------------------------------------------------------ */

/** @type {HTMLElement|null} Dock container element */
let dockEl = null;

/* ------------------------------------------------------------------ */
/*  Add Tile Modal Dialog                                             */
/* ------------------------------------------------------------------ */

/**
 * Render and display the dynamic centered modal to add a shortcut tile.
 */
function showAddTileDialog() {
  const app = $('#zenith-app');
  if (!app) return;

  // 1. Create dimming backdrop
  const modalBackdrop = createElement('div', {
    className: 'settings-backdrop open',
    style: 'z-index: 10000;', // Float above settings panel
  });

  // 2. Create centered card modal
  const card = createElement('div', {
    style: `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 320px;
      padding: 20px;
      border-radius: var(--z-radius-lg, 16px);
      display: flex;
      flex-direction: column;
      gap: 16px;
      z-index: 10001;
      border: 1px solid var(--z-color-glass-border, rgba(255,255,255,0.1));
      background: rgba(10, 10, 12, 0.9);
      box-shadow: var(--z-shadow-elevated);
      color: #fff;
      font-family: var(--z-font-family, sans-serif);
    `,
  });

  // Gated glassmorphism blur
  if (!document.body.classList.contains('performance-mode')) {
    card.style.backdropFilter = 'blur(20px)';
    card.style.webkitBackdropFilter = 'blur(20px)';
  }

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 8px;">
      <span style="font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.85);">Add Shortcut</span>
      <button id="add-tile-close" style="background:none; border:none; color:rgba(255,255,255,0.6); font-size: 20px; cursor:pointer; outline:none;">×</button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 6px;">
      <label style="font-size: 12px; color: rgba(255,255,255,0.5);">Shortcut URL</label>
      <input type="text" id="add-tile-url" placeholder="youtube.com" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: var(--z-radius-sm, 8px); padding: 8px; color: #fff; font-size: 13px; outline:none; transition: border-color 0.2s;">
    </div>
    <div style="display: flex; flex-direction: column; gap: 6px;">
      <label style="font-size: 12px; color: rgba(255,255,255,0.5);">Title (Optional)</label>
      <input type="text" id="add-tile-title" placeholder="YouTube" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: var(--z-radius-sm, 8px); padding: 8px; color: #fff; font-size: 13px; outline:none;">
    </div>
    <button id="add-tile-submit" style="background: var(--z-color-accent-subtle, rgba(123, 140, 255, 0.15)); border: 1px solid var(--z-color-accent, #7B8CFF); border-radius: var(--z-radius-sm, 8px); padding: 10px; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; outline:none; margin-top: 4px;">
      ＋ Add Shortcut
    </button>
  `;

  app.appendChild(modalBackdrop);
  app.appendChild(card);

  // Focus URL input instantly
  const inputUrl = card.querySelector('#add-tile-url');
  const inputTitle = card.querySelector('#add-tile-title');
  const submitBtn = card.querySelector('#add-tile-submit');
  const closeBtn = card.querySelector('#add-tile-close');

  inputUrl.focus();

  // Helper close function
  const destroyDialog = () => {
    modalBackdrop.remove();
    card.remove();
    document.removeEventListener('keydown', handleEsc);
  };

  const handleEsc = (e) => {
    if (e.key === 'Escape') destroyDialog();
  };

  // Close listeners
  modalBackdrop.onclick = destroyDialog;
  closeBtn.onclick = destroyDialog;
  document.addEventListener('keydown', handleEsc);

  // Submit action
  const handleAdd = () => {
    const url = inputUrl.value.trim();
    const title = inputTitle.value.trim();

    if (!url) {
      inputUrl.style.borderColor = 'var(--z-color-danger)';
      return;
    }

    let formattedUrl = url;
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    const newTile = {
      id: `tile-user-${Date.now()}`,
      url: formattedUrl,
      title: title || 'Shortcut',
      favicon: null, // Resolves dynamically
      x: Math.round(window.innerWidth / 2 - 48 + (Math.random() * 80 - 40)),
      y: Math.round(window.innerHeight / 2 - 48 + (Math.random() * 80 - 40)),
      width: 96,
      height: 96,
      size: 'medium',
      order: getState().tiles.length,
    };

    // Snap to grid initially if active
    const { settings } = getState();
    if (settings.snapGrid) {
      const size = settings.snapGridSize || 20;
      newTile.x = Math.round(newTile.x / size) * size;
      newTile.y = Math.round(newTile.y / size) * size;
    }

    // Save to state
    const tiles = [...getState().tiles, newTile];
    setState('tiles', tiles);

    destroyDialog();
  };

  submitBtn.onclick = handleAdd;

  // Submit on enter key inside inputs
  inputUrl.onkeydown = (e) => {
    if (e.key === 'Enter') handleAdd();
  };
  inputTitle.onkeydown = (e) => {
    if (e.key === 'Enter') handleAdd();
  };
}

/* ------------------------------------------------------------------ */
/*  Dock Item Helpers                                                 */
/* ------------------------------------------------------------------ */

/**
 * Generate a single dock item button with HTML and tooltips.
 *
 * @param {string} iconSvg - Inline SVG string
 * @param {string} label - Tooltip label text
 * @param {function} clickHandler - Event callback
 * @returns {HTMLElement}
 */
function createDockItem(iconSvg, label, clickHandler) {
  const item = createElement('button', {
    className: 'dock__item',
    ariaLabel: label,
  });
  item.innerHTML = `
    ${iconSvg}
    <span class="dock__tooltip">${label}</span>
  `;
  item.onclick = clickHandler;
  return item;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Initialize the Floating Dock.
 * Creates container, appends standard buttons, and handles imports/restores.
 */
export async function init() {
  const app = $('#zenith-app');
  if (!app) {
    console.error('[Zenith:Dock] #zenith-app not found.');
    return;
  }

  // Create dock container
  dockEl = createElement('div', {
    className: 'zenith-dock-container',
  });

  // 1. Add Tile Item
  const addTileItem = createDockItem(`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  `, 'Add Shortcut', showAddTileDialog);
  dockEl.appendChild(addTileItem);

  // 2. Change Wallpaper Item (opens settings directly to Atmosphere section)
  const wallpaperItem = createDockItem(`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
  `, 'Backgrounds', () => {
    openSettings('atmosphere');
  });
  dockEl.appendChild(wallpaperItem);

  // 3. Settings Toggle (opens settings to General section)
  const settingsItem = createDockItem(`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  `, 'Preferences', () => {
    openSettings('general');
  });
  dockEl.appendChild(settingsItem);

  // 4. Import Layout Item
  const hiddenImportInput = createElement('input', {
    type: 'file',
    accept: 'application/json',
    style: 'display: none;',
  });
  
  hiddenImportInput.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await importLayout(file);
      alert('Workspace layout restored successfully!');
      window.location.reload();
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    }
  };
  
  const importItem = createDockItem(`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  `, 'Restore Layout', () => {
    hiddenImportInput.click();
  });
  
  dockEl.appendChild(hiddenImportInput);
  dockEl.appendChild(importItem);

  // 5. Export Layout Item
  const exportItem = createDockItem(`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="17 8 12 3 7 8"></polyline>
      <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
  `, 'Backup Layout', exportLayout);
  dockEl.appendChild(exportItem);

  // 6. Incognito Window
  const incognitoItem = createDockItem(`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 11v1H2v-1l4-8h12l4 8z"></path>
      <circle cx="7" cy="17" r="4"></circle>
      <circle cx="17" cy="17" r="4"></circle>
      <path d="M11 17h2"></path>
    </svg>
  `, 'Incognito Window', () => {
    chrome.windows.create({ incognito: true, state: 'maximized' });
  });
  dockEl.appendChild(incognitoItem);

  app.appendChild(dockEl);

  // Initialize magnification wave animation
  initMagnification();

  console.log('[Zenith:Dock] Initialized');
}

/**
 * Initialize macOS-like vertical wave magnification on the Dock items.
 * Uses cached vertical centers on hover entry to prevent layout reflow during pointermove.
 */
function initMagnification() {
  if (!dockEl) return;

  const range = 100; // Wider range of effect (pixels) for a more visible wave
  const maxScale = 1.4; // Higher maximum scale factor for better visibility

  let itemPositions = [];

  // Compute vertical centers dynamically to ensure we target current items in the DOM
  const updatePositions = () => {
    const items = dockEl.querySelectorAll('.dock__item');
    itemPositions = Array.from(items).map((item) => {
      const rect = item.getBoundingClientRect();
      return {
        el: item,
        centerY: rect.top + rect.height / 2,
      };
    });
  };

  dockEl.addEventListener('pointerenter', () => {
    if (document.body.classList.contains('performance-mode')) return;
    updatePositions();
    dockEl.classList.add('dock--magnifying');
  });

  dockEl.addEventListener('pointermove', (e) => {
    if (document.body.classList.contains('performance-mode')) return;

    if (itemPositions.length === 0) {
      updatePositions();
    }

    const pointerY = e.clientY;

    itemPositions.forEach((pos) => {
      const dist = Math.abs(pointerY - pos.centerY);

      if (dist < range) {
        const ratio = dist / range;
        // Cosine wave easing for a natural, smooth magnifying effect
        const scale = 1 + (maxScale - 1) * Math.cos((ratio * Math.PI) / 2);
        pos.el.style.transform = `scale(${scale})`;
      } else {
        pos.el.style.transform = 'scale(1)';
      }
    });
  });

  dockEl.addEventListener('pointerleave', () => {
    dockEl.classList.remove('dock--magnifying');
    const items = dockEl.querySelectorAll('.dock__item');
    items.forEach((item) => {
      item.style.transform = '';
    });
    itemPositions = []; // Clear cache
  });
}

