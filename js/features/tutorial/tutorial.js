import { getState, setState } from '../../core/state.js';
import { $, createElement } from '../../core/dom.js';

const ARROW_SVG = `
<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" class="tutorial-arrow">
  <path d="M 15 50 C 40 35, 60 65, 85 50" />
  <path d="M 60 25 Q 75 45, 85 50" />
  <path d="M 60 75 Q 75 55, 85 50" />
</svg>
`;

const TUTORIAL_STEPS = [
  { selector: '[aria-label="Add Shortcut"]', title: 'Add Shortcut', desc: 'Add quick links to your favorite sites.', side: 'left' },
  { selector: '[aria-label="Backgrounds"]', title: 'Backgrounds', desc: 'Change your vibe with dynamic videos.', side: 'left' },
  { selector: '[aria-label="Preferences"]', title: 'Preferences', desc: 'Tweak Zenith to your liking.', side: 'left' },
  { selector: '[aria-label="Restore Layout"]', title: 'Restore Layout', desc: 'Load a saved workspace configuration.', side: 'left' },
  { selector: '[aria-label="Backup Layout"]', title: 'Backup Layout', desc: 'Save your current workspace layout.', side: 'left' },
  { selector: '[aria-label="Incognito Window"]', title: 'Go Stealth', desc: 'Launch an incognito window instantly.', side: 'left' },
  { selector: '[aria-label="Add task"]', title: 'Plan your day', desc: 'Add daily tasks and track your progress.', side: 'top' },
  { selector: '[aria-label="Quick note"]', title: 'Jot it down', desc: 'Use the persistent scratchpad for quick thoughts.', side: 'top' },
];

let currentStepIndex = 0;
let overlayEl = null;
let stepContainerEl = null;
let titleEl = null;
let subtextEl = null;
let arrowWrapEl = null;
let spotlightEl = null;

function buildTutorial() {
  overlayEl = createElement('div', { className: 'tutorial-overlay' });
  
  spotlightEl = createElement('div', { className: 'tutorial-spotlight' });
  overlayEl.appendChild(spotlightEl);
  
  stepContainerEl = createElement('div', { className: 'tutorial-step' });

  const textWrapper = createElement('div', { className: 'tutorial-text-wrapper' });
  titleEl = createElement('div', { className: 'tutorial-text' });
  subtextEl = createElement('div', { className: 'tutorial-subtext' });
  
  textWrapper.appendChild(titleEl);
  textWrapper.appendChild(subtextEl);

  arrowWrapEl = createElement('div', { className: 'tutorial-arrow-wrap' });
  arrowWrapEl.innerHTML = ARROW_SVG;

  // The order depends on side, but we will adjust DOM order dynamically in renderStep
  stepContainerEl.appendChild(textWrapper);
  stepContainerEl.appendChild(arrowWrapEl);

  overlayEl.appendChild(stepContainerEl);
  document.body.appendChild(overlayEl);

  // Click to advance
  overlayEl.addEventListener('click', advanceTutorial);
}

function renderStep(index) {
  const step = TUTORIAL_STEPS[index];
  if (!step) {
    finishTutorial();
    return;
  }

  const targetEl = document.querySelector(step.selector);
  
  // If a tool is missing from the DOM for some reason, just skip to the next step
  if (!targetEl) {
    advanceTutorial();
    return;
  }

  // Measure target
  const rect = targetEl.getBoundingClientRect();
  
  // Move the spotlight over the target
  // We add slight padding so the spotlight isn't perfectly tight
  const padding = 8;
  spotlightEl.style.left = `${rect.left - padding}px`;
  spotlightEl.style.top = `${rect.top - padding}px`;
  spotlightEl.style.width = `${rect.width + padding * 2}px`;
  spotlightEl.style.height = `${rect.height + padding * 2}px`;

  // Apply correct border radius based on target (dock items are round, dashboard items are pill/rounded)
  const isRound = rect.width === rect.height;
  spotlightEl.style.borderRadius = isRound ? '50%' : '12px';

  // Update text
  titleEl.textContent = step.title;
  subtextEl.textContent = step.desc;

  // Reset classes and set positioning
  stepContainerEl.className = `tutorial-step side-${step.side} active`;
  
  if (step.side === 'left') {
    // Dock items (target is on right, tutorial on left)
    stepContainerEl.style.top = `${rect.top + rect.height / 2}px`;
    stepContainerEl.style.transform = `translateY(-50%) scale(1)`;
    stepContainerEl.style.left = `${rect.left - 420}px`; // text width + arrow + gaps

    // Ensure arrow is on the right side of the text
    stepContainerEl.innerHTML = '';
    stepContainerEl.appendChild(textWrapper);
    stepContainerEl.appendChild(arrowWrapEl);
    
  } else if (step.side === 'top') {
    // Dashboard items (target is on bottom, tutorial on top)
    stepContainerEl.style.left = `${rect.left + rect.width / 2}px`;
    stepContainerEl.style.transform = `translateX(-50%) scale(1)`;
    stepContainerEl.style.top = `${rect.top - 200}px`;

    // Ensure arrow is below the text
    stepContainerEl.innerHTML = '';
    stepContainerEl.appendChild(textWrapper);
    stepContainerEl.appendChild(arrowWrapEl);
  }
}

// Re-declare variables used in innerHTML logic for scope
let textWrapper;
function ensureWrappers() {
  if(!textWrapper) {
    textWrapper = stepContainerEl.querySelector('.tutorial-text-wrapper');
  }
}

function advanceTutorial() {
  currentStepIndex++;
  ensureWrappers();
  renderStep(currentStepIndex);
}

function finishTutorial() {
  
  stepContainerEl.classList.remove('active');
  overlayEl.classList.remove('visible');
  
  setState('onboarding.tutorialCompleted', true);

  setTimeout(() => {
    overlayEl.remove();
    window.dispatchEvent(new CustomEvent('tutorial:finished'));
  }, 500);
}

export function init() {
  const onboarding = getState('onboarding') || {};
  if (onboarding.tutorialCompleted) return;

  setTimeout(() => {
    buildTutorial();
    ensureWrappers();
    
    requestAnimationFrame(() => {
      overlayEl.classList.add('visible');
      renderStep(0);
    });
  }, 1000);
}
