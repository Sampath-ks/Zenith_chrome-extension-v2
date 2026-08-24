/**
 * Zenith — Settings Panel
 *
 * Controls the slide-out preferences menu. Manages inputs for wallpaper settings,
 * Clock/Greeting configurations, Performance Mode, and layout import/export backups.
 *
 * @module features/settings/settings
 */

import { getState, setState, subscribe } from '../../core/state.js';
import { $, createElement } from '../../core/dom.js';
import { saveBlob, loadBlob, deleteBlob, listBlobKeys } from '../../core/storage.js';
import { compressImage, validateVideo } from '../wallpaper/wallpaper-utils.js';
import { BUNDLED_WALLPAPERS, GRADIENT_PRESETS } from '../../core/constants.js';

/* ------------------------------------------------------------------ */
/*  Internal references                                               */
/* ------------------------------------------------------------------ */

/** @type {HTMLElement|null} Backdrop element */
let backdropEl = null;

/** @type {HTMLElement|null} Panel container element */
let panelEl = null;

/** @type {HTMLElement|null} File alert container */
let alertEl = null;

/* ------------------------------------------------------------------ */
/*  Layout Backup Functions                                           */
/* ------------------------------------------------------------------ */

/**
 * Serialize state configurations (excl. binary blobs) and download as JSON.
 */
export function exportLayout() {
  const state = getState();
  const exportData = {
    _version: state._version,
    wallpaper: {
      type: state.wallpaper.type,
      activeId: state.wallpaper.activeId,
      gradient: state.wallpaper.gradient,
      overlay: state.wallpaper.overlay,
      blur: state.wallpaper.blur,
    },
    tiles: state.tiles,
    settings: state.settings,
  };

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = createElement('a', {
    href: url,
    download: `zenith-backup-${new Date().toISOString().slice(0, 10)}.json`,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Read backup JSON and overwrite active state.
 *
 * @param {File} file
 * @returns {Promise<void>}
 */
export async function importLayout(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);

        // Schema validation check
        if (data._version === undefined || !Array.isArray(data.tiles) || typeof data.settings !== 'object') {
          throw new Error('Invalid Zenith backup file.');
        }

        const state = getState();

        // Perform bulk state update
        setState('settings', { ...state.settings, ...data.settings });
        setState('wallpaper', { ...state.wallpaper, ...data.wallpaper });
        setState('tiles', data.tiles);

        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read backup file.'));
    reader.readAsText(file);
  });
}

/**
 * Save current tiles configuration as a named layout.
 * @param {string} name 
 */
function saveLayout(name) {
  if (!name.trim()) return;
  const state = getState();
  const newLayout = {
    id: `layout-${Date.now()}`,
    name: name.trim(),
    tiles: JSON.parse(JSON.stringify(state.tiles || [])),
  };
  const layouts = [...(state.savedLayouts || [])];
  layouts.push(newLayout);
  setState('savedLayouts', layouts);
}

/**
 * Apply a saved layout to the current workspace.
 * @param {string} id 
 */
function applyLayout(id) {
  const state = getState();
  const layouts = state.savedLayouts || [];
  const layout = layouts.find(l => l.id === id);
  if (layout) {
    setState('tiles', JSON.parse(JSON.stringify(layout.tiles)));
  }
}

/**
 * Delete a saved layout.
 * @param {string} id 
 */
function deleteLayout(id) {
  const state = getState();
  let layouts = state.savedLayouts || [];
  layouts = layouts.filter(l => l.id !== id);
  setState('savedLayouts', layouts);
}

/**
 * Render the saved layouts list in the settings panel.
 */
function renderLayoutsList() {
  const container = panelEl.querySelector('#settings-layout-list');
  if (!container) return;

  const state = getState();
  const layouts = state.savedLayouts || [];
  
  container.innerHTML = '';
  
  if (layouts.length === 0) {
    container.innerHTML = '<div style="color: var(--z-color-text-dim); font-size: 13px; font-style: italic;">No saved layouts yet.</div>';
    return;
  }

  layouts.forEach(layout => {
    const item = createElement('div', { className: 'settings__layout-item' });
    
    const nameEl = createElement('span', { 
      className: 'settings__layout-name', 
      textContent: layout.name 
    });
    
    const actions = createElement('div', { className: 'settings__layout-actions' });
    
    const applyBtn = createElement('button', {
      className: 'settings__btn',
      textContent: 'Apply',
      style: 'padding: 4px 12px; min-height: unset; font-size: 12px;',
      onclick: () => applyLayout(layout.id)
    });
    
    const delBtn = createElement('button', {
      className: 'settings__btn',
      title: 'Delete Layout',
      style: 'padding: 4px 8px; min-height: unset; background: rgba(255, 100, 100, 0.1); color: #ff8888; border: none;',
      onclick: () => deleteLayout(layout.id)
    });
    delBtn.innerHTML = '🗑️'; // using simple icon

    actions.appendChild(applyBtn);
    actions.appendChild(delBtn);
    
    item.appendChild(nameEl);
    item.appendChild(actions);
    
    container.appendChild(item);
  });
}

/* ------------------------------------------------------------------ */
/*  Panel Open/Close                                                   */
/* ------------------------------------------------------------------ */

/**
 * Slide the settings panel in and optionally scroll to a specific section.
 *
 * @param {string} [sectionId] - Section ID to scroll to ('atmosphere' | 'time' | 'general' | 'backup').
 */
export function open(sectionId) {
  if (panelEl && backdropEl) {
    panelEl.classList.add('open');
    backdropEl.classList.add('open');

    if (sectionId) {
      const contentEl = panelEl.querySelector('.settings__content');
      const targetEl = panelEl.querySelector(`#settings-sec-${sectionId}`);
      if (contentEl && targetEl) {
        // Small delay to let the panel slide-in animation transition begin
        setTimeout(() => {
          contentEl.scrollTo({
            top: targetEl.offsetTop - 16,
            behavior: 'smooth',
          });
        }, 150);
      }
    }
  }
}

/**
 * Slide the settings panel out.
 */
export function close() {
  if (panelEl && backdropEl) {
    panelEl.classList.remove('open');
    backdropEl.classList.remove('open');
  }
}

/* ------------------------------------------------------------------ */
/*  UI Event Handling                                                 */
/* ------------------------------------------------------------------ */

/**
 * Render details in the alert element.
 *
 * @param {string} text
 * @param {boolean} [isInfo=false]
 */
function showAlert(text, isInfo = false) {
  if (!alertEl) return;
  alertEl.textContent = text;
  alertEl.className = 'settings__alert';
  if (isInfo) alertEl.classList.add('info');
  alertEl.style.display = 'block';
}

function hideAlert() {
  if (alertEl) alertEl.style.display = 'none';
}

/**
 * Attach interaction events to all form controls.
 */
function bindUIEvents() {
  // 1. Wallpaper Type Buttons
  const typeButtons = panelEl.querySelectorAll('.settings__btn[data-type]');
  typeButtons.forEach((btn) => {
    btn.onclick = () => {
      const type = btn.getAttribute('data-type');
      const wallpaper = getState().wallpaper;
      setState('wallpaper', { ...wallpaper, type });
    };
  });

  // 2. Custom Image File Picker
  const imgInput = panelEl.querySelector('#settings-upload-image');
  imgInput.onchange = async (e) => {
    hideAlert();
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showAlert('Compressing image file...', true);
      const compressed = await compressImage(file);
      
      const newId = `img-user-${Date.now()}`;
      
      showAlert('Saving background to local cache...', true);
      await saveBlob(newId, compressed);

      const wallpaper = getState().wallpaper;
      const customList = wallpaper.customList || [];
      const newWallpaper = {
        id: newId,
        type: 'image',
        name: file.name || 'Custom Image',
        addedAt: Date.now(),
      };

      setState('wallpaper', {
        ...wallpaper,
        type: 'image',
        activeId: newId,
        gradient: null,
        customList: [newWallpaper, ...customList],
      });

      hideAlert();
    } catch (err) {
      console.error(err);
      showAlert(`Image upload failed: ${err.message}`);
    }
  };

  // 3. Custom Video File Picker
  const vidInput = panelEl.querySelector('#settings-upload-video');
  vidInput.onchange = async (e) => {
    hideAlert();
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateVideo(file);
    if (!validation.valid) {
      showAlert(validation.error);
      return;
    }

    if (validation.warning) {
      const proceed = confirm(`${validation.message}\n\nDo you want to upload it anyway?`);
      if (!proceed) {
        vidInput.value = '';
        return;
      }
    }

    try {
      showAlert('Saving video background...', true);
      const newId = `vid-user-${Date.now()}`;

      await saveBlob(newId, file);

      const wallpaper = getState().wallpaper;
      const customList = wallpaper.customList || [];
      const newWallpaper = {
        id: newId,
        type: 'video',
        name: file.name || 'Custom Video',
        addedAt: Date.now(),
      };

      setState('wallpaper', {
        ...wallpaper,
        type: 'video',
        activeId: newId,
        gradient: null,
        customList: [newWallpaper, ...customList],
      });

      hideAlert();
    } catch (err) {
      console.error(err);
      showAlert(`Video upload failed: ${err.message}`);
    }
  };

  // 4. Gradient Grid Presets
  const gradContainer = panelEl.querySelector('#settings-gradients-container');
  GRADIENT_PRESETS.forEach((grad, index) => {
    const item = createElement('div', {
      className: 'settings__gradient-item',
      title: `Preset ${index + 1}`,
    });
    item.style.backgroundImage = grad;
    item.onclick = () => {
      const wallpaper = getState().wallpaper;
      setState('wallpaper', {
        ...wallpaper,
        type: 'gradient',
        gradient: index,
        activeId: null,
      });
    };
    gradContainer.appendChild(item);
  });

  // 5. Sliders (Overlay & Blur)
  const sliderOverlay = panelEl.querySelector('#settings-slider-overlay');
  const valOverlay = panelEl.querySelector('#settings-val-overlay');
  sliderOverlay.oninput = (e) => {
    const value = parseFloat(e.target.value);
    valOverlay.textContent = `${Math.round(value * 100)}%`;
    const wallpaper = getState().wallpaper;
    setState('wallpaper', { ...wallpaper, overlay: value });
  };

  const sliderBlur = panelEl.querySelector('#settings-slider-blur');
  const valBlur = panelEl.querySelector('#settings-val-blur');
  sliderBlur.oninput = (e) => {
    const value = parseInt(e.target.value, 10);
    valBlur.textContent = `${value}px`;
    const wallpaper = getState().wallpaper;
    setState('wallpaper', { ...wallpaper, blur: value });
  };

  // 6. Clock and Greeting Section
  const chkClockVisible = panelEl.querySelector('#settings-chk-clock-visible');
  chkClockVisible.onchange = (e) => {
    const settings = getState().settings;
    setState('settings', { ...settings, timeVisible: e.target.checked });
  };

  const clockFormatButtons = panelEl.querySelectorAll('.settings__btn[data-format]');
  clockFormatButtons.forEach((btn) => {
    btn.onclick = () => {
      const clockFormat = btn.getAttribute('data-format');
      const settings = getState().settings;
      setState('settings', { ...settings, clockFormat });
    };
  });

  const chkGreet = panelEl.querySelector('#settings-chk-greet');
  chkGreet.onchange = (e) => {
    const settings = getState().settings;
    setState('settings', { ...settings, greetingEnabled: e.target.checked });
  };

  const inputName = panelEl.querySelector('#settings-input-name');
  inputName.oninput = (e) => {
    const name = e.target.value.trim();
    const settings = getState().settings;
    // Set directly with immediate setState (will debounce internally in persistence)
    setState('settings', { ...settings, greetingName: name });
  };

  // 7. Snap Grid Toggle
  const chkSnap = panelEl.querySelector('#settings-chk-snap');
  chkSnap.onchange = (e) => {
    const settings = getState().settings;
    setState('settings', { ...settings, snapGrid: e.target.checked });
  };

  // 8. Performance Mode Toggle
  const chkPerf = panelEl.querySelector('#settings-chk-perf');
  chkPerf.onchange = (e) => {
    const isChecked = e.target.checked;
    const settings = getState().settings;
    setState('settings', { ...settings, performanceMode: isChecked });
    document.body.classList.toggle('performance-mode', isChecked);
  };

  // 9. Layout Backups (Import / Export)
  panelEl.querySelector('#settings-btn-export').onclick = () => exportLayout();

  const importFile = panelEl.querySelector('#settings-import-file');
  importFile.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await importLayout(file);
      showAlert('Layout restored successfully.', 'success');
    } catch (err) {
      showAlert(err.message, 'error');
    }
    // reset input
    e.target.value = '';
  };
  
  const saveLayoutBtn = panelEl.querySelector('#settings-btn-save-layout');
  const layoutNameInput = panelEl.querySelector('#settings-input-layout-name');
  if (saveLayoutBtn && layoutNameInput) {
    saveLayoutBtn.onclick = () => {
      const name = layoutNameInput.value;
      if (name) {
        saveLayout(name);
        layoutNameInput.value = '';
        showAlert(`Layout "${name}" saved!`, 'success');
      }
    };
  }
}

/**
 * Render the user's custom uploaded background gallery.
 */
async function renderCustomGallery() {
  const galleryContainer = panelEl.querySelector('#settings-custom-gallery-container');
  if (!galleryContainer) return;

  // Revoke existing object URLs to avoid memory leaks
  const existingCards = galleryContainer.querySelectorAll('.settings__gallery-card');
  existingCards.forEach((card) => {
    if (card.dataset.url) {
      URL.revokeObjectURL(card.dataset.url);
    }
  });

  galleryContainer.innerHTML = '';

  const { customList, activeId, type } = getState().wallpaper;

  // If there are no custom wallpapers, hide the section
  const customSection = panelEl.querySelector('#settings-custom-wallpapers-wrap');
  if (!customList || customList.length === 0) {
    if (customSection) customSection.style.display = 'none';
    return;
  }

  if (customSection) customSection.style.display = 'flex';

  for (const item of customList) {
    const card = createElement('div', {
      className: 'settings__gallery-card',
      title: item.name || 'Custom Background',
    });

    const isActive = (type === item.type) && (activeId === item.id);
    card.classList.toggle('active', isActive);

    // Create delete button
    const deleteBtn = createElement('button', {
      className: 'settings__gallery-delete',
      textContent: '×',
      title: 'Remove Background',
    });

    deleteBtn.onclick = async (e) => {
      e.stopPropagation();
      if (confirm('Delete this background from your history?')) {
        // 1. Delete blob from IndexedDB
        await deleteBlob(item.id);

        // 2. Remove metadata from state list
        const updatedList = customList.filter((w) => w.id !== item.id);

        // 3. Fallback active wallpaper if the deleted one was selected
        let nextActiveId = activeId;
        let nextType = type;
        if (activeId === item.id) {
          nextActiveId = null;
          nextType = 'image'; // Falls back to default bundled wallpaper
        }

        setState('wallpaper', {
          ...getState().wallpaper,
          type: nextType,
          activeId: nextActiveId,
          gradient: null,
          customList: updatedList,
        });
      }
    };
    card.appendChild(deleteBtn);

    // Load preview thumbnail
    if (item.type === 'image') {
      try {
        const blob = await loadBlob(item.id);
        if (blob) {
          const url = URL.createObjectURL(blob);
          card.style.backgroundImage = `url('${url}')`;
          card.dataset.url = url; // Cache URL on card element to clean up later
        }
      } catch (err) {
        console.warn('Failed to load image preview:', err);
      }
    } else {
      // Video thumbnail — capture a frame from the video blob
      try {
        const blob = await loadBlob(item.id);
        if (blob) {
          const url = URL.createObjectURL(blob);
          card.dataset.url = url;

          // Create an offscreen video to capture a thumbnail frame
          const thumbVideo = document.createElement('video');
          thumbVideo.muted = true;
          thumbVideo.preload = 'auto';
          thumbVideo.src = url;

          await new Promise((resolve) => {
            thumbVideo.onloadeddata = () => {
              // Seek to 1 second (or 0 for very short clips)
              thumbVideo.currentTime = Math.min(1, thumbVideo.duration || 1);
            };
            thumbVideo.onseeked = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = 160;
                canvas.height = 90;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(thumbVideo, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                card.style.backgroundImage = `url('${dataUrl}')`;
              } catch (e) {
                console.warn('Video thumbnail canvas capture failed:', e);
              }
              resolve();
            };
            thumbVideo.onerror = resolve;
            // Safety timeout in case events don't fire
            setTimeout(resolve, 3000);
          });
        }
      } catch (err) {
        console.warn('Failed to load video preview:', err);
      }

      // Add a small video badge icon
      const videoBadge = createElement('div', {
        className: 'settings__gallery-video-badge',
        textContent: '▶',
      });
      card.appendChild(videoBadge);
    }

    // Handle switching
    card.onclick = () => {
      setState('wallpaper', {
        ...getState().wallpaper,
        type: item.type,
        activeId: item.id,
        gradient: null,
      });
    };

    galleryContainer.appendChild(card);
  }
}

/**
 * Synchronise settings panel elements with state changes.
 */
function syncFormWithState() {
  const state = getState();
  const { type, overlay, blur, gradient } = state.wallpaper;
  const { timeVisible, clockFormat, greetingEnabled, greetingName, snapGrid, performanceMode } = state.settings;

  // Type buttons
  panelEl.querySelectorAll('.settings__btn[data-type]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-type') === type);
  });

  // Dynamic sections
  const imageSec = panelEl.querySelector('#settings-image-upload-wrap');
  const videoSec = panelEl.querySelector('#settings-video-upload-wrap');
  const gradientSec = panelEl.querySelector('#settings-gradients-wrap');

  imageSec.style.display = type === 'image' ? 'flex' : 'none';
  videoSec.style.display = type === 'video' ? 'flex' : 'none';
  gradientSec.style.display = type === 'gradient' ? 'flex' : 'none';

  // Active gradientpreset item
  panelEl.querySelectorAll('.settings__gradient-item').forEach((item, index) => {
    item.classList.toggle('active', type === 'gradient' && gradient === index);
  });

  // Sliders
  panelEl.querySelector('#settings-slider-overlay').value = overlay ?? 0.3;
  panelEl.querySelector('#settings-val-overlay').textContent = `${Math.round((overlay ?? 0.3) * 100)}%`;

  panelEl.querySelector('#settings-slider-blur').value = blur ?? 0;
  panelEl.querySelector('#settings-val-blur').textContent = `${blur ?? 0}px`;

  // Time & Greeting
  panelEl.querySelector('#settings-chk-clock-visible').checked = !!timeVisible;
  
  panelEl.querySelectorAll('.settings__btn[data-format]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-format') === clockFormat);
  });

  panelEl.querySelector('#settings-chk-greet').checked = !!greetingEnabled;

  const nameInput = panelEl.querySelector('#settings-input-name');
  if (nameInput && document.activeElement !== nameInput) {
    nameInput.value = greetingName || '';
  }

  // General Settings
  panelEl.querySelector('#settings-chk-snap').checked = !!snapGrid;
  panelEl.querySelector('#settings-chk-perf').checked = !!performanceMode;

  // Render the custom background gallery list
  renderCustomGallery();
  
  // Render layout list
  renderLayoutsList();
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Initialize the Settings Panel.
 * Appends backdrop and panel to DOM, binds UI events, and listens for state syncs.
 */
export async function init() {
  const app = $('#zenith-app');
  if (!app) {
    console.error('[Zenith:Settings] #zenith-app not found.');
    return;
  }

  // 1. Create dimming backdrop
  backdropEl = createElement('div', { className: 'settings-backdrop' });
  backdropEl.onclick = close;
  app.appendChild(backdropEl);

  // 2. Create sliding panel
  panelEl = createElement('div', { className: 'settings-panel' });
  panelEl.innerHTML = `
    <div class="settings__header">
      <h3 class="settings__title">Preferences</h3>
      <button class="settings__close-btn" id="settings-close">×</button>
    </div>
    <div class="settings__content">
      
      <!-- WALLPAPER SECTION -->
      <div class="settings__section" id="settings-sec-atmosphere">
        <div class="settings__section-title">Atmosphere</div>
        <div class="settings__row">
          <label>Wallpaper Type</label>
          <div class="settings__btn-group">
            <button class="settings__btn" data-type="image">Image</button>
            <button class="settings__btn" data-type="gradient">Gradient</button>
            <button class="settings__btn" data-type="video" style="grid-column: span 2; margin-top: 4px;">Video</button>
          </div>
        </div>

        <div class="settings__row" id="settings-image-upload-wrap" style="display:none;">
          <label>Custom Image Background</label>
          <label class="settings__file-upload">
            <span>📁 Select Image File</span>
            <input type="file" id="settings-upload-image" accept="image/jpeg,image/png,image/webp">
          </label>
        </div>

        <div class="settings__row" id="settings-video-upload-wrap" style="display:none;">
          <label>Custom Video Background</label>
          <label class="settings__file-upload">
            <span>🎥 Select Video File (.mp4, .webm)</span>
            <input type="file" id="settings-upload-video" accept="video/mp4,video/webm">
          </label>
        </div>

        <!-- Custom Uploaded Gallery list -->
        <div class="settings__row" id="settings-custom-wallpapers-wrap" style="display:none; margin-top: 4px; margin-bottom: var(--z-space-4, 16px);">
          <label>Uploaded Backgrounds</label>
          <div class="settings__custom-gallery" id="settings-custom-gallery-container"></div>
        </div>

        <div class="settings__row" id="settings-gradients-wrap" style="display:none;">
          <label>Gradient Presets</label>
          <div class="settings__gradient-grid" id="settings-gradients-container"></div>
        </div>

        <div class="settings__row" style="margin-top: 16px;">
          <label>Overlay Dimming</label>
          <div class="settings__slider-container">
            <input type="range" id="settings-slider-overlay" min="0" max="1" step="0.05">
            <span class="settings__slider-value" id="settings-val-overlay">30%</span>
          </div>
        </div>

        <div class="settings__row">
          <label>Background Blur</label>
          <div class="settings__slider-container">
            <input type="range" id="settings-slider-blur" min="0" max="40" step="1">
            <span class="settings__slider-value" id="settings-val-blur">0px</span>
          </div>
        </div>

        <div class="settings__alert" id="settings-file-alert"></div>
      </div>

      <!-- CLOCK & GREETING SECTION -->
      <div class="settings__section" id="settings-sec-time">
        <div class="settings__section-title">Time & Greeting</div>
        
        <div class="settings__row">
          <label class="settings__checkbox-row">
            <input type="checkbox" id="settings-chk-clock-visible">
            <span>Show Clock Display</span>
          </label>
        </div>

        <div class="settings__row">
          <label>Time Format</label>
          <div class="settings__btn-group">
            <button class="settings__btn" data-format="12h">12-Hour</button>
            <button class="settings__btn" data-format="24h">24-Hour</button>
          </div>
        </div>

        <div class="settings__row" style="margin-top: 12px;">
          <label class="settings__checkbox-row">
            <input type="checkbox" id="settings-chk-greet">
            <span>Enable Personal Greeting</span>
          </label>
        </div>

        <div class="settings__row">
          <label>Greeting Name</label>
          <input type="text" id="settings-input-name" class="settings__input-text" placeholder="Your name...">
        </div>
      </div>

      <!-- GENERAL SETTINGS SECTION -->
      <div class="settings__section" id="settings-sec-general">
        <div class="settings__section-title">General</div>
        
        <div class="settings__row">
          <label class="settings__checkbox-row">
            <input type="checkbox" id="settings-chk-snap">
            <span>Snap Tiles to Grid (20px)</span>
          </label>
        </div>

        <div class="settings__row">
          <label class="settings__checkbox-row">
            <input type="checkbox" id="settings-chk-perf">
            <span>Enable Performance Mode</span>
          </label>
        </div>
      </div>

      <!-- LAYOUTS SECTION -->
      <div class="settings__section" id="settings-sec-layout">
        <div class="settings__section-title">Layouts</div>
        
        <div class="settings__row">
          <div style="display: flex; gap: 8px; width: 100%;">
            <input type="text" id="settings-input-layout-name" class="settings__input-text" placeholder="Layout name..." style="flex: 1;">
            <button class="settings__btn" id="settings-btn-save-layout" style="white-space: nowrap;">Save Current</button>
          </div>
        </div>

        <div class="settings__row" style="margin-top: 16px;">
          <label>Saved Layouts</label>
          <div class="settings__layout-list" id="settings-layout-list"></div>
        </div>

        <div class="settings__row" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.05);">
          <label style="margin-bottom: 8px; opacity: 0.6;">Advanced (JSON)</label>
          <div style="display: flex; gap: 8px;">
            <button class="settings__btn" id="settings-btn-export" style="flex: 1; background: rgba(123, 140, 255, 0.1); border-color: rgba(123, 140, 255, 0.35); color: #7B8CFF;">
              📥 Export
            </button>
            <label class="settings__file-upload" style="flex: 1; padding: 10px; font-size: 13px;">
              📤 Restore
              <input type="file" id="settings-import-file" accept="application/json">
            </label>
          </div>
        </div>
      </div>

    </div>
  `;
  app.appendChild(panelEl);

  alertEl = panelEl.querySelector('#settings-file-alert');

  // Bind close buttons
  panelEl.querySelector('#settings-close').onclick = close;

  // Bind event actions
  bindUIEvents();

  // Initial form sync
  syncFormWithState();

  // Listen to state modifications
  subscribe('wallpaper', syncFormWithState);
  subscribe('settings', syncFormWithState);
  subscribe('savedLayouts', syncFormWithState);

  console.log('[Zenith:Settings] Initialized');
}
