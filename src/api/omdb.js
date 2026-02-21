/**
 * OMDb API client.
 * Returns IMDb rating and Rotten Tomatoes score from a single API call.
 */

var OmdbClient = {
  async fetchRatings(title, apiKey, year) {
    if (!apiKey || !title) return null;

    const params = new URLSearchParams({
      apikey: apiKey,
      t: title,
      plot: 'short',
    });
    if (year) params.set('y', year);

    try {
      const response = await fetch('https://www.omdbapi.com/?' + params);
      if (!response.ok) {
        console.warn('[NetflixRating] OMDb HTTP error:', response.status);
        return null;
      }

      const data = await response.json();
      console.log('[NetflixRating] OMDb raw response for', title, ':', JSON.stringify(data).slice(0, 200));

      if (data.Response === 'False') return null;

      const imdb = data.imdbRating && data.imdbRating !== 'N/A'
        ? data.imdbRating
        : null;

      var rt = null;
      if (data.Ratings && Array.isArray(data.Ratings)) {
        var rtEntry = data.Ratings.find(function(r) {
          return r.Source === 'Rotten Tomatoes';
        });
        if (rtEntry && rtEntry.Value && rtEntry.Value !== 'N/A') {
          rt = rtEntry.Value;
        }
      }

      return {
        imdb: imdb,
        imdbId: data.imdbID || null,
        rt: rt,
        title: data.Title,
        year: data.Year,
        type: data.Type,
      };
    } catch (e) {
      console.warn('[NetflixRating] OMDb fetch error:', e);
      return null;
    }
  },
};
