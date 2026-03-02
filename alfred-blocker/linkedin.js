(function () {
  if (window.__alfredLinkedInLoaded) return;
  window.__alfredLinkedInLoaded = true;

  let currentUrl = '';
  let fabEl = null;
  let popupEl = null;
  let isOpen = false;

  // ── Detect LinkedIn profile pages ──────────────────────────────────

  function isProfilePage() {
    return /linkedin\.com\/in\/[^/]+/i.test(location.href);
  }

  function extractProfileUrl() {
    // Clean URL to just the profile path (no query params)
    const match = location.href.match(/(https?:\/\/[^?#]*linkedin\.com\/in\/[^/?#]+)/);
    return match ? match[1] : location.href;
  }

  function extractName() {
    // LinkedIn profile name selectors (may need updating if LinkedIn changes)
    const selectors = [
      'h1.text-heading-xlarge',
      'h1.inline.t-24',
      '.pv-top-card--list h1',
      'h1[class*="text-heading"]',
      '.ph5 h1',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) {
        return el.textContent.trim();
      }
    }
    // Fallback: try the first h1 in the main content area
    const h1 = document.querySelector('main h1');
    return h1 ? h1.textContent.trim() : '';
  }

  // ── Floating Action Button ─────────────────────────────────────────

  function createFab() {
    if (fabEl) return;

    fabEl = document.createElement('div');
    fabEl.id = '__alfred-li-fab__';

    const logoUrl = chrome.runtime.getURL('icons/icon128.png');
    fabEl.innerHTML = `<img src="${logoUrl}" class="__ali-logo__" alt="Alfred" />`;

    fabEl.addEventListener('click', togglePopup);
    document.body.appendChild(fabEl);
  }

  function removeFab() {
    if (fabEl) {
      fabEl.remove();
      fabEl = null;
    }
    closePopup();
  }

  // ── Popup Form ─────────────────────────────────────────────────────

  function togglePopup() {
    if (isOpen) {
      closePopup();
    } else {
      openPopup();
    }
  }

  function openPopup() {
    if (popupEl) return;
    isOpen = true;

    const name = extractName();
    const profileUrl = extractProfileUrl();

    popupEl = document.createElement('div');
    popupEl.id = '__alfred-li-popup__';
    popupEl.innerHTML = `
      <div class="__ali-header__">
        <span class="__ali-title__">Track Connection</span>
        <button class="__ali-close__">&times;</button>
      </div>
      <div class="__ali-form__">
        <label class="__ali-label__">Name</label>
        <input type="text" class="__ali-input__" id="__ali-name__" value="${escapeHtml(name)}" />

        <label class="__ali-label__">Profile URL</label>
        <input type="text" class="__ali-input__ __ali-readonly__" id="__ali-url__" value="${escapeHtml(profileUrl)}" readonly />

        <label class="__ali-label__">Why are you connecting?</label>
        <textarea class="__ali-textarea__" id="__ali-reason__" placeholder="e.g., Freelance project lead, hiring manager at X, mutual interest in Y..." rows="3"></textarea>

        <button class="__ali-submit__" id="__ali-save__">Save Connection</button>
        <div class="__ali-status__" id="__ali-status__"></div>
      </div>
    `;

    document.body.appendChild(popupEl);

    // Animate in
    requestAnimationFrame(() => popupEl.classList.add('__ali-visible__'));

    // Event listeners
    popupEl.querySelector('.___ali-close__, .___ali-close__') ||
      popupEl.querySelector('.__ali-close__').addEventListener('click', closePopup);
    popupEl.querySelector('#__ali-save__').addEventListener('click', handleSave);

    // Focus the reason field
    setTimeout(() => {
      const reasonEl = popupEl.querySelector('#__ali-reason__');
      if (reasonEl) reasonEl.focus();
    }, 200);
  }

  function closePopup() {
    if (popupEl) {
      popupEl.classList.remove('__ali-visible__');
      setTimeout(() => {
        if (popupEl) {
          popupEl.remove();
          popupEl = null;
        }
      }, 200);
    }
    isOpen = false;
  }

  async function handleSave() {
    const name = document.getElementById('__ali-name__')?.value.trim();
    const profileUrl = document.getElementById('__ali-url__')?.value.trim();
    const reason = document.getElementById('__ali-reason__')?.value.trim();
    const statusEl = document.getElementById('__ali-status__');
    const saveBtn = document.getElementById('__ali-save__');

    if (!name || !reason) {
      statusEl.textContent = 'Please fill in name and reason.';
      statusEl.style.color = '#e57373';
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    chrome.runtime.sendMessage(
      { type: 'SAVE_LINKEDIN_CONNECTION', name, profile_url: profileUrl, reason },
      (response) => {
        if (response && response.ok) {
          statusEl.textContent = 'Saved! Alfred will notify you when they accept.';
          statusEl.style.color = '#81c784';

          // Show success state on the FAB
          if (fabEl) {
            fabEl.classList.add('__ali-saved__');
            setTimeout(() => fabEl.classList.remove('__ali-saved__'), 3000);
          }

          // Close popup after brief delay
          setTimeout(closePopup, 1500);
        } else {
          const errMsg = response?.error || 'Failed to save. Is Alfred running?';
          statusEl.textContent = errMsg;
          statusEl.style.color = '#e57373';
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Connection';
        }
      }
    );
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── URL Change Detection (LinkedIn is a SPA) ──────────────────────

  function checkPage() {
    const url = location.href;
    if (url === currentUrl) return;
    currentUrl = url;

    if (isProfilePage()) {
      createFab();
    } else {
      removeFab();
    }
  }

  // Initial check
  checkPage();

  // Poll for SPA navigation changes
  setInterval(checkPage, 1000);

  // Also listen for popstate
  window.addEventListener('popstate', checkPage);
})();
