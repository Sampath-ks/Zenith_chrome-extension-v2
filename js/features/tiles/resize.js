/**
 * Zenith — Tile Resize Engine
 *
 * Handles pointer event-based free-form resizing for tiles.
 * Modifies CSS custom properties --tile-width and --tile-height dynamically.
 * Supports grid snapping and height-based title hiding.
 *
 * @module features/tiles/resize
 */

import { getState } from '../../core/state.js';

/**
 * Configure drag-to-resize behavior on a tile element using a handle.
 *
 * @param {HTMLElement} tileEl - The main Tile DOM element.
 * @param {HTMLElement} handleEl - The resize handle element in the corner.
 * @param {object} tileData - State data for the tile (width, height).
 * @param {function(number, number)} onResizeEnd - Callback triggered when resize completes.
 */
export function setupResizable(tileEl, handleEl, tileData, onResizeEnd) {
  let isResizing = false;
  let startX = 0;
  let startY = 0;
  let startWidth = tileData.width || 96;
  let startHeight = tileData.height || 96;

  // Track active sizes
  let currentWidth = startWidth;
  let currentHeight = startHeight;

  handleEl.addEventListener('pointerdown', (e) => {
    // Only allow left-click pointer dragging for resize (button 0)
    if (e.button !== 0) return;

    isResizing = true;
    tileEl.classList.add('resizing');
    handleEl.setPointerCapture(e.pointerId);

    startX = e.clientX;
    startY = e.clientY;

    // Load initial width & height from CSS variables or state
    startWidth = parseInt(tileEl.style.getPropertyValue('--tile-width'), 10) || tileData.width || 96;
    startHeight = parseInt(tileEl.style.getPropertyValue('--tile-height'), 10) || tileData.height || 96;

    currentWidth = startWidth;
    currentHeight = startHeight;

    e.preventDefault();
    e.stopPropagation(); // Prevent triggering tile drag
  });

  handleEl.addEventListener('pointermove', (e) => {
    if (!isResizing) return;

    const dw = e.clientX - startX;
    const dh = e.clientY - startY;

    const targetWidth = startWidth + dw;
    const targetHeight = startHeight + dh;

    // Minimum size 56px, maximum 360px
    const minSize = 56;
    const maxSize = 360;

    currentWidth = Math.max(minSize, Math.min(targetWidth, maxSize));
    currentHeight = Math.max(minSize, Math.min(targetHeight, maxSize));

    // Update CSS custom properties for instant layout rendering
    tileEl.style.setProperty('--tile-width', `${currentWidth}px`);
    tileEl.style.setProperty('--tile-height', `${currentHeight}px`);

    // Dynamic title hiding if height is too small
    tileEl.classList.toggle('zenith-tile--no-title', currentHeight < 64);

    e.preventDefault();
    e.stopPropagation();
  });

  const endResize = (e) => {
    if (!isResizing) return;
    isResizing = false;

    tileEl.classList.remove('resizing');
    try {
      handleEl.releasePointerCapture(e.pointerId);
    } catch (err) {
      // Ignore
    }

    // Grid snapping logic
    const { settings } = getState();
    let finalWidth = currentWidth;
    let finalHeight = currentHeight;

    if (settings.snapGrid) {
      const gridSize = settings.snapGridSize || 20;

      // Snap width and height to closest grid cell increment
      finalWidth = Math.round(finalWidth / gridSize) * gridSize;
      finalHeight = Math.round(finalHeight / gridSize) * gridSize;

      // Re-enforce min/max boundaries
      const minSize = 56;
      const maxSize = 360;
      finalWidth = Math.max(minSize, Math.min(finalWidth, maxSize));
      finalHeight = Math.max(minSize, Math.min(finalHeight, maxSize));

      // Apply snapped sizes
      tileEl.style.setProperty('--tile-width', `${finalWidth}px`);
      tileEl.style.setProperty('--tile-height', `${finalHeight}px`);
      tileEl.classList.toggle('zenith-tile--no-title', finalHeight < 64);
    }

    if (onResizeEnd) {
      onResizeEnd(finalWidth, finalHeight);
    }

    e.preventDefault();
    e.stopPropagation();
  };

  handleEl.addEventListener('pointerup', endResize);
  handleEl.addEventListener('pointercancel', endResize);
}
