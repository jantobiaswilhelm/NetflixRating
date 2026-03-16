/**
 * Watched tracking module.
 * Stores watched state in chrome.storage.local under 'nr_watched'.
 * Provides O(1) lookups via in-memory copy.
 */
NR.watched = {
  _data: {},
  _enabled: true,

  /**
   * Initialize: load watched data from storage.
   */
  async init(settings) {
    this._enabled = settings.enableWatched !== false;
    try {
      const result = await chrome.storage.local.get('nr_watched');
      this._data = result.nr_watched || {};
    } catch {
      this._data = {};
    }
  },

  /**
   * Check if a title is watched by Netflix ID or normalized title.
   */
  isWatched(id) {
    return !!this._data[id];
  },

  /**
   * Toggle watched state for a title. Returns new watched state.
   */
  async toggle(id, title) {
    if (this._data[id]) {
      delete this._data[id];
    } else {
      this._data[id] = {
        title: title || id,
        watchedAt: Date.now(),
        netflixId: id,
      };
    }
    await this._save();
    return this.isWatched(id);
  },

  /**
   * Get total watched count.
   */
  getCount() {
    return Object.keys(this._data).length;
  },

  /**
   * Clear all watched data.
   */
  async clearAll() {
    this._data = {};
    await this._save();
  },

  /**
   * Persist watched data to storage.
   */
  async _save() {
    try {
      await chrome.storage.local.set({ nr_watched: this._data });
    } catch (e) {
      console.warn('[NetflixRating] Watched save error:', e);
    }
  },

  /**
   * Extract Netflix ID from a card element.
   * Looks for /watch/ID or /title/ID in link hrefs.
   */
  extractId(cardEl) {
    const link = cardEl.querySelector('a[href*="/watch/"], a[href*="/title/"]')
      || cardEl.closest('a[href*="/watch/"], a[href*="/title/"]');
    if (link) {
      const match = link.href.match(/\/(?:watch|title)\/(\d+)/);
      if (match) return match[1];
    }
    // Fallback: try slider-refocus links
    const refocus = cardEl.querySelector('a.slider-refocus');
    if (refocus && refocus.href) {
      const match = refocus.href.match(/\/(?:watch|title)\/(\d+)/);
      if (match) return match[1];
    }
    return null;
  },

  /**
   * Extract Netflix ID from a modal element.
   */
  extractIdFromModal(modalEl) {
    // Check for watch/title links in the modal
    const links = modalEl.querySelectorAll('a[href*="/watch/"], a[href*="/title/"]');
    for (const link of links) {
      const match = link.href.match(/\/(?:watch|title)\/(\d+)/);
      if (match) return match[1];
    }
    // Check the play button or other elements with data attributes
    const playLink = modalEl.querySelector('a[data-uia="play-button"]');
    if (playLink && playLink.href) {
      const match = playLink.href.match(/\/(?:watch|title)\/(\d+)/);
      if (match) return match[1];
    }
    return null;
  },

  /**
   * Create the eye icon SVG element.
   */
  createEyeIcon(isWatched) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', isWatched ? '#46d369' : '#fff');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>'
      + '<circle cx="12" cy="12" r="3"/>';
    return svg;
  },

  /**
   * Create the green checkmark indicator.
   */
  createCheckmark() {
    const el = document.createElement('div');
    el.className = 'nr-watched-check';
    el.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#46d369" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    return el;
  },
};
