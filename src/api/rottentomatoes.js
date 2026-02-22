/**
 * Rotten Tomatoes client.
 * Uses RT's Algolia search index to find the correct movie/show,
 * then returns scores directly from search results.
 */

var RTClient = {
  // RT's public Algolia search credentials (embedded in rottentomatoes.com frontend)
  ALGOLIA_APP_ID: '79FRDP12PN',
  ALGOLIA_API_KEY: '175588f6e5f8319b27702e4cc4013561',
  ALGOLIA_INDEX: 'content_rt',

  /**
   * Normalize a title for comparison: lowercase, strip articles, punctuation, whitespace.
   */
  _normalizeForCompare: function(title) {
    return title
      .toLowerCase()
      .replace(/^(the|a|an)\s+/i, '')
      .replace(/[^a-z0-9]/g, '');
  },

  /**
   * Check if two titles are similar enough to be the same movie.
   */
  _titlesMatch: function(searched, found) {
    var a = this._normalizeForCompare(searched);
    var b = this._normalizeForCompare(found);
    if (!a || !b) return false;

    if (a === b) return true;
    if (a.includes(b) || b.includes(a)) return true;

    var minLen = Math.min(a.length, b.length);
    var common = 0;
    for (var i = 0; i < minLen; i++) {
      if (a[i] === b[i]) common++;
      else break;
    }
    if (common >= minLen * 0.8 && common >= 4) return true;

    return false;
  },

  /**
   * Search RT via Algolia and pick the best matching result.
   * Considers title similarity and year proximity.
   */
  _searchAndMatch: async function(title, year) {
    var params = new URLSearchParams({
      query: title,
      hitsPerPage: '10',
      'x-algolia-application-id': this.ALGOLIA_APP_ID,
      'x-algolia-api-key': this.ALGOLIA_API_KEY,
    });

    var url = 'https://' + this.ALGOLIA_APP_ID + '-dsn.algolia.net/1/indexes/'
      + this.ALGOLIA_INDEX + '?' + params.toString();

    try {
      var response = await fetch(url);
      if (!response.ok) {
        console.warn('[NetflixRating] RT search HTTP error:', response.status);
        return null;
      }

      var data = await response.json();
      if (!data.hits || data.hits.length === 0) return null;

      return this._pickBestMatch(data.hits, title, year);
    } catch (e) {
      console.warn('[NetflixRating] RT search error:', e);
      return null;
    }
  },

  /**
   * Pick the best match from search results.
   * Filters by title similarity, then prefers exact year match,
   * then most recent if no year provided.
   */
  _pickBestMatch: function(hits, searchedTitle, searchedYear) {
    var self = this;

    // Filter to title matches only
    var matches = hits.filter(function(hit) {
      return hit.title && self._titlesMatch(searchedTitle, hit.title);
    });

    if (matches.length === 0) {
      console.warn('[NetflixRating] RT search: no title match for "' + searchedTitle + '" in', hits.map(function(h) { return h.title; }));
      return null;
    }

    // If we have a year, prefer exact or close year match
    if (searchedYear) {
      var yearNum = parseInt(searchedYear, 10);

      // Exact year match
      var exact = matches.filter(function(h) { return h.releaseYear === yearNum; });
      if (exact.length > 0) return exact[0];

      // Within 1 year
      var close = matches.filter(function(h) {
        return h.releaseYear && Math.abs(h.releaseYear - yearNum) <= 1;
      });
      if (close.length > 0) return close[0];
    }

    // No year or no year match: prefer most recent release
    matches.sort(function(a, b) {
      return (b.releaseYear || 0) - (a.releaseYear || 0);
    });

    return matches[0];
  },

  /**
   * Build the RT page URL from a search hit's vanity slug and type.
   */
  _buildUrl: function(hit) {
    var prefix = hit.type === 'tvSeries' ? '/tv/' : '/m/';
    return 'https://www.rottentomatoes.com' + prefix + hit.vanity;
  },

  /**
   * Fetch RT scores for a title.
   * Uses Algolia search to find the correct movie/show, avoiding slug-guessing mistakes.
   * @returns {{ critics: string|null, audience: string|null, url: string|null } | null}
   */
  fetchScores: async function(title, year) {
    if (!title) return null;

    var hit = await this._searchAndMatch(title, year);
    if (!hit) return null;

    var rt = hit.rottenTomatoes;
    if (!rt) return null;

    var critics = typeof rt.criticsScore === 'number' ? rt.criticsScore + '%' : null;
    var audience = typeof rt.audienceScore === 'number' ? rt.audienceScore + '%' : null;

    if (!critics && !audience) return null;

    var url = this._buildUrl(hit);

    console.log('[NetflixRating] RT matched:', {
      searched: title,
      found: hit.title,
      year: hit.releaseYear,
      critics: critics,
      audience: audience,
      url: url,
    });

    return { critics: critics, audience: audience, url: url };
  },
};
