/**
 * Zenith — Wallpaper Engine
 *
 * Renders the full-viewport wallpaper layer with overlay dimming and blur.
 * Supports image, video, and gradient wallpapers with smooth crossfading transitions.
 *
 * @module features/wallpaper/wallpaper
 */

import { getState, subscribe } from '../../core/state.js';
import { $, createElement } from '../../core/dom.js';
import { BUNDLED_WALLPAPERS, GRADIENT_PRESETS } from '../../core/constants.js';
import { loadBlob, listBlobKeys, deleteBlob } from '../../core/storage.js';
import { createObjectURL, revokeObjectURL } from './wallpaper-utils.js';

/* ------------------------------------------------------------------ */
/*  Internal state & references                                       */
/* ------------------------------------------------------------------ */

/** @type {HTMLElement|null} Container element */
let containerEl = null;

/** @type {HTMLElement|null} Active rendering layer */
let activeLayer = null;

/** @type {HTMLElement|null} Inactive (background) layer for crossfading */
let inactiveLayer = null;

/** @type {string|null} Current active object URL (to avoid memory leaks) */
let activeObjectUrl = null;

/** @type {number} Counter to handle race conditions during async load */
let currentUpdateId = 0;

/* ------------------------------------------------------------------ */
/*  Private helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Resolve gradient string from state value (can be preset index or CSS string).
 *
 * @param {string|number|null} gradientValue
 * @returns {string} CSS gradient string
 */
function resolveGradient(gradientValue) {
  if (gradientValue === null || gradientValue === undefined) {
    return GRADIENT_PRESETS[0];
  }
  
  // Check if it represents a preset index
  const index = parseInt(gradientValue, 10);
  if (!isNaN(index) && index >= 0 && index < GRADIENT_PRESETS.length) {
    return GRADIENT_PRESETS[index];
  }
  
  return String(gradientValue);
}

/**
 * Set overlay dimming value.
 *
 * @param {number} opacity - Value between 0 and 1.
 */
function applyOverlay(opacity) {
  if (containerEl) {
    containerEl.style.setProperty('--z-wallpaper-overlay', String(opacity));
  }
}

/**
 * Set background blur.
 *
 * @param {number} blur - Blur in pixels.
 */
function applyBlur(blur) {
  if (containerEl) {
    containerEl.style.setProperty('--z-wallpaper-blur', `${blur}px`);
  }
}

/**
 * Load wallpaper resources asynchronously and prepare the inactive layer.
 * Performs a crossfade when ready.
 *
 * @param {number} updateId - The update identifier to verify if this load is still active.
 */
async function loadAndApply(updateId) {
  const { wallpaper, settings } = getState();
  const { type, activeId, gradient } = wallpaper;
  
  let nextUrl = null;
  let isVideo = false;
  let gradientValue = null;

  try {
    // 1. Resolve content based on type
    if (type === 'gradient') {
      gradientValue = resolveGradient(gradient);
    } else if (type === 'video') {
      if (!activeId) {
        // No custom video — fallback to default image
        nextUrl = BUNDLED_WALLPAPERS[0];
      } else {
        const blob = await loadBlob(activeId);
        if (!blob) throw new Error(`Video blob not found in IndexedDB: ${activeId}`);
        nextUrl = createObjectURL(blob);
        isVideo = true;
      }
    } else { // 'image'
      if (!activeId) {
        nextUrl = BUNDLED_WALLPAPERS[0];
      } else {
        const blob = await loadBlob(activeId);
        if (!blob) throw new Error(`Image blob not found in IndexedDB: ${activeId}`);
        nextUrl = createObjectURL(blob);
      }
    }

    // Check if cancelled
    if (updateId !== currentUpdateId) {
      if (nextUrl && nextUrl.startsWith('blob:')) {
        revokeObjectURL(nextUrl);
      }
      return;
    }

    // 2. Prepare the inactive layer
    if (gradientValue) {
      inactiveLayer.style.backgroundImage = gradientValue;
      inactiveLayer.innerHTML = '';
    } else if (isVideo) {
      inactiveLayer.style.backgroundImage = 'none';
      inactiveLayer.innerHTML = '';
      
      const video = createElement('video', {
        autoplay: !settings.performanceMode && !document.hidden,
        muted: true,
        loop: true,
        playsinline: true,
      });
      // Ensure audio is fully muted — the HTML attribute alone isn't reliable
      video.muted = true;
      video.volume = 0;
      video.src = nextUrl;
      inactiveLayer.appendChild(video);

      // Wait for video data to be loaded
      await new Promise((resolve, reject) => {
        video.onloadeddata = resolve;
        video.onerror = () => reject(new Error('Video element failed to load source'));
        // Safety timeout
        setTimeout(resolve, 3000);
      });
    } else {
      // Image
      inactiveLayer.style.backgroundImage = `url('${nextUrl}')`;
      inactiveLayer.innerHTML = '';

      // Wait for image to load before starting transition
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = () => reject(new Error('Image failed to load'));
        img.src = nextUrl;
      });
    }

    // Check if cancelled again during load
    if (updateId !== currentUpdateId) {
      if (nextUrl && nextUrl.startsWith('blob:')) {
        revokeObjectURL(nextUrl);
      }
      return;
    }

    // 3. Trigger Crossfade Transition
    inactiveLayer.classList.add('wallpaper__layer--active');
    activeLayer.classList.remove('wallpaper__layer--active');

    // Swap references
    const prevActive = activeLayer;
    const prevObjectUrl = activeObjectUrl;

    activeLayer = inactiveLayer;
    inactiveLayer = prevActive;
    activeObjectUrl = nextUrl;

    // 4. Cleanup old layer content after transition finishes
    setTimeout(() => {
      // Make sure we aren't cleaning up a layer that was repurposed in another quick swap
      if (inactiveLayer !== activeLayer) {
        inactiveLayer.style.backgroundImage = 'none';
        inactiveLayer.innerHTML = '';
        if (prevObjectUrl && prevObjectUrl.startsWith('blob:')) {
          revokeObjectURL(prevObjectUrl);
        }
      }
    }, 650); // Matches transition duration + small buffer

  } catch (err) {
    console.warn('[Zenith:Wallpaper] Load failed, falling back to default image:', err);
    if (nextUrl && nextUrl.startsWith('blob:')) {
      revokeObjectURL(nextUrl);
    }
    
    if (updateId === currentUpdateId) {
      await applyFallback(updateId);
    }
  }
}

/**
 * Revert to default wallpaper in case of media load errors.
 *
 * @param {number} updateId
 */
async function applyFallback(updateId) {
  const fallbackUrl = BUNDLED_WALLPAPERS[0];
  
  inactiveLayer.style.backgroundImage = `url('${fallbackUrl}')`;
  inactiveLayer.innerHTML = '';

  try {
    await new Promise((resolve) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = fallbackUrl;
    });
  } catch (e) {}

  if (updateId !== currentUpdateId) return;

  inactiveLayer.classList.add('wallpaper__layer--active');
  activeLayer.classList.remove('wallpaper__layer--active');

  const prevActive = activeLayer;
  const prevObjectUrl = activeObjectUrl;

  activeLayer = inactiveLayer;
  inactiveLayer = prevActive;
  activeObjectUrl = null;

  setTimeout(() => {
    if (inactiveLayer !== activeLayer) {
      inactiveLayer.style.backgroundImage = 'none';
      inactiveLayer.innerHTML = '';
      if (prevObjectUrl && prevObjectUrl.startsWith('blob:')) {
        revokeObjectURL(prevObjectUrl);
      }
    }
  }, 650);
}

/**
 * Start the async wallpaper application process.
 * Increments the update counter to cancel any active loads.
 */
function applyFromState() {
  const { wallpaper } = getState();
  
  // Set overlay & blur instantly (non-composited properties can update immediately)
  applyOverlay(wallpaper.overlay ?? 0.3);
  applyBlur(wallpaper.blur ?? 0);

  // Trigger content load with a new ID
  currentUpdateId++;
  loadAndApply(currentUpdateId);
}

/**
 * Handle document visibility change to pause/play video wallpapers.
 */
function handleVisibilityChange() {
  const isHidden = document.hidden;
  const video = activeLayer?.querySelector('video');
  
  if (video) {
    if (isHidden) {
      video.pause();
    } else {
      const { settings } = getState();
      // Only resume playing if performance mode is disabled
      if (!settings.performanceMode) {
        video.play().catch((err) => console.warn('[Zenith:Wallpaper] Play failed:', err));
      }
    }
  }
}

/**
 * Clean up orphaned blobs in IndexedDB on startup.
 */
async function cleanupOrphanedBlobs() {
  try {
    const { wallpaper } = getState();
    const activeId = wallpaper.activeId;
    const customList = wallpaper.customList || [];
    
    // Build a set of all valid IDs (active + library history)
    const validIds = new Set(customList.map((item) => item.id));
    if (activeId) {
      validIds.add(activeId);
    }
    
    const keys = await listBlobKeys();
    
    for (const key of keys) {
      if (!validIds.has(key)) {
        console.log(`[Zenith:Wallpaper] Deleting orphaned blob key: ${key}`);
        await deleteBlob(key);
      }
    }
  } catch (err) {
    console.error('[Zenith:Wallpaper] Blob cleanup failed:', err);
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Initialize the wallpaper feature.
 *
 * Creates dual-layer DOM structure, loads active wallpaper, registers
 * event listeners for tab visibility and state changes.
 *
 * @returns {Promise<void>}
 */
export async function init() {
  const app = $('#zenith-app');
  if (!app) {
    console.error('[Zenith:Wallpaper] #zenith-app not found.');
    return;
  }

  // -- Build DOM ------------------------------------------------
  containerEl = createElement('div', {
    id: 'zenith-wallpaper',
    className: 'wallpaper',
  });

  activeLayer = createElement('div', {
    className: 'wallpaper__layer wallpaper__layer--active',
    'aria-hidden': 'true',
  });

  inactiveLayer = createElement('div', {
    className: 'wallpaper__layer',
    'aria-hidden': 'true',
  });

  const overlayEl = createElement('div', {
    className: 'wallpaper__overlay',
    'aria-hidden': 'true',
  });

  containerEl.appendChild(activeLayer);
  containerEl.appendChild(inactiveLayer);
  containerEl.appendChild(overlayEl);

  // Insert behind everything
  app.insertBefore(containerEl, app.firstChild);

  // -- Apply current state --------------------------------------
  applyFromState();

  // -- Event Bindings -------------------------------------------
  
  // Tab focus/visibility handling for CPU/GPU efficiency
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Listen to wallpaper settings updates
  subscribe('wallpaper', () => {
    applyFromState();
  });

  // Listen to performance mode toggling to play/pause video immediately
  subscribe('settings', () => {
    const { settings } = getState();
    const video = activeLayer?.querySelector('video');
    
    if (video) {
      if (settings.performanceMode) {
        video.pause();
      } else if (!document.hidden) {
        video.play().catch((err) => console.warn('[Zenith:Wallpaper] Play failed:', err));
      }
    }
  });

  // Run IndexedDB orphaned blob clean-up asynchronously
  cleanupOrphanedBlobs();

  console.log('[Zenith:Wallpaper] Initialized');
}
