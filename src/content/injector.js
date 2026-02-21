/**
 * Rating badge DOM injection into Netflix UI.
 * Creates and updates badge elements on cards and modals.
 */
NR.injector = {

  /**
   * Create a compact card badge overlay.
   * Appears in bottom-left of the poster.
   */
  createCardBadge(ratings, settings) {
    const badge = document.createElement('div');
    badge.className = NR.BADGE_CLASS;

    const items = this._buildRatingItems(ratings, settings);
    if (items.length === 0) return null;

    items.forEach(item => badge.appendChild(item));
    return badge;
  },

  /**
   * Create a modal rating display.
   * Larger pills below the title in the detail view.
   */
  createModalBadge(ratings, settings) {
    const container = document.createElement('div');
    container.className = NR.MODAL_BADGE_CLASS;

    const items = this._buildRatingItems(ratings, settings, true);
    if (items.length === 0) return null;

    items.forEach(item => container.appendChild(item));
    return container;
  },

  /**
   * Build individual rating items (icon + value).
   */
  _assetUrl(path) {
    return chrome.runtime.getURL('assets/' + path);
  },

  _buildRatingItems(ratings, settings, isModal = false) {
    const items = [];
    const detailed = settings.displayStyle === 'detailed';

    // IMDb
    if (settings.showImdb && ratings.imdb) {
      const item = document.createElement('span');
      item.className = 'nr-rating-item nr-imdb';
      const logo = `<img class="nr-logo" src="${this._assetUrl('imdb.svg')}" alt="IMDb">`;
      if (detailed) {
        item.innerHTML = logo
          + `<span class="nr-value">${ratings.imdb}</span>`
          + `<span class="nr-scale">/10</span>`;
      } else {
        item.innerHTML = logo + `<span class="nr-value">${ratings.imdb}</span>`;
      }
      if (isModal && ratings.imdbId) {
        item.style.cursor = 'pointer';
        item.title = 'View on IMDb';
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          window.open(`https://www.imdb.com/title/${ratings.imdbId}/`, '_blank');
        });
      }
      items.push(item);
    }

    // Rotten Tomatoes
    if (settings.showRottenTomatoes) {
      const scoreType = settings.rtScoreType || 'audience';
      const showCritics = scoreType === 'critics' || scoreType === 'both';
      const showAudience = scoreType === 'audience' || scoreType === 'both';

      // Critics score
      const criticsVal = ratings.rtCritics || ratings.rt;
      if (showCritics && criticsVal) {
        const status = this._rtStatus(criticsVal);
        const item = document.createElement('span');
        item.className = `nr-rating-item nr-rt nr-rt-${status}`;
        const logoFile = status === 'fresh' ? 'rt-fresh.svg' : 'rt-rotten.svg';
        const logo = `<img class="nr-logo nr-logo-rt" src="${this._assetUrl(logoFile)}" alt="RT">`;
        if (detailed) {
          item.innerHTML = logo
            + `<span class="nr-value">${criticsVal}</span>`
            + `<span class="nr-label">Critics</span>`;
        } else {
          item.innerHTML = logo + `<span class="nr-value">${criticsVal}</span>`;
        }
        if (isModal && ratings.rtUrl) {
          item.style.cursor = 'pointer';
          item.title = 'View on Rotten Tomatoes';
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(ratings.rtUrl, '_blank');
          });
        }
        items.push(item);
      }

      // Audience score
      if (showAudience && ratings.rtAudience) {
        const status = this._rtStatus(ratings.rtAudience);
        const item = document.createElement('span');
        item.className = `nr-rating-item nr-rt nr-rt-audience`;
        const logo = `<img class="nr-logo nr-logo-rt" src="${this._assetUrl('rt-fresh.svg')}" alt="RT Audience">`;
        if (detailed) {
          item.innerHTML = logo
            + `<span class="nr-value">${ratings.rtAudience}</span>`
            + `<span class="nr-label">Audience</span>`;
        } else {
          item.innerHTML = logo + `<span class="nr-value nr-audience-val">${ratings.rtAudience}</span>`;
        }
        if (isModal && ratings.rtUrl) {
          item.style.cursor = 'pointer';
          item.title = 'Audience score on Rotten Tomatoes';
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(ratings.rtUrl, '_blank');
          });
        }
        items.push(item);
      }
    }

    // Letterboxd
    if (settings.showLetterboxd && ratings.letterboxd) {
      const item = document.createElement('span');
      item.className = 'nr-rating-item nr-lb';
      const logo = `<img class="nr-logo nr-logo-lb" src="${this._assetUrl('letterboxd.svg')}" alt="Letterboxd">`;
      if (detailed) {
        item.innerHTML = logo
          + `<span class="nr-value">${ratings.letterboxd}</span>`
          + `<span class="nr-scale">/5</span>`;
      } else {
        item.innerHTML = logo + `<span class="nr-value">${ratings.letterboxd}</span>`;
      }
      if (isModal && ratings.letterboxdUrl) {
        item.style.cursor = 'pointer';
        item.title = 'View on Letterboxd';
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          window.open(ratings.letterboxdUrl, '_blank');
        });
      }
      items.push(item);
    }

    return items;
  },

  _rtStatus(value) {
    if (!value) return 'none';
    const num = parseInt(value, 10);
    if (isNaN(num)) return 'none';
    return num >= 60 ? 'fresh' : 'rotten';
  },

  /**
   * Inject a badge onto a card element.
   */
  injectCardBadge(cardEl, ratings, settings) {
    if (!cardEl || cardEl.getAttribute(NR.PROCESSED_ATTR)) return;

    const badge = this.createCardBadge(ratings, settings);
    if (!badge) return;

    // Find the boxart container
    const target = cardEl.querySelector('.boxart-container') || cardEl;

    // Detect Top 10 cards (rank SVG inside the boxart) and adjust badge position
    if (target.querySelector('svg[class*="rank"], svg[class*="top-10"]')) {
      badge.classList.add('nr-top10');
    }

    // Ensure relative positioning for absolute badge
    if (getComputedStyle(target).position === 'static') {
      target.style.position = 'relative';
    }

    target.appendChild(badge);
    cardEl.setAttribute(NR.PROCESSED_ATTR, 'true');
  },

  /**
   * Inject ratings into a modal.
   */
  injectModalBadge(modalEl, ratings, settings) {
    // Remove existing badge if any
    const existing = modalEl.querySelector('.' + NR.MODAL_BADGE_CLASS);
    if (existing) existing.remove();

    const badge = this.createModalBadge(ratings, settings);
    if (!badge) return;

    // Find insertion point: after the title area, before episode selector
    const metaData = modalEl.querySelector(
      '.previewModal--detailsMetadata-left, ' +
      '.about-container, ' +
      '.previewModal--detailsMetadata'
    );

    if (metaData) {
      metaData.parentNode.insertBefore(badge, metaData);
    } else {
      // Fallback: append to modal content area
      const content = modalEl.querySelector('.ptrack-container') || modalEl;
      content.appendChild(badge);
    }
  },

  /**
   * Create a loading shimmer placeholder.
   */
  createShimmer() {
    const shimmer = document.createElement('div');
    shimmer.className = NR.BADGE_CLASS + ' nr-shimmer';
    shimmer.innerHTML = '<span class="nr-shimmer-bar"></span>';
    return shimmer;
  },

  /**
   * Remove all injected badges from the page.
   */
  removeAll() {
    document.querySelectorAll('.' + NR.BADGE_CLASS + ', .' + NR.MODAL_BADGE_CLASS).forEach(el => el.remove());
    document.querySelectorAll(`[${NR.PROCESSED_ATTR}]`).forEach(el => {
      el.removeAttribute(NR.PROCESSED_ATTR);
    });
  },
};
