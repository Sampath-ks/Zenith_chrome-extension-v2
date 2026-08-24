/**
 * @fileoverview Minimal DOM helper utilities for the Zenith extension.
 * @module core/dom
 */

/**
 * Select the first element matching a CSS selector.
 * @param {string} selector - CSS selector string.
 * @param {ParentNode} [root=document] - Root element to query within.
 * @returns {Element|null}
 */
export const $ = (selector, root = document) => root.querySelector(selector);

/**
 * Select all elements matching a CSS selector (returns a real Array).
 * @param {string} selector - CSS selector string.
 * @param {ParentNode} [root=document] - Root element to query within.
 * @returns {Element[]}
 */
export const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

/**
 * Create a DOM element with optional attributes and children.
 *
 * @param {string} tag - HTML tag name (e.g. `'div'`, `'button'`).
 * @param {Object<string, *>} [attrs={}] - Attribute key/value pairs.
 *   Keys prefixed with `on` (e.g. `onClick`) are registered as event listeners.
 *   The special key `className` maps to `el.className`.
 *   The special key `style` accepts either a string or an object of CSS properties.
 * @param {Array<Node|string>} [children=[]] - Child nodes or text strings.
 * @returns {HTMLElement}
 *
 * @example
 * createElement('button', { className: 'btn', onClick: handleClick }, ['Save']);
 */
export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;

    // Event listeners: onClick → click
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
      continue;
    }

    // className shorthand
    if (key === 'className') {
      el.className = value;
      continue;
    }

    // textContent — DOM property, not an HTML attribute
    if (key === 'textContent') {
      el.textContent = value;
      continue;
    }

    // ariaLabel mapping
    if (key === 'ariaLabel') {
      el.setAttribute('aria-label', String(value));
      continue;
    }

    // Style — object or string
    if (key === 'style') {
      if (typeof value === 'string') {
        el.style.cssText = value;
      } else if (typeof value === 'object') {
        Object.assign(el.style, value);
      }
      continue;
    }

    // Boolean attribute (e.g. disabled, hidden)
    if (value === true) {
      el.setAttribute(key, '');
      continue;
    }

    el.setAttribute(key, String(value));
  }

  for (const child of children) {
    if (child == null) continue;
    el.append(
      typeof child === 'string' ? document.createTextNode(child) : child,
    );
  }

  return el;
}

/**
 * Attach an event listener to an element.
 * @param {EventTarget} element - Target element.
 * @param {string} event - Event name (e.g. `'click'`).
 * @param {EventListenerOrEventListenerObject} handler - Callback.
 * @param {AddEventListenerOptions|boolean} [options] - Listener options.
 * @returns {void}
 */
export const on = (element, event, handler, options) =>
  element.addEventListener(event, handler, options);

/**
 * Remove an event listener from an element.
 * @param {EventTarget} element - Target element.
 * @param {string} event - Event name.
 * @param {EventListenerOrEventListenerObject} handler - Previously registered callback.
 * @returns {void}
 */
export const off = (element, event, handler) =>
  element.removeEventListener(event, handler);
