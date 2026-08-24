/**
 * Zenith — Wallpaper Utilities
 *
 * Helper functions for wallpaper media processing.
 *
 * @module features/wallpaper/wallpaper-utils
 */

import {
  MAX_VIDEO_SIZE_MB,
  VIDEO_WARNING_SIZE_MB,
  MAX_IMAGE_DIMENSION,
  IMAGE_QUALITY
} from '../../core/constants.js';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

/** Allowed video MIME types. */
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

/* ------------------------------------------------------------------ */
/*  Image utilities                                                   */
/* ------------------------------------------------------------------ */

/**
 * Compress an image file to a target maximum dimension and quality.
 *
 * Resizes the image using a Canvas element, maintaining aspect ratio,
 * and exports it as a JPEG at the specified quality factor.
 *
 * @param {File}   file                - Source image file.
 * @param {number} [maxDimension=3840] - Max width/height in pixels.
 * @param {number} [quality=0.85]      - JPEG quality (0–1).
 * @returns {Promise<Blob>} The compressed image blob.
 */
export async function compressImage(file, maxDimension = MAX_IMAGE_DIMENSION, quality = IMAGE_QUALITY) {
  return new Promise((resolve, reject) => {
    // If it's not an image, return it as-is
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.width;
      let height = img.height;

      // Scale down if either dimension exceeds maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      // Create a canvas for drawing
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file); // Fallback to original file on context error
        return;
      }

      // Draw the image onto the canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Export canvas to a JPEG blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            resolve(file); // Fallback to original file if blob export fails
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for compression.'));
    };

    img.src = objectUrl;
  });
}

/* ------------------------------------------------------------------ */
/*  Video utilities                                                   */
/* ------------------------------------------------------------------ */

/**
 * Validate a video file for use as a wallpaper.
 *
 * Checks MIME type and file size. Returns validation flags.
 *
 * @param {File} file - Video file to validate.
 * @returns {{ valid: boolean, warning: boolean, error: string|null, message: string|null, size: number }}
 */
export function validateVideo(file) {
  const size = file.size;

  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return {
      valid: false,
      warning: false,
      error: `Unsupported video format "${file.type}". Allowed formats: ${ALLOWED_VIDEO_TYPES.join(', ')}.`,
      message: null,
      size,
    };
  }

  const sizeMB = size / (1024 * 1024);

  if (sizeMB > MAX_VIDEO_SIZE_MB) {
    return {
      valid: false,
      warning: false,
      error: `Video exceeds the size limit of ${MAX_VIDEO_SIZE_MB}MB (file size: ${sizeMB.toFixed(1)}MB).`,
      message: null,
      size,
    };
  }

  if (sizeMB > VIDEO_WARNING_SIZE_MB) {
    return {
      valid: true,
      warning: true,
      error: null,
      message: `Large video file (${sizeMB.toFixed(1)}MB). This is above the recommended limit of ${VIDEO_WARNING_SIZE_MB}MB and may degrade browser performance.`,
      size,
    };
  }

  return {
    valid: true,
    warning: false,
    error: null,
    message: null,
    size,
  };
}

/* ------------------------------------------------------------------ */
/*  Blob URL management                                               */
/* ------------------------------------------------------------------ */

/**
 * Create an object URL for a Blob or File.
 *
 * Thin wrapper to centralise URL lifecycle management.
 *
 * @param {Blob|File} blob - Source blob.
 * @returns {string} Object URL.
 */
export function createObjectURL(blob) {
  return URL.createObjectURL(blob);
}

/**
 * Revoke a previously created object URL.
 *
 * @param {string} url - Object URL to revoke.
 */
export function revokeObjectURL(url) {
  if (url) {
    URL.revokeObjectURL(url);
  }
}
