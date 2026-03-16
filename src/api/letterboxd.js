/**
 * Letterboxd client.
 * Uses Letterboxd's autocomplete search to find the correct film,
 * then fetches the rating from the film page.
 */

var LetterboxdClient = {
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
   * Search Letterboxd via autocomplete and pick the best matching result.
   * Considers title similarity and year proximity.
   */
  _searchAndMatch: async function(title, year) {
    var url = 'https://letterboxd.com/s/autocompletefilm?q='
      + encodeURIComponent(title) + '&limit=10&adult=false';

    try {
      var response = await fetch(url);
      if (!response.ok) {
        console.warn('[NetflixRating] Letterboxd search HTTP error:', response.status);
        return null;
      }

      var data = await response.json();
      if (!data.data || data.data.length === 0) return null;

      return this._pickBestMatch(data.data, title, year);
    } catch (e) {
      console.warn('[NetflixRating] Letterboxd search error:', e);
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
      return hit.name && self._titlesMatch(searchedTitle, hit.name);
    });

    if (matches.length === 0) {
      console.warn('[NetflixRating] Letterboxd search: no title match for "' + searchedTitle + '" in', hits.map(function(h) { return h.name; }));
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
   * Fetch Letterboxd rating for a title.
   * Uses autocomplete search to find the correct film, then scrapes the rating.
   * @returns {{ rating: string, url: string } | null}
   */
  fetchRating: async function(title, year) {
    if (!title) return null;

    var hit = await this._searchAndMatch(title, year);
    if (!hit) return null;

    var filmUrl = 'https://letterboxd.com' + hit.url;

    console.log('[NetflixRating] Letterboxd matched:', {
      searched: title,
      found: hit.name,
      year: hit.releaseYear,
      url: filmUrl,
    });

    // Fetch the film page to get the rating from JSON-LD
    try {
      var response = await fetch(filmUrl);
      if (!response.ok) return null;

      var html = await response.text();
      return this._parseRating(html, filmUrl);
    } catch (e) {
      console.warn('[NetflixRating] Letterboxd fetch error:', e);
      return null;
    }
  },

  _parseRating: function(html, url) {
    var jsonLdRegex = /<script\s+type="application\/ld\+json"\s*>([\s\S]*?)<\/script>/gi;
    var match;

    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        var jsonText = match[1]
          .replace(/\/\*\s*<!\[CDATA\[\s*\*\//g, '')
          .replace(/\/\*\s*\]\]>\s*\*\//g, '')
          .trim();
        var data = JSON.parse(jsonText);
        if (data.aggregateRating && data.aggregateRating.ratingValue) {
          var raw = parseFloat(data.aggregateRating.ratingValue);
          if (!isNaN(raw)) {
            return { rating: raw.toFixed(1), url: url };
          }
        }
      } catch (e) {
        // continue
      }
    }

    return null;
  },
};
