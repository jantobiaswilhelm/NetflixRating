/**
 * Title normalization and formatting utilities.
 * Shared across content scripts (loaded as a global via manifest).
 */
NR.helpers = {

  /**
   * Normalize a Netflix title string for API lookups.
   * Strips season info, "Limited Series", trailing colons, extra whitespace, etc.
   */
  normalizeTitle(raw) {
    if (!raw) return '';
    let title = raw.trim();

    // Remove "Season X", "Volume X", "Part X", "Chapter X"
    title = title.replace(/:\s*(Season|Volume|Part|Chapter|Book)\s+\d+.*/i, '');
    title = title.replace(/\s+(Season|Volume|Part|Chapter|Book)\s+\d+.*/i, '');

    // Remove series descriptors
    title = title.replace(/:\s*(Limited Series|Miniseries|The Series|The Movie|A Film).*/i, '');
    title = title.replace(/\s*[-–—]\s*(Limited Series|Miniseries|The Series|The Movie|A Film)$/i, '');

    // Remove trailing colon or dash left over
    title = title.replace(/[\s:–—-]+$/, '');

    // Collapse whitespace
    title = title.replace(/\s+/g, ' ').trim();

    return title;
  },

  /**
   * Generate a Letterboxd slug from a title.
   * "The Shawshank Redemption" → "the-shawshank-redemption"
   */
  toLetterboxdSlug(title) {
    return title
      .toLowerCase()
      .replace(/['']/g, '')           // Remove apostrophes
      .replace(/&/g, 'and')           // & → and
      .replace(/[^a-z0-9\s-]/g, '')   // Strip non-alphanumeric
      .replace(/\s+/g, '-')           // Spaces → dashes
      .replace(/-+/g, '-')            // Collapse dashes
      .replace(/^-|-$/g, '');         // Trim dashes
  },

  /**
   * Format a rating value for display.
   * Handles N/A, missing data, and normalizes to one decimal.
   */
  formatRating(value) {
    if (!value || value === 'N/A' || value === 'undefined') return null;
    const num = parseFloat(value);
    if (isNaN(num)) return null;
    return num % 1 === 0 ? num.toString() : num.toFixed(1);
  },

  /**
   * Parse Rotten Tomatoes percentage string.
   * "85%" → "85%"
   */
  formatRTRating(value) {
    if (!value || value === 'N/A') return null;
    if (value.includes('%')) return value;
    const num = parseInt(value, 10);
    if (isNaN(num)) return null;
    return num + '%';
  },

  /**
   * Determine RT freshness status from percentage.
   */
  rtStatus(value) {
    if (!value) return 'none';
    const num = parseInt(value, 10);
    if (isNaN(num)) return 'none';
    return num >= 60 ? 'fresh' : 'rotten';
  },

  /**
   * Simple debounce.
   */
  debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * Extract year from Netflix metadata if visible.
   */
  extractYear(container) {
    if (!container) return null;
    const yearEl = container.querySelector('.year, .duration, .maturity-rating');
    if (!yearEl) return null;
    const match = yearEl.textContent.match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : null;
  },
};
