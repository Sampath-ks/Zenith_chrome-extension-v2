import { getState, setState } from '../../core/state.js';
import { createElement } from '../../core/dom.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const HEART_SVG = `
<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" class="donation-icon">
  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
</svg>
`;

function buildDonationPopup() {
  const overlay = createElement('div', { className: 'donation-overlay' });
  const card = createElement('div', { className: 'donation-card' });
  
  card.innerHTML = `
    ${HEART_SVG}
    <div class="donation-title">Loving Zenith?</div>
    <div class="donation-desc">
      <p style="margin-bottom: 8px; margin-top: 0;">Hey, I’m Sam 👋</p>
      <p style="margin-bottom: 12px; margin-top: 0;">If you’re enjoying Zenith and it’s helping you out, consider supporting its development. I’m a college student, so every little bit helps with my college fees 😭🙏</p>
      <p style="margin-bottom: 0; margin-top: 0;">Of course, you’re always welcome to keep using Zenith completely free. 😊</p>
    </div>
  `;

  const primaryBtn = createElement('button', {
    className: 'donation-btn-primary',
    textContent: 'Support the Project'
  });
  primaryBtn.onclick = () => {
    // Open a link to Ko-fi, Patreon, etc. (Placeholder for now)
    window.open('https://ko-fi.com/example', '_blank');
    closePopup(overlay);
  };

  const secondaryBtn = createElement('button', {
    className: 'donation-btn-secondary',
    textContent: 'Maybe Later'
  });
  secondaryBtn.onclick = () => closePopup(overlay);

  card.appendChild(primaryBtn);
  card.appendChild(secondaryBtn);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
  });
}

function closePopup(overlay) {
  overlay.classList.remove('visible');
  setState('monetization.lastDonationPrompt', Date.now());
  setTimeout(() => overlay.remove(), 400);
}

function checkAndShow() {
  const monetization = getState('monetization') || {};
  const lastPrompt = monetization.lastDonationPrompt;
  
  const now = Date.now();
  
  // If never prompted, or if 30 days have passed
  if (!lastPrompt || (now - lastPrompt) > THIRTY_DAYS_MS) {
    buildDonationPopup();
  }
}

export function init() {
  const onboarding = getState('onboarding') || {};
  
  if (!onboarding.tutorialCompleted) {
    // Wait for the tutorial to finish if it's the user's first time
    window.addEventListener('tutorial:finished', () => {
      // Small delay after tutorial finishes before popping donation
      setTimeout(checkAndShow, 1000);
    });
  } else {
    // Already onboarded, check normally
    // Small delay to let the rest of the app load
    setTimeout(checkAndShow, 2000);
  }
}
