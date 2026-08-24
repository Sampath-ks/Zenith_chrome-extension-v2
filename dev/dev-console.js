/**
 * Zenith — Developer Console
 *
 * A self-contained testing panel injected into the document to verify
 * all features of the Wallpaper Engine (Phase 1) including image/video uploads,
 * validations, gradients, overlay settings, and performance mode.
 *
 * Saved in `_dev/dev-console.js` and loaded dynamically.
 */

import { getState, setState, subscribe } from '../js/core/state.js';
import { saveBlob, deleteBlob, listBlobKeys } from '../js/core/storage.js';
import { compressImage, validateVideo } from '../js/features/wallpaper/wallpaper-utils.js';
import { GRADIENT_PRESETS } from '../js/core/constants.js';

// Self-contained CSS injection
const CSS_STYLES = `
  #zenith-dev-toggle {
    position: fixed;
    bottom: 20px;
    left: 20px;
    z-index: 99999;
    padding: 10px 16px;
    background: rgba(15, 15, 20, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: var(--z-radius-md, 12px);
    color: rgba(255, 255, 255, 0.8);
    font-family: var(--z-font-family, sans-serif);
    font-size: var(--z-font-size-sm, 13px);
    font-weight: 500;
    cursor: pointer;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }

  #zenith-dev-toggle:hover {
    background: rgba(25, 25, 35, 0.8);
    border-color: rgba(123, 140, 255, 0.5);
    color: #fff;
  }

  #zenith-dev-panel {
    position: fixed;
    bottom: 80px;
    left: 20px;
    width: 320px;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
    z-index: 99998;
    background: rgba(10, 10, 12, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--z-radius-lg, 16px);
    padding: 20px;
    color: #fff;
    font-family: var(--z-font-family, sans-serif);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.7);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
    transform: translateY(20px) scale(0.95);
    opacity: 0;
    pointer-events: none;
  }

  #zenith-dev-panel.open {
    transform: translateY(0) scale(1);
    opacity: 1;
    pointer-events: all;
  }

  .dev-section {
    margin-bottom: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    padding-bottom: 16px;
  }

  .dev-section:last-child {
    margin-bottom: 0;
    border-bottom: none;
    padding-bottom: 0;
  }

  .dev-title {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .dev-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }

  .dev-row label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .dev-input-file {
    background: rgba(255, 255, 255, 0.05);
    border: 1px dashed rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 10px;
    font-size: 11px;
    cursor: pointer;
    text-align: center;
    color: rgba(255, 255, 255, 0.7);
    transition: all 0.2s ease;
  }

  .dev-input-file:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(123, 140, 255, 0.5);
  }

  .dev-input-file input {
    display: none;
  }

  .dev-btn-group {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .dev-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
    padding: 8px;
    font-size: 11px;
    border-radius: 6px;
    cursor: pointer;
    text-align: center;
    transition: all 0.2s ease;
  }

  .dev-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .dev-btn.active {
    background: rgba(123, 140, 255, 0.2);
    border-color: rgba(123, 140, 255, 0.8);
    color: #fff;
    font-weight: 500;
  }

  .dev-grid-presets {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-top: 10px;
  }

  .dev-preset-item {
    height: 40px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    cursor: pointer;
    position: relative;
    transition: transform 0.2s ease, border-color 0.2s ease;
  }

  .dev-preset-item:hover {
    transform: scale(1.05);
    border-color: #fff;
  }

  .dev-preset-item.active::after {
    content: '✓';
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    color: #fff;
    font-size: 12px;
    font-weight: bold;
    border-radius: 5px;
  }

  .dev-slider-container {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .dev-slider-container input[type="range"] {
    flex-grow: 1;
    accent-color: #7B8CFF;
    cursor: pointer;
  }

  .dev-slider-value {
    font-size: 12px;
    width: 32px;
    text-align: right;
    color: rgba(255, 255, 255, 0.7);
  }

  .dev-status {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    padding: 10px;
    font-family: monospace;
    font-size: 10px;
    line-height: 1.4;
    max-height: 120px;
    overflow-y: auto;
    color: rgba(255, 255, 255, 0.65);
    white-space: pre-wrap;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .dev-status-alert {
    background: rgba(255, 107, 107, 0.15);
    border: 1px solid rgba(255, 107, 107, 0.3);
    border-radius: 6px;
    padding: 8px;
    font-size: 11px;
    color: #ff8b8b;
    margin-top: 8px;
    display: none;
  }

  .dev-status-alert.warn {
    background: rgba(255, 211, 107, 0.15);
    border-color: rgba(255, 211, 107, 0.3);
    color: #ffd88b;
  }

  .dev-checkbox-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    cursor: pointer;
    user-select: none;
    color: rgba(255, 255, 255, 0.85);
  }

  .dev-checkbox-row input {
    accent-color: #7B8CFF;
    cursor: pointer;
  }
`;

class DevConsole {
  constructor() {
    this.panelEl = null;
    this.toggleEl = null;
    this.alertEl = null;
  }

  init() {
    // Inject Styles
    const styleEl = document.createElement('style');
    styleEl.textContent = CSS_STYLES;
    document.head.appendChild(styleEl);

    // Build DOM
    this.toggleEl = document.createElement('button');
    this.toggleEl.id = 'zenith-dev-toggle';
    this.toggleEl.textContent = '⚙️ Dev Console';
    this.toggleEl.onclick = () => this.togglePanel();
    document.body.appendChild(this.toggleEl);

    this.panelEl = document.createElement('div');
    this.panelEl.id = 'zenith-dev-panel';
    this.panelEl.innerHTML = `
      <div class="dev-section">
        <div class="dev-title">Wallpaper Type</div>
        <div class="dev-btn-group">
          <button class="dev-btn" data-type="image">Image</button>
          <button class="dev-btn" data-type="video">Video</button>
          <button class="dev-btn" data-type="gradient">Gradient</button>
        </div>
      </div>

      <div class="dev-section" id="dev-sec-media">
        <div class="dev-title">Media Upload</div>
        <div id="dev-image-upload-wrapper">
          <label class="dev-input-file">
            📁 Select Custom Image
            <input type="file" id="dev-upload-image" accept="image/jpeg,image/png,image/webp">
          </label>
        </div>
        <div id="dev-video-upload-wrapper" style="display:none;">
          <label class="dev-input-file">
            🎥 Select Custom Video
            <input type="file" id="dev-upload-video" accept="video/mp4,video/webm">
          </label>
        </div>
        <div class="dev-status-alert" id="dev-media-alert"></div>
      </div>

      <div class="dev-section" id="dev-sec-gradients" style="display:none;">
        <div class="dev-title">Curated Gradients</div>
        <div class="dev-grid-presets" id="dev-presets-container"></div>
      </div>

      <div class="dev-section">
        <div class="dev-title">Adjustments</div>
        <div class="dev-row">
          <label>Dimming Overlay</label>
          <div class="dev-slider-container">
            <input type="range" id="dev-slider-overlay" min="0" max="1" step="0.05" value="0.3">
            <span class="dev-slider-value" id="dev-val-overlay">30%</span>
          </div>
        </div>
        <div class="dev-row">
          <label>Background Blur</label>
          <div class="dev-slider-container">
            <input type="range" id="dev-slider-blur" min="0" max="40" step="1" value="0">
            <span class="dev-slider-value" id="dev-val-blur">0px</span>
          </div>
        </div>
      </div>

      <div class="dev-section">
        <div class="dev-title">System Settings</div>
        <label class="dev-checkbox-row">
          <input type="checkbox" id="dev-chk-perf">
          <span>Enable Performance Mode</span>
        </label>
        <label class="dev-checkbox-row" style="margin-top: 8px;">
          <input type="checkbox" id="dev-chk-snap">
          <span>Snap to Grid (20px)</span>
        </label>
      </div>

      <div class="dev-section">
        <div class="dev-title">Shortcut Tiles</div>
        <div class="dev-row">
          <label>Shortcut URL</label>
          <input type="text" id="dev-tile-url" placeholder="https://github.com" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 6px; color: #fff; font-size: 12px;">
        </div>
        <div class="dev-row">
          <label>Title</label>
          <input type="text" id="dev-tile-title" placeholder="GitHub" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 6px; color: #fff; font-size: 12px;">
        </div>
        <button class="dev-btn" id="dev-btn-add-tile" style="width: 100%; border-color: rgba(123, 140, 255, 0.4); color: #7B8CFF; font-weight: 500; margin-top: 4px;">
          ＋ Add Shortcut Tile
        </button>
      </div>

      <div class="dev-section">
        <div class="dev-title">State Viewer</div>
        <div class="dev-status" id="dev-state-viewer">Loading state...</div>
        <div class="dev-btn-group" style="margin-top:10px;">
          <button class="dev-btn" id="dev-btn-reset" style="grid-column: span 3; border-color: rgba(255,107,107,0.3); color: #ff8b8b;">
            ⚠️ Reset Application State
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(this.panelEl);
    this.alertEl = this.panelEl.querySelector('#dev-media-alert');

    // Register UI listeners
    this.setupListeners();

    // Initial render from state
    this.renderFromState();

    // Subscribe to state updates for UI feedback
    subscribe('wallpaper', () => {
      this.renderFromState();
      this.updateStateViewer();
    });
    subscribe('settings', () => {
      this.renderFromState();
      this.updateStateViewer();
    });

    this.updateStateViewer();
  }

  togglePanel() {
    this.panelEl.classList.toggle('open');
  }

  showAlert(text, isWarning = false) {
    this.alertEl.textContent = text;
    this.alertEl.className = 'dev-status-alert';
    if (isWarning) {
      this.alertEl.classList.add('warn');
    }
    this.alertEl.style.display = 'block';
  }

  hideAlert() {
    this.alertEl.style.display = 'none';
  }

  setupListeners() {
    // 1. Wallpaper Type Buttons
    const typeButtons = this.panelEl.querySelectorAll('.dev-btn[data-type]');
    typeButtons.forEach(btn => {
      btn.onclick = () => {
        const selectedType = btn.getAttribute('data-type');
        const state = getState();
        const currentWallpaper = state.wallpaper;

        setState('wallpaper', {
          ...currentWallpaper,
          type: selectedType
        });
      };
    });

    // 2. Custom Image Upload
    const imgInput = this.panelEl.querySelector('#dev-upload-image');
    imgInput.onchange = async (e) => {
      this.hideAlert();
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        this.showAlert('Compressing image...', true);
        const compressedBlob = await compressImage(file);
        
        const oldActiveId = getState().wallpaper.activeId;
        const newId = `img-user-${Date.now()}`;
        
        this.showAlert('Saving to IndexedDB...', true);
        await saveBlob(newId, compressedBlob);

        const currentWallpaper = getState().wallpaper;
        setState('wallpaper', {
          ...currentWallpaper,
          type: 'image',
          activeId: newId,
          gradient: null
        });

        // Delete old blob to keep storage tidy
        if (oldActiveId && oldActiveId.startsWith('img-user-')) {
          await deleteBlob(oldActiveId);
        }
        
        this.hideAlert();
      } catch (err) {
        console.error(err);
        this.showAlert(`Image upload failed: ${err.message}`);
      }
    };

    // 3. Custom Video Upload
    const vidInput = this.panelEl.querySelector('#dev-upload-video');
    vidInput.onchange = async (e) => {
      this.hideAlert();
      const file = e.target.files?.[0];
      if (!file) return;

      const validation = validateVideo(file);
      if (!validation.valid) {
        this.showAlert(validation.error);
        return;
      }

      if (validation.warning) {
        const proceed = confirm(`${validation.message}\n\nDo you want to proceed anyway?`);
        if (!proceed) {
          vidInput.value = '';
          return;
        }
      }

      try {
        this.showAlert('Saving video to IndexedDB...', true);
        
        const oldActiveId = getState().wallpaper.activeId;
        const newId = `vid-user-${Date.now()}`;
        
        await saveBlob(newId, file);

        const currentWallpaper = getState().wallpaper;
        setState('wallpaper', {
          ...currentWallpaper,
          type: 'video',
          activeId: newId,
          gradient: null
        });

        // Delete old blob
        if (oldActiveId && (oldActiveId.startsWith('img-user-') || oldActiveId.startsWith('vid-user-'))) {
          await deleteBlob(oldActiveId);
        }

        this.hideAlert();
      } catch (err) {
        console.error(err);
        this.showAlert(`Video upload failed: ${err.message}`);
      }
    };

    // 4. Gradient Presets
    const presetsContainer = this.panelEl.querySelector('#dev-presets-container');
    GRADIENT_PRESETS.forEach((grad, index) => {
      const presetItem = document.createElement('div');
      presetItem.className = 'dev-preset-item';
      presetItem.style.backgroundImage = grad;
      presetItem.title = `Preset ${index + 1}`;
      presetItem.onclick = () => {
        const currentWallpaper = getState().wallpaper;
        setState('wallpaper', {
          ...currentWallpaper,
          type: 'gradient',
          gradient: index,
          activeId: null
        });
      };
      presetsContainer.appendChild(presetItem);
    });

    // 5. Sliders (Overlay & Blur)
    const sliderOverlay = this.panelEl.querySelector('#dev-slider-overlay');
    const valOverlay = this.panelEl.querySelector('#dev-val-overlay');
    sliderOverlay.oninput = (e) => {
      const value = parseFloat(e.target.value);
      valOverlay.textContent = `${Math.round(value * 100)}%`;
      
      const currentWallpaper = getState().wallpaper;
      setState('wallpaper', {
        ...currentWallpaper,
        overlay: value
      });
    };

    const sliderBlur = this.panelEl.querySelector('#dev-slider-blur');
    const valBlur = this.panelEl.querySelector('#dev-val-blur');
    sliderBlur.oninput = (e) => {
      const value = parseInt(e.target.value, 10);
      valBlur.textContent = `${value}px`;

      const currentWallpaper = getState().wallpaper;
      setState('wallpaper', {
        ...currentWallpaper,
        blur: value
      });
    };

    // 6. Performance Mode Checkbox
    const chkPerf = this.panelEl.querySelector('#dev-chk-perf');
    chkPerf.onchange = (e) => {
      const isChecked = e.target.checked;
      const settings = getState().settings;
      setState('settings', {
        ...settings,
        performanceMode: isChecked
      });

      // Manually trigger class toggle on body
      document.body.classList.toggle('performance-mode', isChecked);
    };

    // 6b. Snap Grid Checkbox
    const chkSnap = this.panelEl.querySelector('#dev-chk-snap');
    chkSnap.onchange = (e) => {
      const isChecked = e.target.checked;
      const settings = getState().settings;
      setState('settings', {
        ...settings,
        snapGrid: isChecked
      });
    };

    // 6c. Add Shortcut Tile
    const btnAddTile = this.panelEl.querySelector('#dev-btn-add-tile');
    const inputUrl = this.panelEl.querySelector('#dev-tile-url');
    const inputTitle = this.panelEl.querySelector('#dev-tile-title');
    btnAddTile.onclick = () => {
      const url = inputUrl.value.trim();
      const title = inputTitle.value.trim();

      if (!url) {
        alert('Please enter a URL.');
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
        favicon: null, // Resolves dynamically in tiles.js
        x: Math.round(window.innerWidth / 2 - 48 + (Math.random() * 80 - 40)),
        y: Math.round(window.innerHeight / 2 - 48 + (Math.random() * 80 - 40)),
        width: 96,
        height: 96,
        size: 'medium',
        order: getState().tiles.length
      };

      // Snap coordinates immediately if snapGrid is active
      const settings = getState().settings;
      if (settings.snapGrid) {
        const gridSize = settings.snapGridSize || 20;
        newTile.x = Math.round(newTile.x / gridSize) * gridSize;
        newTile.y = Math.round(newTile.y / gridSize) * gridSize;
      }

      const tiles = [...getState().tiles, newTile];
      setState('tiles', tiles);

      inputUrl.value = '';
      inputTitle.value = '';
    };

    // 7. Reset State
    const btnReset = this.panelEl.querySelector('#dev-btn-reset');
    btnReset.onclick = async () => {
      if (!confirm('Are you sure you want to completely clear Zenith storage & state? This will reload the page.')) {
        return;
      }
      
      try {
        // Clear IndexedDB blobs
        const keys = await listBlobKeys();
        for (const k of keys) {
          await deleteBlob(k);
        }

        // Clear chrome.storage
        if (typeof chrome !== 'undefined' && chrome.storage) {
          await chrome.storage.local.clear();
        } else {
          localStorage.clear();
        }

        // Reload
        window.location.reload();
      } catch (err) {
        alert(`Reset failed: ${err.message}`);
      }
    };
  }

  renderFromState() {
    const state = getState();
    const { type, overlay, blur, gradient } = state.wallpaper;
    const { performanceMode } = state.settings;

    // Type buttons
    const typeButtons = this.panelEl.querySelectorAll('.dev-btn[data-type]');
    typeButtons.forEach(btn => {
      const bType = btn.getAttribute('data-type');
      btn.classList.toggle('active', bType === type);
    });

    // Toggle conditional sections
    const mediaSec = this.panelEl.querySelector('#dev-sec-media');
    const gradientSec = this.panelEl.querySelector('#dev-sec-gradients');
    const imgUploadWrap = this.panelEl.querySelector('#dev-image-upload-wrapper');
    const vidUploadWrap = this.panelEl.querySelector('#dev-video-upload-wrapper');

    if (type === 'gradient') {
      mediaSec.style.display = 'none';
      gradientSec.style.display = 'block';
    } else {
      mediaSec.style.display = 'block';
      gradientSec.style.display = 'none';
      
      if (type === 'image') {
        imgUploadWrap.style.display = 'block';
        vidUploadWrap.style.display = 'none';
      } else {
        imgUploadWrap.style.display = 'none';
        vidUploadWrap.style.display = 'block';
      }
    }

    // Preset items active state
    const presetItems = this.panelEl.querySelectorAll('.dev-preset-item');
    presetItems.forEach((item, index) => {
      item.classList.toggle('active', type === 'gradient' && gradient === index);
    });

    // Sliders
    const sliderOverlay = this.panelEl.querySelector('#dev-slider-overlay');
    sliderOverlay.value = overlay ?? 0.3;
    this.panelEl.querySelector('#dev-val-overlay').textContent = `${Math.round((overlay ?? 0.3) * 100)}%`;

    const sliderBlur = this.panelEl.querySelector('#dev-slider-blur');
    sliderBlur.value = blur ?? 0;
    this.panelEl.querySelector('#dev-val-blur').textContent = `${blur ?? 0}px`;

    // Performance mode
    this.panelEl.querySelector('#dev-chk-perf').checked = !!performanceMode;

    // Snap to grid
    const { snapGrid } = state.settings;
    this.panelEl.querySelector('#dev-chk-snap').checked = !!snapGrid;
  }

  updateStateViewer() {
    const viewer = this.panelEl.querySelector('#dev-state-viewer');
    viewer.textContent = JSON.stringify(getState(), null, 2);
  }
}

// Inits the panel once document is fully loaded
window.addEventListener('load', () => {
  const consolePanel = new DevConsole();
  consolePanel.init();
});
