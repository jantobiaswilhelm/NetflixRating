/**
 * Popup settings logic.
 * Manages API key, toggles, display style, cache, and usage stats.
 */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  const els = {
    apiKey: $('#apiKey'),
    saveKey: $('#saveKey'),
    keyStatus: $('#keyStatus'),
    showImdb: $('#showImdb'),
    showRottenTomatoes: $('#showRottenTomatoes'),
    showLetterboxd: $('#showLetterboxd'),
    enableGenreSort: $('#enableGenreSort'),
    apiUsage: $('#apiUsage'),
    cacheCount: $('#cacheCount'),
    usageWarning: $('#usageWarning'),
    clearCache: $('#clearCache'),
  };

  /**
   * Send a message to the service worker.
   */
  function sendMessage(msg) {
    return chrome.runtime.sendMessage(msg);
  }

  /**
   * Load current settings and populate the UI.
   */
  async function loadSettings() {
    const settings = await sendMessage({ type: 'GET_SETTINGS' });
    if (!settings) return;

    els.apiKey.value = settings.omdbApiKey || '';
    els.showImdb.checked = settings.showImdb !== false;
    els.showRottenTomatoes.checked = settings.showRottenTomatoes !== false;
    els.showLetterboxd.checked = settings.showLetterboxd !== false;
    els.enableGenreSort.checked = settings.enableGenreSort === true;

    // Genre sort source radio
    const sortRadio = document.querySelector(
      `input[name="genreSortBy"][value="${settings.genreSortBy || 'imdb'}"]`
    );
    if (sortRadio) sortRadio.checked = true;

    // Show/hide genre sort sub-options
    updateGenreSortVisibility();

    // RT score type radio
    const rtRadio = document.querySelector(
      `input[name="rtScoreType"][value="${settings.rtScoreType || 'audience'}"]`
    );
    if (rtRadio) rtRadio.checked = true;

    // Show/hide RT sub-options
    updateRtVisibility();

    // Display style radio
    const styleRadio = document.querySelector(
      `input[name="displayStyle"][value="${settings.displayStyle || 'compact'}"]`
    );
    if (styleRadio) styleRadio.checked = true;
  }

  /**
   * Load usage and cache stats.
   */
  async function loadStats() {
    const [usage, stats] = await Promise.all([
      sendMessage({ type: 'GET_USAGE' }),
      sendMessage({ type: 'GET_CACHE_STATS' }),
    ]);

    els.apiUsage.textContent = usage?.count || 0;
    els.cacheCount.textContent = stats?.active || 0;

    // Show warning if approaching limit
    if (usage?.count >= 900) {
      els.usageWarning.classList.remove('hidden');
    } else {
      els.usageWarning.classList.add('hidden');
    }
  }

  /**
   * Gather current settings from the UI.
   */
  function gatherSettings() {
    const styleRadio = document.querySelector('input[name="displayStyle"]:checked');
    const rtRadio = document.querySelector('input[name="rtScoreType"]:checked');
    const sortRadio = document.querySelector('input[name="genreSortBy"]:checked');
    return {
      omdbApiKey: els.apiKey.value.trim(),
      showImdb: els.showImdb.checked,
      showRottenTomatoes: els.showRottenTomatoes.checked,
      rtScoreType: rtRadio ? rtRadio.value : 'audience',
      showLetterboxd: els.showLetterboxd.checked,
      displayStyle: styleRadio ? styleRadio.value : 'compact',
      enableGenreSort: els.enableGenreSort.checked,
      genreSortBy: sortRadio ? sortRadio.value : 'imdb',
    };
  }

  function updateGenreSortVisibility() {
    const sortOptions = document.getElementById('genreSortOptions');
    if (els.enableGenreSort.checked) {
      sortOptions.classList.remove('hidden');
    } else {
      sortOptions.classList.add('hidden');
    }
  }

  function updateRtVisibility() {
    const rtOptions = document.getElementById('rtScoreOptions');
    if (els.showRottenTomatoes.checked) {
      rtOptions.classList.remove('hidden');
    } else {
      rtOptions.classList.add('hidden');
    }
  }

  /**
   * Save settings to the background.
   */
  async function saveSettings() {
    const settings = gatherSettings();
    await sendMessage({ type: 'SAVE_SETTINGS', settings });
  }

  /**
   * Show a temporary status message.
   */
  function showStatus(text, type = 'success') {
    els.keyStatus.textContent = text;
    els.keyStatus.className = `status ${type}`;
    els.keyStatus.classList.remove('hidden');
    setTimeout(() => els.keyStatus.classList.add('hidden'), 3000);
  }

  // --- Event Listeners ---

  // Save API key
  els.saveKey.addEventListener('click', async () => {
    let key = els.apiKey.value.trim();
    // Extract key if user pasted a full URL
    const urlMatch = key.match(/apikey=([a-zA-Z0-9]+)/);
    if (urlMatch) {
      key = urlMatch[1];
      els.apiKey.value = key;
    }
    if (!key) {
      showStatus('Please enter an API key', 'error');
      return;
    }

    // Validate via the service worker (it has host_permissions for omdbapi.com)
    try {
      const result = await sendMessage({ type: 'VALIDATE_KEY', apiKey: key });

      if (result?.valid === false) {
        showStatus(result.error || 'Invalid API key', 'error');
        return;
      }

      await saveSettings();
      showStatus('API key saved!', 'success');
    } catch {
      // Service worker unavailable — save anyway
      await saveSettings();
      showStatus('Key saved (could not verify)', 'success');
    }
  });

  // Toggle switches — save on change
  [els.showImdb, els.showRottenTomatoes, els.showLetterboxd].forEach(toggle => {
    toggle.addEventListener('change', () => {
      updateRtVisibility();
      saveSettings();
    });
  });

  // Genre sort toggle
  els.enableGenreSort.addEventListener('change', () => {
    updateGenreSortVisibility();
    saveSettings();
  });

  // Genre sort source radios
  document.querySelectorAll('input[name="genreSortBy"]').forEach(radio => {
    radio.addEventListener('change', saveSettings);
  });

  // RT score type radios
  document.querySelectorAll('input[name="rtScoreType"]').forEach(radio => {
    radio.addEventListener('change', saveSettings);
  });

  // Display style radios
  document.querySelectorAll('input[name="displayStyle"]').forEach(radio => {
    radio.addEventListener('change', saveSettings);
  });

  // Clear cache
  els.clearCache.addEventListener('click', async () => {
    const result = await sendMessage({ type: 'CLEAR_CACHE' });
    els.cacheCount.textContent = '0';
    els.clearCache.textContent = `Cleared ${result?.cleared || 0} entries`;
    setTimeout(() => {
      els.clearCache.textContent = 'Clear Cache';
    }, 2000);
  });

  // Initialize
  loadSettings();
  loadStats();
})();
