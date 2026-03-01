// Alfred Blocker — background service worker (MV3)

// Disable navigation preload (we don't use fetch events or preloadResponse)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration.navigationPreload
      ? self.registration.navigationPreload.disable()
      : Promise.resolve()
  );
});

const ALFRED_API = 'http://localhost:8000/api/v1';
const BLOCKER_PAGE = chrome.runtime.getURL('blocker.html');
const ALARM_PREFIX = 'alfred-blocker-';
const COOLDOWN_PREFIX = 'cooldownUntil_';
const ALLOWED_PREFIX = 'allowedUntil_';
const MICRO_BREAK_COOLDOWN_MINUTES = 60;

// ── Blocked list management ────────────────────────────────────────────────────

async function fetchAndCacheBlockedList() {
  try {
    const resp = await fetch(`${ALFRED_API}/blocked-sites`);
    if (!resp.ok) return;
    const sites = await resp.json();
    await chrome.storage.local.set({ blockedPatterns: sites });
  } catch {
    // Alfred might not be running; keep existing cached list
  }
}

async function getBlockedPatterns() {
  const { blockedPatterns = [] } = await chrome.storage.local.get('blockedPatterns');
  return blockedPatterns;
}

// ── Per-site access state ──────────────────────────────────────────────────────

async function isAllowedFor(pattern) {
  const key = `${ALLOWED_PREFIX}${pattern}`;
  const result = await chrome.storage.local.get(key);
  const until = result[key] ?? null;
  if (!until) return false;
  if (Date.now() > until) {
    await chrome.storage.local.remove(key);
    return false;
  }
  return true;
}

async function setAllowedFor(pattern, untilMs) {
  await chrome.storage.local.set({ [`${ALLOWED_PREFIX}${pattern}`]: untilMs });
}

async function revokeFor(pattern) {
  await chrome.storage.local.remove(`${ALLOWED_PREFIX}${pattern}`);
}

// ── Per-site cooldown state (post-break lockout) ───────────────────────────────

async function isInCooldown(pattern) {
  const key = `${COOLDOWN_PREFIX}${pattern}`;
  const result = await chrome.storage.local.get(key);
  const until = result[key] ?? null;
  if (!until) return { active: false, remainingMs: 0 };
  const remaining = until - Date.now();
  if (remaining <= 0) {
    await chrome.storage.local.remove(key);
    return { active: false, remainingMs: 0 };
  }
  return { active: true, remainingMs: remaining };
}

async function setCooldownFor(pattern, durationMinutes) {
  if (!durationMinutes) return;
  const key = `${COOLDOWN_PREFIX}${pattern}`;
  await chrome.storage.local.set({ [key]: Date.now() + durationMinutes * 60 * 1000 });
}

// ── Navigation intercept ───────────────────────────────────────────────────────

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const url = details.url;
  if (url.startsWith(BLOCKER_PAGE)) return;

  const patterns = await getBlockedPatterns();
  const matched = patterns.find((p) => url.includes(p.pattern));
  if (!matched) return;

  const allowed = await isAllowedFor(matched.pattern);
  if (allowed) return;

  const cooldown = await isInCooldown(matched.pattern);
  const params = new URLSearchParams({
    from: url,
    site: matched.name,
    pattern: matched.pattern,
  });
  if (cooldown.active) {
    params.set('cooldown', String(cooldown.remainingMs));
  }

  chrome.tabs.update(details.tabId, { url: `${BLOCKER_PAGE}?${params.toString()}` });
});

// ── Alarm: break timer expired ─────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'alfred-refresh-list') {
    fetchAndCacheBlockedList();
    return;
  }
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;

  const pattern = alarm.name.slice(ALARM_PREFIX.length);
  await revokeFor(pattern);

  // Apply cooldown if this break had one stored
  const cooldownKey = `pendingCooldown_${pattern}`;
  const stored = await chrome.storage.local.get(cooldownKey);
  const cooldownMinutes = stored[cooldownKey] ?? 0;
  if (cooldownMinutes > 0) {
    await setCooldownFor(pattern, cooldownMinutes);
    await chrome.storage.local.remove(cooldownKey);
  }

  chrome.notifications.create(`expired-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Alfred Blocker',
    message: cooldownMinutes > 0
      ? `Break over, sir. ${cooldownMinutes}-minute lockout now in effect.`
      : 'Your break is over, sir. Back to work.',
    priority: 2,
  });

  // Redirect any open tabs for this pattern back to the blocker
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.url && tab.url.includes(pattern) && tab.id) {
      const cooldown = await isInCooldown(pattern);
      const params = new URLSearchParams({ from: tab.url, site: pattern, pattern });
      if (cooldown.active) params.set('cooldown', String(cooldown.remainingMs));
      chrome.tabs.update(tab.id, { url: `${BLOCKER_PAGE}?${params.toString()}` });
    }
  }
});

// ── Message handler ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ALLOW_SITE') {
    const { minutes, originalUrl, pattern, cooldownMinutes = 0 } = message;
    const untilMs = Date.now() + minutes * 60 * 1000;

    (async () => {
      await setAllowedFor(pattern, untilMs);
      await chrome.alarms.clear(`${ALARM_PREFIX}${pattern}`);
      chrome.alarms.create(`${ALARM_PREFIX}${pattern}`, { delayInMinutes: minutes });

      // Store the cooldown to apply after this alarm fires
      if (cooldownMinutes > 0) {
        await chrome.storage.local.set({ [`pendingCooldown_${pattern}`]: cooldownMinutes });
      }

      const tabId = sender.tab?.id;
      if (tabId && originalUrl) {
        chrome.tabs.update(tabId, { url: originalUrl });
      }
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === 'GET_STATUS') {
    (async () => {
      const patterns = await getBlockedPatterns();
      const statuses = await Promise.all(
        patterns.map(async (p) => {
          const allowedKey = `${ALLOWED_PREFIX}${p.pattern}`;
          const cooldownKey = `${COOLDOWN_PREFIX}${p.pattern}`;
          const stored = await chrome.storage.local.get([allowedKey, cooldownKey]);
          const allowedUntil = stored[allowedKey] ?? null;
          const cooldownUntil = stored[cooldownKey] ?? null;
          return {
            ...p,
            allowed: allowedUntil && Date.now() < allowedUntil,
            allowedUntil,
            inCooldown: cooldownUntil && Date.now() < cooldownUntil,
            cooldownUntil,
          };
        })
      );
      sendResponse({ statuses });
    })();
    return true;
  }

  if (message.type === 'REFRESH_LIST') {
    fetchAndCacheBlockedList().then(() => sendResponse({ ok: true }));
    return true;
  }
});

// ── Init ───────────────────────────────────────────────────────────────────────

fetchAndCacheBlockedList();
chrome.alarms.create('alfred-refresh-list', { periodInMinutes: 1 });
