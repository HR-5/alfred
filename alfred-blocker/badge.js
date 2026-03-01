// Alfred Blocker — floating access timer badge (content script)

(function () {
  if (window.__alfredBadgeLoaded) return;
  window.__alfredBadgeLoaded = true;

  let badgeEl = null;
  let intervalId = null;
  let currentAllowedUntil = null;

  function removeBadge() {
    clearInterval(intervalId);
    intervalId = null;
    currentAllowedUntil = null;
    if (badgeEl) { badgeEl.remove(); badgeEl = null; }
  }

  function createBadge(allowedUntil) {
    removeBadge();
    currentAllowedUntil = allowedUntil;

    badgeEl = document.createElement('div');
    badgeEl.id = '__alfred-badge__';
    badgeEl.setAttribute('title', 'Alfred — time remaining');

    const logoUrl = chrome.runtime.getURL('icons/icon128.png');
    badgeEl.innerHTML = `
      <img class="__ab-logo__" src="${logoUrl}" alt="Alfred" />
      <span class="__ab-time__">--:--</span>
    `;

    // ── Dragging ────────────────────────────────────────────────────────────────
    let dragState = null;

    badgeEl.addEventListener('mousedown', (e) => {
      const rect = badgeEl.getBoundingClientRect();
      dragState = {
        startX: e.clientX,
        startY: e.clientY,
        origLeft: rect.left,
        origTop: rect.top,
      };
      badgeEl.style.transition = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    function onMouseMove(e) {
      if (!dragState) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      badgeEl.style.left = Math.max(0, Math.min(window.innerWidth - 60, dragState.origLeft + dx)) + 'px';
      badgeEl.style.top = Math.max(0, Math.min(window.innerHeight - 60, dragState.origTop + dy)) + 'px';
      badgeEl.style.right = 'auto';
      badgeEl.style.bottom = 'auto';
    }

    function onMouseUp() {
      dragState = null;
    }

    // Wrap removeBadge to also clean up event listeners
    const origRemoveBadge = removeBadge;
    removeBadge = function () {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      origRemoveBadge();
    };

    document.body.appendChild(badgeEl);

    // ── Countdown ticker ────────────────────────────────────────────────────────
    function tick() {
      const left = allowedUntil - Date.now();
      if (left <= 0) {
        removeBadge();
        return;
      }
      const mins = Math.floor(left / 60000);
      const secs = Math.floor((left % 60000) / 1000);
      const timeEl = badgeEl?.querySelector('.__ab-time__');
      if (timeEl) {
        timeEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
      if (left < 120000) {
        badgeEl?.classList.add('__ab-warn__');
      } else {
        badgeEl?.classList.remove('__ab-warn__');
      }
    }

    tick();
    intervalId = setInterval(tick, 1000);
  }

  async function checkAndUpdate() {
    try {
      const { blockedPatterns = [] } = await chrome.storage.local.get('blockedPatterns');
      const currentUrl = location.href;

      const matched = blockedPatterns.find((p) => currentUrl.includes(p.pattern));
      if (!matched) {
        removeBadge();
        return;
      }

      const key = `allowedUntil_${matched.pattern}`;
      const data = await chrome.storage.local.get(key);
      const allowedUntil = data[key];

      if (!allowedUntil || Date.now() >= allowedUntil) {
        removeBadge();
        return;
      }

      // Don't recreate if already showing for same session
      if (currentAllowedUntil === allowedUntil) return;

      createBadge(allowedUntil);
    } catch {
      // Extension context invalidated — nothing to do
    }
  }

  checkAndUpdate();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') checkAndUpdate();
  });
})();
