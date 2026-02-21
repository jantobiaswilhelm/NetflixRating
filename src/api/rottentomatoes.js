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
   * Fetch RT scores for a title.
   * Tries movie page first (/m/), then TV page (/tv/).
   * @returns {{ critics: string|null, audience: string|null, url: string|null } | null}
   */
  fetchScores: async function(title, year) {
    if (!title) return null;

    var slug = this.toSlug(title);

    // Try movie page first
    var result = await this._tryFetch('https://www.rottentomatoes.com/m/' + slug);
    if (result) return result;

    // Try with year appended
    if (year) {
      result = await this._tryFetch('https://www.rottentomatoes.com/m/' + slug + '_' + year);
      if (result) return result;
    }

    // Try TV page
    result = await this._tryFetch('https://www.rottentomatoes.com/tv/' + slug);
    if (result) return result;

    return null;
  },

  _tryFetch: async function(url) {
    try {
      var response = await fetch(url);
      if (!response.ok) return null;

      var html = await response.text();
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
