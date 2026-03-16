/**
 * Netflix DOM selectors, API endpoints, and default configuration.
 * Shared across content scripts (loaded as a global via manifest).
 */
const NR = window.NR || {};

NR.SELECTORS = {
  // Browse page title cards
  CARD_LINK: 'a.slider-refocus',
  CARD_CONTAINER: '.slider-item',
  CARD_IMAGE: '.boxart-image',
  CARD_FALLBACK_TEXT: 'p.fallback-text',
  TITLE_CARD: '.title-card-container',

  // Mini modal (hover preview)
  MINI_MODAL: '.previewModal--container',
  MINI_MODAL_TITLE: '.previewModal--player-titleTreatment-logo',
  MINI_MODAL_TITLE_TEXT: 'h3.previewModal--section-header, .previewModal--metadatAndControls-title-name',

  // Detail modal (full expanded view)
  DETAIL_MODAL: '.detail-modal',
  DETAIL_MODAL_TITLE: '.about-header h3.previewModal--section-header strong',
  DETAIL_MODAL_ALT: '.previewModal--detailsMetadata-left',

  // Billboard (hero section)
  BILLBOARD: '.billboard-row',
  BILLBOARD_TITLE: '.billboard-title .title-logo',

  // Common
  SLIDER_ROW: '.ltr-1apqrcg',
  BODY: 'document.body',
  JAWBONE: '.jawBone',
};

NR.API = {
  OMDB_BASE: 'https://www.omdbapi.com/',
  LETTERBOXD_BASE: 'https://letterboxd.com/film/',
  OMDB_KEY_URL: 'https://www.omdbapi.com/apikey.aspx',
};

NR.CACHE = {
  OMDB_TTL: 7 * 24 * 60 * 60 * 1000,        // 7 days
  LETTERBOXD_TTL: 3 * 24 * 60 * 60 * 1000,   // 3 days
  STORAGE_PREFIX: 'nr_',
  USAGE_KEY: 'nr_daily_usage',
  SETTINGS_KEY: 'nr_settings',
};

NR.DEFAULTS = {
  settings: {
    omdbApiKey: '',
    showImdb: true,
    showRottenTomatoes: true,
    rtScoreType: 'audience',
    showLetterboxd: true,
    displayStyle: 'compact',
    enableGenreSort: false,
    genreSortBy: 'imdb',
  },
  DEBOUNCE_CARDS: 200,
  DEBOUNCE_MODALS: 300,
  DAILY_API_LIMIT: 1000,
  DAILY_API_WARNING: 900,
};

NR.BADGE_CLASS = 'nr-rating-badge';
NR.MODAL_BADGE_CLASS = 'nr-modal-ratings';
NR.PROCESSED_ATTR = 'data-nr-processed';

window.NR = NR;
