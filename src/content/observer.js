/**
 * MutationObserver + IntersectionObserver for detecting Netflix DOM changes.
 * Triggers title extraction and rating injection for visible cards.
 */
NR.observer = {
  _mutationObserver: null,
  _intersectionObserver: null,
  _pendingCards: new Set(),
  _processTimer: null,
  _modalTimer: null,
  _lastUrl: location.href,

  /**
   * Start observing the Netflix DOM.
   */
  start(onCardsVisible, onModalOpen) {
    this._onCardsVisible = onCardsVisible;
    this._onModalOpen = onModalOpen;

    this._setupIntersectionObserver();
    this._setupMutationObserver();
    this._setupUrlWatcher();

    // Process any cards already on page
    this._scanExistingCards();
  },

  /**
   * Stop all observers.
   */
  stop() {
    if (this._mutationObserver) this._mutationObserver.disconnect();
    if (this._intersectionObserver) this._intersectionObserver.disconnect();
    clearTimeout(this._processTimer);
    clearTimeout(this._modalTimer);
  },

  /**
   * IntersectionObserver: only process cards visible in viewport.
   */
  _setupIntersectionObserver() {
    this._intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this._pendingCards.add(entry.target);
            this._intersectionObserver.unobserve(entry.target);
          }
        }
        if (this._pendingCards.size > 0) {
          this._scheduleProcess();
        }
      },
      { rootMargin: '200px', threshold: 0.1 }
    );
  },

  /**
   * MutationObserver: detect new cards and modals added to the DOM.
   */
  _setupMutationObserver() {
    this._mutationObserver = new MutationObserver((mutations) => {
      let hasNewCards = false;
      let hasModal = false;

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          // Check for title cards
          const cards = this._findCards(node);
          if (cards.length > 0) {
            hasNewCards = true;
            cards.forEach(card => {
              if (!card.getAttribute(NR.PROCESSED_ATTR)) {
                this._intersectionObserver.observe(card);
              }
            });
          }

          // Check for modals
          if (this._isModal(node) || node.querySelector?.('.previewModal--container')) {
            hasModal = true;
          }
        }
      }

      if (hasModal) {
        this._scheduleModalProcess();
      }
    });

    this._mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  },

  /**
   * Watch for SPA navigation (URL changes without page reload).
   */
  _setupUrlWatcher() {
    const check = () => {
      if (location.href !== this._lastUrl) {
        this._lastUrl = location.href;
        // Small delay for Netflix to render new content
        setTimeout(() => this._scanExistingCards(), 500);
      }
    };

    // Intercept pushState/replaceState
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    history.pushState = function (...args) {
      originalPush.apply(this, args);
      check();
    };
    history.replaceState = function (...args) {
      originalReplace.apply(this, args);
      check();
    };
    window.addEventListener('popstate', check);
  },

  /**
   * Scan all existing cards on the page and observe them.
   */
  _scanExistingCards() {
    const cards = document.querySelectorAll(
      '.slider-item, .title-card, .title-card-container, [class*="title-card"]'
    );
    console.log('[NetflixRating] Scan found', cards.length, 'cards');
    cards.forEach(card => {
      if (!card.getAttribute(NR.PROCESSED_ATTR)) {
        this._intersectionObserver.observe(card);
      }
    });
  },

  /**
   * Debounced card processing.
   */
  _scheduleProcess() {
    clearTimeout(this._processTimer);
    this._processTimer = setTimeout(() => {
      const cards = [...this._pendingCards];
      this._pendingCards.clear();
      if (cards.length > 0 && this._onCardsVisible) {
        this._onCardsVisible(cards);
      }
    }, NR.DEFAULTS.DEBOUNCE_CARDS);
  },

  /**
   * Debounced modal processing.
   */
  _scheduleModalProcess() {
    clearTimeout(this._modalTimer);
    this._modalTimer = setTimeout(() => {
      const modal = document.querySelector('.previewModal--container[data-uia="previewModal"]');
      if (modal && this._onModalOpen) {
        this._onModalOpen(modal);
      }
    }, NR.DEFAULTS.DEBOUNCE_MODALS);
  },

  /**
   * Find card elements within a node.
   */
  _findCards(node) {
    const cards = [];
    if (node.matches?.('.slider-item, .title-card, .title-card-container, [class*="title-card"]')) {
      cards.push(node);
    }
    if (node.querySelectorAll) {
      cards.push(...node.querySelectorAll('.slider-item, .title-card, .title-card-container, [class*="title-card"]'));
    }
    return cards;
  },

  /**
   * Check if a node is a Netflix modal.
   */
  _isModal(node) {
    return node.matches?.('.previewModal--container') ||
      node.classList?.contains('previewModal--container');
  },
};
