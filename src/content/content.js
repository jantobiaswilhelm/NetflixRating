/**
 * Content script entry point.
 * Wires together the observer, extractor, injector, and message passing.
 */
(function () {
  'use strict';

  let settings = { ...NR.DEFAULTS.settings };

  /**
   * Load settings from the background service worker.
   */
  async function loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response) {
        settings = { ...NR.DEFAULTS.settings, ...response };
      }
    } catch {
      // Extension context may be invalidated; use defaults
    }
  }

  /**
   * Request ratings for a single title from the service worker.
   */
  async function fetchRatings(title, year = null) {
    try {
      return await chrome.runtime.sendMessage({
        type: 'GET_RATINGS',
        title,
        year,
      });
    } catch {
      return null;
    }
  }

  /**
   * Request ratings for multiple titles in a batch.
   */
  async function fetchRatingsBatch(titleEntries) {
    try {
      return await chrome.runtime.sendMessage({
        type: 'GET_RATINGS_BATCH',
        titles: titleEntries,
      });
    } catch {
      return {};
    }
  }

  /**
   * Process visible cards: extract titles, fetch ratings, inject badges.
   */
  async function handleVisibleCards(cards) {
    console.log('[NetflixRating] handleVisibleCards called with', cards.length, 'cards');

    // Extract titles from all cards
    const titleEntries = [];
    const cardMap = new Map(); // title → [cardElements]

    for (const card of cards) {
      if (card.getAttribute(NR.PROCESSED_ATTR)) continue;

      const title = NR.extractor.fromCard(card);
      if (!title) {
        console.log('[NetflixRating] Could not extract title from card:', card.className, card.innerHTML.slice(0, 200));
        continue;
      }

      const year = NR.helpers.extractYear(card);

      if (!cardMap.has(title)) {
        cardMap.set(title, []);
        titleEntries.push({ title, year });
      }
      cardMap.get(title).push(card);
    }

    console.log('[NetflixRating] Extracted titles:', titleEntries.map(e => e.title));
    if (titleEntries.length === 0) return;

    // Batch fetch ratings
    const results = await fetchRatingsBatch(titleEntries);
    console.log('[NetflixRating] Batch results:', results);

    // Inject badges
    for (const [title, cardElements] of cardMap) {
      const ratings = results[title];
      if (!ratings) {
        console.log('[NetflixRating] No ratings for:', title);
        continue;
      }
      console.log('[NetflixRating] Injecting badge for:', title, ratings);

      for (const card of cardElements) {
        NR.injector.injectCardBadge(card, ratings, settings);
      }
    }
  }

  /**
   * Process a modal: extract title, fetch ratings, inject badge.
   */
  async function handleModal(modalEl) {
    const title = NR.extractor.fromMiniModal(modalEl) || NR.extractor.fromDetailModal(modalEl);
    if (!title) return;

    const year = NR.helpers.extractYear(modalEl);
    const ratings = await fetchRatings(title, year);
    if (!ratings) return;

    NR.injector.injectModalBadge(modalEl, ratings, settings);
  }

  /**
   * Handle settings change from popup.
   */
  function handleSettingsChanged(newSettings) {
    settings = { ...NR.DEFAULTS.settings, ...newSettings };
    // Remove all existing badges and re-process
    NR.injector.removeAll();
    NR.observer._scanExistingCards();
  }

  /**
   * Initialize the extension.
   */
  async function init() {
    await loadSettings();

    // Check if API key is configured
    if (!settings.omdbApiKey && !settings.showLetterboxd) {
      console.log('[NetflixRating] No API key configured and Letterboxd disabled. Open extension popup to set up.');
      return;
    }

    // Listen for settings changes
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'SETTINGS_CHANGED') {
        handleSettingsChanged(message.settings);
      }
    });

    // Start observing
    NR.observer.start(handleVisibleCards, handleModal);

    console.log('[NetflixRating] Content script initialized');
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
