// Alfred Blocker — hide YouTube Shorts from the page (content script)
// Runs only on youtube.com. Hides Shorts shelf, Shorts cards, and Shorts tab.

(function () {
  if (window.__alfredShortsHiderLoaded) return;
  window.__alfredShortsHiderLoaded = true;

  // CSS rules to hide known Shorts containers
  const style = document.createElement('style');
  style.textContent = `
    /* Shorts shelf on homepage */
    ytd-rich-shelf-renderer[is-shorts],
    ytd-reel-shelf-renderer {
      display: none !important;
    }

    /* Shorts tab in channel pages */
    tp-yt-paper-tab:has(> div[tab-title="Shorts"]),
    yt-tab-shape[tab-title="Shorts"] {
      display: none !important;
    }

    /* Shorts mini-player / sidebar suggestions */
    ytd-mini-guide-entry-renderer:has(a[title="Shorts"]),
    ytd-guide-entry-renderer:has(a[title="Shorts"]) {
      display: none !important;
    }
  `;
  document.head.appendChild(style);

  // Hide individual video cards that link to /shorts/
  function hideShortCards() {
    // Homepage rich grid items
    document.querySelectorAll('ytd-rich-item-renderer:not([data-alfred-hidden])').forEach((el) => {
      const link = el.querySelector('a#thumbnail[href*="/shorts/"]');
      if (link) {
        el.style.display = 'none';
        el.setAttribute('data-alfred-hidden', '1');
      }
    });

    // Search results and sidebar recommendations
    document.querySelectorAll('ytd-video-renderer:not([data-alfred-hidden]), ytd-compact-video-renderer:not([data-alfred-hidden])').forEach((el) => {
      const link = el.querySelector('a[href*="/shorts/"]');
      if (link) {
        el.style.display = 'none';
        el.setAttribute('data-alfred-hidden', '1');
      }
    });

    // Grid items (channel pages, etc.)
    document.querySelectorAll('ytd-grid-video-renderer:not([data-alfred-hidden])').forEach((el) => {
      const link = el.querySelector('a[href*="/shorts/"]');
      if (link) {
        el.style.display = 'none';
        el.setAttribute('data-alfred-hidden', '1');
      }
    });
  }

  // Run immediately and observe for dynamic content
  hideShortCards();

  const observer = new MutationObserver(() => {
    hideShortCards();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
