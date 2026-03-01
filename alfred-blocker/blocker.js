// Alfred Blocker — blocker page controller

const ALFRED_API = 'http://localhost:8000/api/v1';

// ── Read query params ─────────────────────────────────────────────────────────

const params = new URLSearchParams(location.search);
const originalUrl = params.get('from') || 'https://www.youtube.com';
const siteName = params.get('site') || 'this site';
const sitePattern = params.get('pattern') || '';
const cooldownMs = parseInt(params.get('cooldown') || '0', 10);

// ── After-hours check (22:00–23:59) ──────────────────────────────────────────

function isAfterHours() {
  const h = new Date().getHours();
  return h >= 22; // 10pm to midnight
}

// ── Cooldown mode ─────────────────────────────────────────────────────────────

function showCooldown(remainingMs) {
  document.getElementById('main-layout').classList.add('hidden');
  document.getElementById('cooldown-screen').classList.remove('hidden');

  const timerEl = document.getElementById('cooldown-timer');

  function tick() {
    const now = Date.now();
    const left = remainingMs - (Date.now() - startTime);
    if (left <= 0) {
      // Cooldown ended — reload to show normal blocker
      location.reload();
      return;
    }
    const mins = Math.floor(left / 60000);
    const secs = Math.floor((left % 60000) / 1000);
    timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  const startTime = Date.now();
  tick();
  setInterval(tick, 1000);
}

// ── Session ID ────────────────────────────────────────────────────────────────

function getSessionId() {
  const key = `gk-session-${sitePattern}`;
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = 'gk-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

// ── Calendar: fetch and render today's schedule ───────────────────────────────

async function loadSchedule() {
  const container = document.getElementById('schedule-list');
  try {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const weekStart = monday.toISOString().split('T')[0];

    const resp = await fetch(`${ALFRED_API}/calendar/blocks?week_start=${weekStart}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    const todayStr = now.toISOString().split('T')[0];
    const todayBlocks = (data.blocks || []).filter((b) => b.scheduled_date === todayStr);

    if (todayBlocks.length === 0) {
      container.innerHTML = '<p class="muted-text">Nothing scheduled for today.</p>';
      return;
    }

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    container.innerHTML = todayBlocks.map((block) => {
      const title = block.task_title || block.title || 'Untitled';
      const start = (block.start_time || '??:??').slice(0, 5);
      const end = (block.end_time || '??:??').slice(0, 5);
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      const isActive = nowMinutes >= sh * 60 + sm && nowMinutes < eh * 60 + em;
      return `
        <div class="schedule-block${isActive ? ' active' : ''}">
          <div class="schedule-time">${start} – ${end}</div>
          <div class="schedule-title">${title}</div>
        </div>`;
    }).join('');
  } catch {
    container.innerHTML = '<p class="muted-text">Could not load schedule.<br>Is Alfred running?</p>';
  }
}

// ── YouTube URL → embed URL ───────────────────────────────────────────────────

function getYouTubeEmbedUrl(url) {
  try {
    const u = new URL(url);
    let videoId = null;

    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') {
        videoId = u.searchParams.get('v');
      } else if (u.pathname.startsWith('/shorts/')) {
        videoId = u.pathname.split('/shorts/')[1].split('/')[0];
      } else if (u.pathname.startsWith('/embed/')) {
        videoId = u.pathname.split('/embed/')[1].split('/')[0];
      }
    } else if (u.hostname === 'youtu.be') {
      videoId = u.pathname.slice(1).split('/')[0];
    }

    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&fs=1`;
    }
  } catch {
    // invalid URL
  }
  return null;
}

// ── Specific link handler ─────────────────────────────────────────────────────

function handleLinkLoad() {
  const input = document.getElementById('link-input');
  const embedContainer = document.getElementById('embed-container');
  const embedFrame = document.getElementById('embed-frame');
  const embedFallback = document.getElementById('embed-fallback');
  const embedLink = document.getElementById('embed-link');
  const raw = input.value.trim();
  if (!raw) return;

  // Ensure URL has a protocol
  const urlStr = raw.startsWith('http') ? raw : `https://${raw}`;

  embedContainer.classList.add('hidden');
  embedFallback.classList.add('hidden');

  const youtubeEmbed = getYouTubeEmbedUrl(urlStr);
  if (youtubeEmbed) {
    embedFrame.src = youtubeEmbed;
    embedContainer.classList.remove('hidden');
    return;
  }

  // Non-YouTube: try generic embed, but most sites block this — show fallback
  embedLink.href = urlStr;
  embedLink.textContent = urlStr.length > 50 ? urlStr.slice(0, 50) + '…' : urlStr;
  embedFallback.classList.remove('hidden');
}

// ── Chat rendering ────────────────────────────────────────────────────────────

function appendMessage(role, text, badgeType = null) {
  const messages = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = `msg ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;

  if (badgeType) {
    const badge = document.createElement('div');
    badge.className = `decision-badge ${badgeType === 'granted' ? 'granted' : 'denied'}`;
    const labels = {
      'micro': '✓ Micro-break granted (5 min, then 1hr lockout)',
      'granted': '✓ Access granted',
      'denied': '✗ Access denied',
    };
    badge.textContent = labels[badgeType] || labels['denied'];
    bubble.appendChild(badge);
  }

  div.appendChild(bubble);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function showLoadingDots() {
  const messages = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg alfred';
  div.id = 'loading-msg';
  div.innerHTML = `
    <div class="msg-bubble" style="padding: 10px 14px;">
      <div class="loading-dots"><span></span><span></span><span></span></div>
    </div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function removeLoadingDots() {
  document.getElementById('loading-msg')?.remove();
}

// ── Decision parsing ──────────────────────────────────────────────────────────

function parseDecision(reply) {
  if (reply.includes('DECISION: MICRO_BREAK')) return 'MICRO_BREAK';
  if (reply.includes('DECISION: SHORT_BREAK')) return 'SHORT_BREAK';
  if (reply.includes('DECISION: LONG_BREAK')) return 'LONG_BREAK';
  if (reply.includes('DECISION: DENIED')) return 'DENIED';
  return null;
}

// ── SSE streaming ─────────────────────────────────────────────────────────────

async function sendToAlfred(userMessage) {
  const resp = await fetch(`${ALFRED_API}/gatekeeper/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: userMessage,
      session_id: getSessionId(),
      site_name: siteName,
    }),
  });

  if (!resp.ok || !resp.body) throw new Error(`Request failed: ${resp.status}`);

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ') && currentEvent) {
        try {
          const data = JSON.parse(line.slice(6));
          if (currentEvent === 'done') return data.reply;
          if (currentEvent === 'error') throw new Error(data.message || 'Alfred error');
        } catch (e) {
          if (e instanceof Error && e.message !== 'Alfred error') throw e;
        }
        currentEvent = '';
      }
    }
  }
  return null;
}

// ── Grant access ──────────────────────────────────────────────────────────────

function grantAccess(minutes, cooldownMinutes = 0) {
  chrome.runtime.sendMessage({
    type: 'ALLOW_SITE',
    minutes,
    originalUrl,
    pattern: sitePattern,
    siteName,
    cooldownMinutes,
  });
}

// ── Send handler ──────────────────────────────────────────────────────────────

let busy = false;

async function handleSend() {
  if (busy) return;
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  appendMessage('user', text);

  busy = true;
  sendBtn.disabled = true;
  input.disabled = true;
  showLoadingDots();

  try {
    const reply = await sendToAlfred(text);
    removeLoadingDots();

    if (!reply) {
      appendMessage('alfred', 'I seem to have lost my train of thought, sir. Please try again.');
      return;
    }

    const decision = parseDecision(reply);
    let badgeType = null;
    if (decision === 'MICRO_BREAK') badgeType = 'micro';
    else if (decision === 'SHORT_BREAK' || decision === 'LONG_BREAK') badgeType = 'granted';
    else if (decision === 'DENIED') badgeType = 'denied';

    appendMessage('alfred', reply, badgeType);

    if (decision === 'MICRO_BREAK') {
      setTimeout(() => grantAccess(5, 60), 1200); // 5 min access, 60 min cooldown after
    } else if (decision === 'SHORT_BREAK') {
      setTimeout(() => grantAccess(10, 0), 1200);
    } else if (decision === 'LONG_BREAK') {
      setTimeout(() => grantAccess(40, 0), 1200);
    }
  } catch {
    removeLoadingDots();
    appendMessage(
      'alfred',
      "I'm unable to reach Alfred's server, sir. Please ensure Alfred is running at localhost:8000."
    );
  } finally {
    busy = false;
    sendBtn.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Update header with site name
  const label = document.getElementById('site-label');
  if (label) label.textContent = `${siteName} Blocked`;

  // If in cooldown — show lockout screen instead
  if (cooldownMs > 0) {
    showCooldown(cooldownMs);
    return;
  }

  // Normal mode
  loadSchedule();

  appendMessage(
    'alfred',
    `Attempting ${siteName} again, sir? State your case — and make it compelling.`
  );

  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');

  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  });
  input.focus();

  // Specific link: load on button click or Enter
  const linkInput = document.getElementById('link-input');
  const linkBtn = document.getElementById('link-btn');
  linkBtn.addEventListener('click', handleLinkLoad);
  linkInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleLinkLoad(); }
  });

  // Close embed
  document.getElementById('close-embed-btn').addEventListener('click', () => {
    const frame = document.getElementById('embed-frame');
    frame.src = 'about:blank'; // properly stop video
    document.getElementById('embed-container').classList.add('hidden');
    document.getElementById('link-input').value = '';
  });

  // After-hours bypass
  if (isAfterHours()) {
    document.getElementById('afterhours-bypass').classList.remove('hidden');
    document.getElementById('afterhours-btn').addEventListener('click', () => {
      grantAccess(30, 0); // 30 min, no cooldown
    });
  }
});
