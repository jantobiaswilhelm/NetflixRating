/**
 * Genre page sorting by rating.
 * Detects genre pages, injects a sort bar, and reorders cards using CSS order.
 */
NR.sorter = {
  _settings: null,
  _sortSource: 'imdb',
  _ascending: false,
  _barEl: null,

  /**
   * Check if the current page is a Netflix genre page.
   */
  isGenrePage() {
    return /\/browse\/genre\/\d+/.test(location.pathname);
  },

  /**
   * Initialize the sorter if on a genre page and feature is enabled.
   */
  init(settings) {
    this._settings = settings;

    // Remove existing sort bar on navigation
    this._removeBar();

    if (!settings.enableGenreSort || !this.isGenrePage()) return;

    this._sortSource = settings.genreSortBy || 'imdb';
    this._ascending = false;
    this._injectBar();
  },

  /**
   * Inject the sort control bar above the title grid.
   */
  _injectBar() {
    if (this._barEl) return;

    const bar = document.createElement('div');
    bar.className = 'nr-sort-bar';

    const label = document.createElement('span');
    label.className = 'nr-sort-label';
    label.textContent = 'Sorted by ' + this._sourceLabel(this._sortSource);

    const controls = document.createElement('div');
    controls.className = 'nr-sort-controls';

    // Source dropdown
    const select = document.createElement('select');
    select.className = 'nr-sort-select';
    const sources = [
      { value: 'imdb', label: 'IMDb' },
      { value: 'rt', label: 'Rotten Tomatoes' },
      { value: 'letterboxd', label: 'Letterboxd' },
    ];
    for (const src of sources) {
      const opt = document.createElement('option');
      opt.value = src.value;
      opt.textContent = src.label;
      if (src.value === this._sortSource) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      this._sortSource = select.value;
      label.textContent = 'Sorted by ' + this._sourceLabel(this._sortSource);
      this.sortCards();
    });

    // Ascending/descending toggle button
    const dirBtn = document.createElement('button');
    dirBtn.className = 'nr-sort-dir';
    dirBtn.textContent = this._ascending ? '\u2191' : '\u2193';
    dirBtn.title = this._ascending ? 'Lowest first' : 'Highest first';
    dirBtn.addEventListener('click', () => {
      this._ascending = !this._ascending;
      dirBtn.textContent = this._ascending ? '\u2191' : '\u2193';
      dirBtn.title = this._ascending ? 'Lowest first' : 'Highest first';
      this.sortCards();
    });

    controls.appendChild(select);
    controls.appendChild(dirBtn);
    bar.appendChild(label);
    bar.appendChild(controls);

    // Find the main content area to insert before
    const gallery = document.querySelector(
      '.ltr-1apqrcg, [data-uia="gallery-container"], .rowContainer, .mainView'
    );
    if (gallery) {
      gallery.parentNode.insertBefore(bar, gallery);
    } else {
      // Fallback: insert at top of main content
      const main = document.querySelector('[role="main"], .mainView') || document.body;
      main.insertBefore(bar, main.firstChild);
    }

    this._barEl = bar;
  },

  /**
   * Remove the sort bar and reset card order.
   */
  _removeBar() {
    if (this._barEl) {
      this._barEl.remove();
      this._barEl = null;
    }
    this._resetOrder();
  },

  /**
   * Reset CSS order on all cards.
   */
  _resetOrder() {
    document.querySelectorAll(
      '.slider-item, .title-card-container, [class*="title-card"]'
    ).forEach(card => {
      card.style.order = '';
    });
  },

  /**
   * Get display label for a sort source.
   */
  _sourceLabel(source) {
    const labels = { imdb: 'IMDb rating', rt: 'Rotten Tomatoes', letterboxd: 'Letterboxd rating' };
    return labels[source] || source;
  },

  /**
   * Read the numeric rating value from a card's data attributes.
   */
  _getRating(card) {
    let raw;
    switch (this._sortSource) {
      case 'imdb':
        raw = card.getAttribute('data-nr-imdb');
        break;
      case 'rt':
        raw = card.getAttribute('data-nr-rt') || card.getAttribute('data-nr-rt-audience');
        break;
      case 'letterboxd':
        raw = card.getAttribute('data-nr-lb');
        break;
    }
    if (!raw) return null;
    const num = parseFloat(raw);
    return isNaN(num) ? null : num;
  },

  /**
   * Sort all processed cards by the selected rating using CSS order.
   */
  sortCards() {
    if (!this._settings?.enableGenreSort || !this.isGenrePage()) return;

    const cards = document.querySelectorAll(
      '.slider-item[data-nr-processed], .title-card-container[data-nr-processed], [class*="title-card"][data-nr-processed]'
    );

    // Collect cards with ratings
    const rated = [];
    const unrated = [];
    cards.forEach(card => {
      const val = this._getRating(card);
      if (val !== null) {
        rated.push({ card, val });
      } else {
        unrated.push(card);
      }
    });

    // Sort by rating
    rated.sort((a, b) => this._ascending ? a.val - b.val : b.val - a.val);

    // Apply CSS order
    rated.forEach((item, i) => {
      item.card.style.order = String(i);
    });
    unrated.forEach(card => {
      card.style.order = '9999';
    });

    // Ensure parent containers use flex for order to take effect
    this._ensureFlexParents(cards);
  },

  /**
   * Ensure parent containers have flex display so CSS order works.
   */
  _ensureFlexParents(cards) {
    const parents = new Set();
    cards.forEach(card => {
      if (card.parentElement) parents.add(card.parentElement);
    });
    parents.forEach(parent => {
      const style = getComputedStyle(parent);
      if (style.display !== 'flex' && style.display !== 'inline-flex' &&
          style.display !== 'grid' && style.display !== 'inline-grid') {
        parent.style.display = 'flex';
        parent.style.flexWrap = 'wrap';
      }
    });
  },

  /**
   * Called after handleVisibleCards injects badges.
   * Triggers sorting if on a genre page with sorting enabled.
   */
  onRatingsReady() {
    if (!this._settings?.enableGenreSort || !this.isGenrePage()) return;
    this.sortCards();
  },

  /**
   * Handle settings change — re-init or remove sort bar.
   */
  onSettingsChanged(settings) {
    this._settings = settings;
    if (!settings.enableGenreSort || !this.isGenrePage()) {
      this._removeBar();
      return;
    }
    this._sortSource = settings.genreSortBy || 'imdb';
    if (!this._barEl) {
      this._injectBar();
    }
    this.sortCards();
  },
};
