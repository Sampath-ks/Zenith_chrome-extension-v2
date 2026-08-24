/**
 * Zenith — Today Dashboard
 *
 * Compact full-width bottom HUD strip displaying greeting, date,
 * task progress, inline task chips, quick note, and a Pomodoro timer.
 *
 * @module features/dashboard/dashboard
 */

import { getState, setState, subscribe } from '../../core/state.js';
import { $, createElement } from '../../core/dom.js';

/* ------------------------------------------------------------------ */
/*  Constants & Icons                                                  */
/* ------------------------------------------------------------------ */

const MAX_VISIBLE_TASKS = 5;

const ICONS = {
  spark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="dashboard__icon"><path d="M12 3c.132 5.826 3.174 8.868 9 9-5.826.132-8.868 3.174-9 9-.132-5.826-3.174-8.868-9-9 5.826-.132 8.868-3.174 9-9z"></path></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="dashboard__icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
  circle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="dashboard__icon"><circle cx="12" cy="12" r="10"></circle></svg>`,
  delete: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="dashboard__icon"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="dashboard__icon"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
  note: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="dashboard__icon"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`,
};

/* ------------------------------------------------------------------ */
/*  Internal references                                                */
/* ------------------------------------------------------------------ */

/** @type {HTMLElement|null} */
let stripEl = null;

/** @type {HTMLElement|null} */
let greetingTextEl = null;

/** @type {HTMLElement|null} */
let dateEl = null;

/** @type {HTMLElement|null} */
let progressFillEl = null;

/** @type {HTMLElement|null} */
let progressCountEl = null;

/** @type {HTMLElement|null} */
let tasksContainerEl = null;

/** @type {HTMLElement|null} */
let activePopover = null;

/** @type {HTMLElement|null} */
let activeBackdrop = null;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Get today's date string in YYYY-MM-DD format.
 * @returns {string}
 */
function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Return a time-of-day greeting string.
 * @param {number} hour
 * @returns {string}
 */
function getGreetingPhrase(hour) {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Format date as compact string: "MON 24 AUG"
 * @param {Date} now
 * @returns {string}
 */
function formatCompactDate(now) {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`;
}

/**
 * Check and perform daily reset if date has changed.
 */
function checkDailyReset() {
  const today = getState('today') || {};
  const currentDate = todayString();

  if (today.date && today.date !== currentDate) {
    // New day — reset tasks and pomodoro, keep note
    setState('today', {
      date: currentDate,
      tasks: [],
      note: today.note || '',
    });
  } else if (!today.date) {
    // First launch — set date
    setState('today.date', currentDate);
  }
}

/* ------------------------------------------------------------------ */
/*  Popover management                                                 */
/* ------------------------------------------------------------------ */

/**
 * Close any active popover.
 */
function closePopover() {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
  if (activeBackdrop) {
    activeBackdrop.remove();
    activeBackdrop = null;
  }
}

/**
 * Open a popover anchored above a trigger element.
 * @param {HTMLElement} triggerEl
 * @param {HTMLElement} contentEl
 */
function openPopover(triggerEl, contentEl) {
  closePopover();

  // Create backdrop for click-away
  activeBackdrop = createElement('div', {
    className: 'dashboard__popover-backdrop',
  });
  activeBackdrop.onclick = closePopover;

  // Create popover
  activePopover = createElement('div', {
    className: 'dashboard__popover',
  });
  activePopover.appendChild(contentEl);

  document.body.appendChild(activeBackdrop);
  document.body.appendChild(activePopover);

  // Position above the trigger
  const rect = triggerEl.getBoundingClientRect();
  const popW = 240;
  let left = rect.left + rect.width / 2 - popW / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - popW - 8));
  const bottom = window.innerHeight - rect.top + 8;

  activePopover.style.left = `${left}px`;
  activePopover.style.bottom = `${bottom}px`;
}

/* ------------------------------------------------------------------ */
/*  Greeting + Date update                                             */
/* ------------------------------------------------------------------ */

function updateGreeting() {
  const now = new Date();
  const settings = getState('settings') || {};
  const greetingEnabled = settings.greetingEnabled ?? false;
  const greetingName = settings.greetingName ?? '';

  let text;
  if (greetingEnabled) {
    const phrase = getGreetingPhrase(now.getHours());
    text = greetingName ? `${phrase}, ${greetingName}` : phrase;
  } else {
    text = getGreetingPhrase(now.getHours());
  }

  if (greetingTextEl) greetingTextEl.textContent = text;
  if (dateEl) dateEl.textContent = `· ${formatCompactDate(now)}`;
}

/* ------------------------------------------------------------------ */
/*  Progress + Tasks rendering                                         */
/* ------------------------------------------------------------------ */

function updateProgress() {
  const tasks = getState('today.tasks') || [];
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const pct = total > 0 ? (completed / total) * 100 : 0;

  if (progressFillEl) {
    progressFillEl.style.width = `${pct}%`;
  }
  if (progressCountEl) {
    progressCountEl.textContent = `${completed}/${total}`;
  }
}

function renderTasks() {
  if (!tasksContainerEl) return;
  tasksContainerEl.innerHTML = '';

  const tasks = getState('today.tasks') || [];
  const visible = tasks.slice(0, MAX_VISIBLE_TASKS);
  const overflowCount = tasks.length - visible.length;

  visible.forEach((task) => {
    const chip = createElement('div', {
      className: `dashboard__task-chip${task.completed ? ' dashboard__task-chip--completed' : ''}`,
      title: task.text,
    });

    const check = createElement('span', {
      className: 'dashboard__task-check',
    });
    check.innerHTML = task.completed ? ICONS.check : ICONS.circle;

    const text = createElement('span', {
      className: 'dashboard__task-text',
      textContent: task.text,
    });

    const del = createElement('button', {
      className: 'dashboard__task-delete',
      title: 'Delete task',
    });
    del.innerHTML = ICONS.delete;

    del.onclick = (e) => {
      e.stopPropagation();
      deleteTask(task.id);
    };

    chip.onclick = () => toggleTask(task.id);

    chip.appendChild(check);
    chip.appendChild(text);
    chip.appendChild(del);
    tasksContainerEl.appendChild(chip);
  });

  // Overflow chip
  if (overflowCount > 0) {
    const overflowChip = createElement('div', {
      className: 'dashboard__overflow-chip',
      textContent: `+${overflowCount}`,
      title: `${overflowCount} more tasks`,
    });
    overflowChip.onclick = () => showOverflowPopover(overflowChip);
    tasksContainerEl.appendChild(overflowChip);
  }

  updateProgress();
}

/* ------------------------------------------------------------------ */
/*  Task CRUD                                                          */
/* ------------------------------------------------------------------ */

function addTask(text) {
  if (!text.trim()) return;
  const tasks = [...(getState('today.tasks') || [])];
  tasks.push({
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text: text.trim(),
    completed: false,
  });
  setState('today.tasks', tasks);
}

function toggleTask(id) {
  const tasks = (getState('today.tasks') || []).map((t) =>
    t.id === id ? { ...t, completed: !t.completed } : t,
  );
  setState('today.tasks', tasks);
}

function deleteTask(id) {
  const tasks = (getState('today.tasks') || []).filter((t) => t.id !== id);
  setState('today.tasks', tasks);
}

/* ------------------------------------------------------------------ */
/*  Popovers                                                           */
/* ------------------------------------------------------------------ */

function showAddTaskPopover(triggerEl) {
  const wrapper = createElement('div');

  const title = createElement('div', {
    className: 'dashboard__popover-title',
    textContent: 'Add task',
  });

  const row = createElement('div', { className: 'dashboard__add-row' });

  const input = createElement('input', {
    className: 'dashboard__add-input',
    type: 'text',
    placeholder: 'What to do today...',
  });

  const btn = createElement('button', {
    className: 'dashboard__add-submit',
    textContent: 'Add',
  });

  const handleAdd = () => {
    if (input.value.trim()) {
      addTask(input.value);
      closePopover();
    }
  };

  btn.onclick = handleAdd;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') closePopover();
  };

  row.appendChild(input);
  row.appendChild(btn);
  wrapper.appendChild(title);
  wrapper.appendChild(row);

  openPopover(triggerEl, wrapper);
  // Focus after popover is placed in DOM
  requestAnimationFrame(() => input.focus());
}

function showNotePopover(triggerEl) {
  const wrapper = createElement('div');

  const title = createElement('div', {
    className: 'dashboard__popover-title',
    textContent: 'Quick note',
  });

  const textarea = createElement('textarea', {
    className: 'dashboard__note-textarea',
    placeholder: 'Jot something down...',
  });
  textarea.value = getState('today.note') || '';

  const saveBtn = createElement('button', {
    className: 'dashboard__note-save',
    textContent: 'Save',
  });

  // Auto-save on input
  let saveTimeout = null;
  textarea.oninput = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      setState('today.note', textarea.value);
    }, 400);
  };

  saveBtn.onclick = () => {
    setState('today.note', textarea.value);
    closePopover();
  };

  textarea.onkeydown = (e) => {
    if (e.key === 'Escape') closePopover();
  };

  wrapper.appendChild(title);
  wrapper.appendChild(textarea);
  wrapper.appendChild(saveBtn);

  openPopover(triggerEl, wrapper);
  requestAnimationFrame(() => textarea.focus());
}

function showOverflowPopover(triggerEl) {
  const tasks = getState('today.tasks') || [];
  const overflow = tasks.slice(MAX_VISIBLE_TASKS);

  const wrapper = createElement('div');

  const title = createElement('div', {
    className: 'dashboard__popover-title',
    textContent: `${overflow.length} more tasks`,
  });

  const list = createElement('div', { className: 'dashboard__overflow-list' });

  overflow.forEach((task) => {
    const item = createElement('div', {
      className: `dashboard__overflow-item${task.completed ? ' dashboard__overflow-item--completed' : ''}`,
    });

    const check = createElement('span', {
      className: 'dashboard__overflow-check',
    });
    check.innerHTML = task.completed ? ICONS.check : ICONS.circle;

    const text = createElement('span', {
      className: 'dashboard__overflow-text',
      textContent: task.text,
    });

    const del = createElement('button', {
      className: 'dashboard__overflow-delete',
    });
    del.innerHTML = ICONS.delete;

    del.onclick = (e) => {
      e.stopPropagation();
      deleteTask(task.id);
      closePopover();
    };

    item.onclick = () => {
      toggleTask(task.id);
      closePopover();
    };

    item.appendChild(check);
    item.appendChild(text);
    item.appendChild(del);
    list.appendChild(item);
  });

  wrapper.appendChild(title);
  wrapper.appendChild(list);

  openPopover(triggerEl, wrapper);
}

/* ------------------------------------------------------------------ */
/*  DOM construction                                                   */
/* ------------------------------------------------------------------ */

function buildStrip() {
  stripEl = createElement('div', {
    id: 'zenith-dashboard',
    className: 'dashboard',
  });

  // 1. Greeting section
  const greetingSection = createElement('div', {
    className: 'dashboard__greeting',
  });

  const star = createElement('span', {
      className: 'dashboard__greeting-star',
    });
    star.innerHTML = ICONS.spark;

  greetingTextEl = createElement('span', {
    className: 'dashboard__greeting-text',
  });

  dateEl = createElement('span', {
    className: 'dashboard__date',
  });

  greetingSection.appendChild(star);
  greetingSection.appendChild(greetingTextEl);
  greetingSection.appendChild(dateEl);
  stripEl.appendChild(greetingSection);

  // Divider
  stripEl.appendChild(createElement('div', { className: 'dashboard__divider' }));

  // 2. Progress section
  const progressSection = createElement('div', {
    className: 'dashboard__progress',
  });

  const progressLabel = createElement('span', {
    className: 'dashboard__progress-label',
    textContent: 'TODAY',
  });

  const progressBar = createElement('div', {
    className: 'dashboard__progress-bar',
  });

  progressFillEl = createElement('div', {
    className: 'dashboard__progress-fill',
  });

  progressCountEl = createElement('span', {
    className: 'dashboard__progress-count',
  });

  progressBar.appendChild(progressFillEl);
  progressSection.appendChild(progressLabel);
  progressSection.appendChild(progressBar);
  progressSection.appendChild(progressCountEl);
  stripEl.appendChild(progressSection);

  // Divider
  stripEl.appendChild(createElement('div', { className: 'dashboard__divider dashboard__section--medium' }));

  // 3. Tasks section (medium priority — hides on narrow)
  tasksContainerEl = createElement('div', {
    className: 'dashboard__tasks dashboard__section--medium',
  });
  stripEl.appendChild(tasksContainerEl);

  // Divider
  stripEl.appendChild(createElement('div', { className: 'dashboard__divider' }));

  // 4. Actions section
  const actionsSection = createElement('div', {
    className: 'dashboard__actions',
  });

  // Add task button
  const addBtn = createElement('button', {
    className: 'dashboard__btn dashboard__btn--accent',
    title: 'Add task',
    ariaLabel: 'Add task',
  });
  addBtn.innerHTML = ICONS.plus;
  addBtn.onclick = () => showAddTaskPopover(addBtn);
  actionsSection.appendChild(addBtn);

  // Quick note button (low priority — hides first)
  const noteBtn = createElement('button', {
    className: 'dashboard__btn dashboard__section--low',
    title: 'Quick note',
    ariaLabel: 'Quick note',
  });
  noteBtn.innerHTML = ICONS.note;
  noteBtn.onclick = () => showNotePopover(noteBtn);
  actionsSection.appendChild(noteBtn);

  actionsSection.appendChild(noteBtn);

  stripEl.appendChild(actionsSection);

  return stripEl;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Initialize the Today Dashboard feature.
 * @returns {Promise<void>}
 */
export async function init() {
  const app = $('#zenith-app');
  if (!app) {
    console.error('[Zenith:Dashboard] #zenith-app not found.');
    return;
  }

  // Daily reset check
  checkDailyReset();

  // Build DOM
  const strip = buildStrip();
  app.appendChild(strip);

  // Initial render
  updateGreeting();
  renderTasks();

  // Update greeting every minute
  const msUntilNextMinute = (60 - new Date().getSeconds()) * 1000;
  setTimeout(() => {
    updateGreeting();
    setInterval(updateGreeting, 60_000);
  }, msUntilNextMinute);

  // Subscribe to state changes
  subscribe('today.tasks', () => {
    renderTasks();
  });

  subscribe('settings', () => {
    updateGreeting();
  });

  console.log('[Zenith:Dashboard] Initialized');
}
