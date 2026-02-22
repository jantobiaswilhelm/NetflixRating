/**
 * Letterboxd ratings via HTML fetch + JSON-LD parsing.
 */

var LetterboxdClient = {
  toSlug: function(title) {
    return title
      .toLowerCase()
      .replace(/['']/g, '')
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  },

  /**
   * Normalize a title for comparison.
   */
  _normalizeForCompare: function(title) {
    return title
      .toLowerCase()
      .replace(/^(the|a|an)\s+/i, '')
      .replace(/[^a-z0-9]/g, '');
  },

  /**
   * Check if two titles match closely enough.
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
   * Extract the film title from a Letterboxd page.
   */
  _extractPageTitle: function(html) {
    var jsonLdRegex = /<script\s+type="application\/ld\+json"\s*>([\s\S]*?)<\/script>/gi;
    var match;
    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        var jsonText = match[1]
          .replace(/\/\*\s*<!\[CDATA\[\s*\*\//g, '')
          .replace(/\/\*\s*\]\]>\s*\*\//g, '')
          .trim();
        var data = JSON.parse(jsonText);
        if (data.name) return data.name;
      } catch (e) {}
    }
    // Fallback: <title> tag
    var titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      return titleMatch[1].replace(/\s*[-–|].*$/, '').trim();
    }
    return null;
  },

  fetchRating: async function(title, year) {
    if (!title) return null;

    var slug = this.toSlug(title);
    var baseUrl = 'https://letterboxd.com/film/' + slug + '/';

    var result = await this._tryFetch(baseUrl, title);
    if (result) return result;

    if (year) {
      var yearUrl = 'https://letterboxd.com/film/' + slug + '-' + year + '/';
      result = await this._tryFetch(yearUrl, title);
      if (result) return result;
    }

    return null;
  },

  _tryFetch: async function(url, searchedTitle) {
    try {
      var response = await fetch(url);
      if (!response.ok) return null;

      var html = await response.text();

      // Validate that the page is for the correct film
      if (searchedTitle) {
        var pageTitle = this._extractPageTitle(html);
        if (pageTitle && !this._titlesMatch(searchedTitle, pageTitle)) {
          console.warn('[NetflixRating] Letterboxd title mismatch: searched "' + searchedTitle + '", found "' + pageTitle + '" at ' + url);
          return null;
        }
      }

      return this._parseRating(html, url);
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
        // Strip CDATA wrappers: /* <![CDATA[ */ ... /* ]]> */
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
