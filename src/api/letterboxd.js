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

  fetchRating: async function(title, year) {
    if (!title) return null;

    var slug = this.toSlug(title);
    var baseUrl = 'https://letterboxd.com/film/' + slug + '/';

    var result = await this._tryFetch(baseUrl);
    if (result) return result;

    if (year) {
      var yearUrl = 'https://letterboxd.com/film/' + slug + '-' + year + '/';
      result = await this._tryFetch(yearUrl);
      if (result) return result;
    }

    return null;
  },

  _tryFetch: async function(url) {
    try {
      var response = await fetch(url);
      if (!response.ok) return null;

      var html = await response.text();
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
