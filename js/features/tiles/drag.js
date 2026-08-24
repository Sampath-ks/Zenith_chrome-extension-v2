/**
 * Zenith — Drag Engine
 *
 * Handles pointer event-based dragging for tiles.
 * Supports GPU-composited translation via CSS custom properties,
 * viewport boundary clamping, and grid snapping.
 *
 * @module features/tiles/drag
 */

import { getState } from '../../core/state.js';

/**
 * Configure drag-and-drop behavior on a tile element.
 *
 * @param {HTMLElement} tileEl - The DOM element of the tile.
 * @param {object} tileData - State data for the tile (x, y, size).
 * @param {function(number, number)} onDragEnd - Callback triggered when drag completes.
 */
export function setupDraggable(tileEl, tileData, onDragEnd) {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialX = tileData.x || 0;
  let initialY = tileData.y || 0;

  // Track the current position during dragging
  let currentX = initialX;
  let currentY = initialY;

  tileEl.addEventListener('pointerdown', (e) => {
    // Only allow left-click pointer dragging (button 0)
    // Ignore if clicking on control buttons inside the tile
    if (e.button !== 0 || e.target.closest('.tile__controls')) {
      return;
    }

    isDragging = true;
    tileEl.classList.add('dragging');
    tileEl.setPointerCapture(e.pointerId);

    startX = e.clientX;
    startY = e.clientY;

    // Load initial values from current state properties in case they shifted
    initialX = parseInt(tileEl.style.getPropertyValue('--tile-x'), 10) || tileData.x || 0;
    initialY = parseInt(tileEl.style.getPropertyValue('--tile-y'), 10) || tileData.y || 0;
    
    currentX = initialX;
    currentY = initialY;

    e.preventDefault();
  });

  tileEl.addEventListener('pointermove', (e) => {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let targetX = initialX + dx;
    let targetY = initialY + dy;

    // Clamp coordinates within viewport with padding
    const rect = tileEl.getBoundingClientRect();
    const pad = 12; // boundary padding

    const minX = pad;
    const maxX = Math.max(pad, window.innerWidth - rect.width - pad);
    const minY = pad;
    const maxY = Math.max(pad, window.innerHeight - rect.height - pad);

    currentX = Math.max(minX, Math.min(targetX, maxX));
    currentY = Math.max(minY, Math.min(targetY, maxY));

    // Update CSS variables for high-performance compositor-only motion
    tileEl.style.setProperty('--tile-x', `${currentX}px`);
    tileEl.style.setProperty('--tile-y', `${currentY}px`);
  });

  const endDrag = (e) => {
    if (!isDragging) return;
    isDragging = false;

    tileEl.classList.remove('dragging');
    try {
      tileEl.releasePointerCapture(e.pointerId);
    } catch (err) {
      // Ignore if pointer capture already released or invalid
    }

    // Grid snapping logic
    const { settings } = getState();
    let finalX = currentX;
    let finalY = currentY;

    if (settings.snapGrid) {
      const gridSize = settings.snapGridSize || 20;
      
      // Calculate closest grid intersection
      finalX = Math.round(finalX / gridSize) * gridSize;
      finalY = Math.round(finalY / gridSize) * gridSize;

      // Re-clamp snapped coordinates
      const rect = tileEl.getBoundingClientRect();
      const pad = 12;
      const minX = pad;
      const maxX = Math.max(pad, window.innerWidth - rect.width - pad);
      const minY = pad;
      const maxY = Math.max(pad, window.innerHeight - rect.height - pad);

      finalX = Math.max(minX, Math.min(finalX, maxX));
      finalY = Math.max(minY, Math.min(finalY, maxY));

      // Apply snapped coordinates visually
      tileEl.style.setProperty('--tile-x', `${finalX}px`);
      tileEl.style.setProperty('--tile-y', `${finalY}px`);
    }

    // Trigger state persistence
    if (onDragEnd) {
      onDragEnd(finalX, finalY);
    }
  };

  tileEl.addEventListener('pointerup', endDrag);
  tileEl.addEventListener('pointercancel', endDrag);
}
