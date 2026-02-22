/**
 * Rotten Tomatoes scraper.
 * Fetches the RT page and extracts critics + audience scores from inline JS data.
 */

var RTClient = {
  /**
   * Generate an RT slug from a title.
   * "The Shawshank Redemption" → "the_shawshank_redemption"
   */
  toSlug: function(title) {
    return title
      .toLowerCase()
      .replace(/['']/g, '')
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  },

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
   * Uses normalized comparison — one must contain the other,
   * or they must match closely.
   */
  _titlesMatch: function(searched, found) {
    var a = this._normalizeForCompare(searched);
    var b = this._normalizeForCompare(found);
    if (!a || !b) return false;

    // Exact match after normalization
    if (a === b) return true;

    // One contains the other (handles subtitles, etc.)
    if (a.includes(b) || b.includes(a)) return true;

    // Check if they share a long common prefix (at least 80% of shorter string)
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
   * Extract the movie/show title from the RT HTML page.
   */
  _extractPageTitle: function(html) {
    // Try <title> tag: "Movie Name - Rotten Tomatoes"
    var titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      var pageTitle = titleMatch[1]
        .replace(/\s*[-–|]\s*Rotten Tomatoes.*$/i, '')
        .trim();
      if (pageTitle) return pageTitle;
    }

    // Try JSON-LD name
    var jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (jsonLdMatch) {
      try {
        var data = JSON.parse(jsonLdMatch[1]);
        if (data.name) return data.name;
      } catch (e) {}
    }

    return null;
  },

  /**
   * Fetch RT scores for a title.
   * Tries movie page first (/m/), then TV page (/tv/).
   * Validates that the fetched page matches the searched title.
   * @returns {{ critics: string|null, audience: string|null, url: string|null } | null}
   */
  fetchScores: async function(title, year) {
    if (!title) return null;

    var slug = this.toSlug(title);

    // Try movie page first
    var result = await this._tryFetch('https://www.rottentomatoes.com/m/' + slug, title);
    if (result) return result;

    // Try with year appended
    if (year) {
      result = await this._tryFetch('https://www.rottentomatoes.com/m/' + slug + '_' + year, title);
      if (result) return result;
    }

    // Try TV page
    result = await this._tryFetch('https://www.rottentomatoes.com/tv/' + slug, title);
    if (result) return result;

    return null;
  },

  _tryFetch: async function(url, searchedTitle) {
    try {
      var response = await fetch(url);
      if (!response.ok) return null;

      var html = await response.text();

      // Validate that the page is for the correct movie
      if (searchedTitle) {
        var pageTitle = this._extractPageTitle(html);
        if (pageTitle && !this._titlesMatch(searchedTitle, pageTitle)) {
          console.warn('[NetflixRating] RT title mismatch: searched "' + searchedTitle + '", found "' + pageTitle + '" at ' + url);
          return null;
        }
      }

      return this._parseScores(html, url);
    } catch (e) {
      console.warn('[NetflixRating] RT fetch error:', e);
      return null;
    }
  },

  /**
   * Extract critics and audience scores from inline JS data.
   */
  _parseScores: function(html, url) {
    var critics = null;
    var audience = null;

    // Extract criticsScore.score from inline JS
    var criticsMatch = html.match(/"criticsScore"\s*:\s*\{[^}]*"score"\s*:\s*"(\d+)"/);
    if (criticsMatch) {
      critics = criticsMatch[1] + '%';
    }

    // Extract audienceScore.score from inline JS
    var audienceMatch = html.match(/"audienceScore"\s*:\s*\{[^}]*"score"\s*:\s*"(\d+)"/);
    if (audienceMatch) {
      audience = audienceMatch[1] + '%';
    }

    // Also try JSON-LD for critics as fallback
    if (!critics) {
      var jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      if (jsonLdMatch) {
        try {
          var data = JSON.parse(jsonLdMatch[1]);
          if (data.aggregateRating && data.aggregateRating.ratingValue) {
            critics = data.aggregateRating.ratingValue + '%';
          }
        } catch (e) {}
      }
    }

    if (!critics && !audience) return null;

    console.log('[NetflixRating] RT parsed:', { critics: critics, audience: audience, url: url });
    return { critics: critics, audience: audience, url: url };
  },
};
