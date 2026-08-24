/**
 * Zenith — Greeting Module (Phase 0)
 *
 * Displays the current time, date, and an optional personalised
 * greeting message centred on the new-tab viewport.
 *
 * @module features/greeting/greeting
 */

import { getState, subscribe } from '../../core/state.js';
import { $, createElement } from '../../core/dom.js';

/* ------------------------------------------------------------------ */
/*  Internal references                                               */
/* ------------------------------------------------------------------ */

/** @type {HTMLElement|null} */
let containerEl = null;

/** @type {HTMLElement|null} */
let timeEl = null;

/** @type {HTMLElement|null} */
let dateEl = null;

/** @type {HTMLElement|null} */
let textEl = null;

/** @type {number|null} */
let tickInterval = null;

/* ------------------------------------------------------------------ */
/*  Private helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Return a time-of-day greeting string.
 *
 * @param {number} hour - Current hour (0–23).
 * @returns {string} "Good morning", "Good afternoon", or "Good evening".
 */
function getGreetingPhrase(hour) {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Format the current time as a string.
 *
 * @param {Date}   now    - Current date/time.
 * @param {string} format - '12h' or '24h'.
 * @returns {string} Formatted time, e.g. "3:42 PM" or "15:42".
 */
function formatTime(now, format) {
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');

  if (format === '12h') {
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${period}`;
  }

  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

/**
 * Format the current date as a human-readable string.
 *
 * @param {Date} now - Current date/time.
 * @returns {string} e.g. "Friday, May 23".
 */
function formatDate(now) {
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Update all greeting DOM elements from the current time and state.
 */
function tick() {
  const now = new Date();
  const state = getState();
  const timeVisible = state.settings?.timeVisible ?? true;
  const clockFormat = state.settings?.clockFormat ?? '12h';
  const greetingEnabled = state.settings?.greetingEnabled ?? false;
  const greetingName = state.settings?.greetingName ?? '';

  // Container Visibility
  if (containerEl) {
    containerEl.style.display = timeVisible ? 'block' : 'none';
  }

  // Time
  if (timeEl) {
    timeEl.textContent = formatTime(now, clockFormat);
    timeEl.className = clockFormat === '24h'
      ? 'greeting__time greeting__time--24h'
      : 'greeting__time';
  }

  // Date
  if (dateEl) {
    dateEl.textContent = formatDate(now);
  }

  // Greeting text
  if (textEl) {
    if (greetingEnabled) {
      const phrase = getGreetingPhrase(now.getHours());
      textEl.textContent = greetingName
        ? `${phrase}, ${greetingName}`
        : phrase;
      textEl.classList.remove('greeting__text--hidden');
    } else {
      textEl.textContent = '';
      textEl.classList.add('greeting__text--hidden');
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Initialize the greeting feature.
 *
 * Creates the greeting DOM structure, starts the clock tick, and
 * subscribes to state changes for live settings updates.
 *
 * @returns {Promise<void>}
 */
export async function init() {
  const app = $('#zenith-app');
  if (!app) {
    console.error('[Zenith:Greeting] #zenith-app not found.');
    return;
  }

  // -- Build DOM ------------------------------------------------
  containerEl = createElement('div', {
    id: 'zenith-greeting',
    className: 'greeting',
  });

  timeEl = createElement('div', { className: 'greeting__time' });
  dateEl = createElement('div', { className: 'greeting__date' });
  textEl = createElement('div', {
    className: 'greeting__text greeting__text--hidden',
  });

  containerEl.appendChild(timeEl);
  containerEl.appendChild(dateEl);
  containerEl.appendChild(textEl);

  app.appendChild(containerEl);

  // -- Initial render -------------------------------------------
  tick();

  // -- Start clock (once per minute to save CPU) ----------------
  // Align to the next full minute for accuracy
  const msUntilNextMinute = (60 - new Date().getSeconds()) * 1000;

  setTimeout(() => {
    tick();
    tickInterval = setInterval(tick, 60_000);
  }, msUntilNextMinute);

  // -- Subscribe to live settings changes -----------------------
  subscribe('settings', () => {
    tick();
  });

  console.log('[Zenith:Greeting] Initialized');
}
