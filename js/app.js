/**
 * Zenith — App Bootstrap
 * 
 * Entry point for the new tab experience.
 * Initializes core infrastructure, then boots feature modules
 * in visual-priority order (wallpaper first for perceived speed).
 */

import { initState, getState, setState } from './core/state.js';
import { emit } from './core/events.js';
import { $ } from './core/dom.js';

// Feature modules
import { init as initWallpaper } from './features/wallpaper/wallpaper.js';
import { init as initGreeting } from './features/greeting/greeting.js';
import { init as initTiles } from './features/tiles/tiles.js';
import { init as initSettings } from './features/settings/settings.js';
import { init as initDock } from './features/dock/dock.js';
import { init as initDashboard } from './features/dashboard/dashboard.js';
import * as Tutorial from './features/tutorial/tutorial.js';
import * as Donation from './features/donation/donation.js';

/**
 * Boot sequence:
 * 1. Load persisted state into memory
 * 2. Apply performance mode class if needed
 * 3. Init features in visual-priority order
 * 4. Emit ready event
 */
async function boot() {
  try {
    // 1. Initialize state (loads from chrome.storage.local, merges defaults)
    await initState();

    // 2. Apply performance mode
    const state = getState();
    if (state.settings.performanceMode) {
      document.body.classList.add('performance-mode');
    }

    // 3. Auto-detect prefers-reduced-motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      document.body.classList.add('performance-mode');
    }
    motionQuery.addEventListener('change', (e) => {
      document.body.classList.toggle('performance-mode', e.matches);
    });

    // 4. Boot features (order = visual priority)
    await initWallpaper();
    await initGreeting();
    await initTiles();
    await initSettings();
    await initDock();
    await initDashboard();
    
    // Load onboarding and monetization overlays
    Tutorial.init();
    Donation.init();

    // 5. Signal ready
    emit('zenith:app:ready');
    document.body.classList.add('zenith-ready');

    console.log('[Zenith] Ready');
  } catch (err) {
    console.error('[Zenith] Boot failed:', err);
  }
}

// Launch
boot();
