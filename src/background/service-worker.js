/**
 * Background service worker.
 * Handles rating requests from content scripts, orchestrates API calls, manages caching.
 */

try {
  importScripts('../cache/cache.js', '../api/omdb.js', '../api/letterboxd.js', '../api/rottentomatoes.js');
  console.log('[NetflixRating] Service worker scripts loaded successfully');
} catch (e) {
  console.error('[NetflixRating] Failed to load scripts:', e);
}

var pendingRequests = new Map();

var DEFAULT_SETTINGS = {
  omdbApiKey: '',
  showImdb: true,
  showRottenTomatoes: true,
  rtScoreType: 'audience',
  showLetterboxd: true,
  displayStyle: 'compact',
};

async function getSettings() {
  try {
    var result = await chrome.storage.local.get('nr_settings');
    return Object.assign({}, DEFAULT_SETTINGS, result.nr_settings);
  } catch (e) {
    console.warn('[NetflixRating] Settings load error:', e);
    return DEFAULT_SETTINGS;
  }
}

async function getRatingsForTitle(title, year) {
  if (!title) return null;

  var cacheKey = title.toLowerCase().replace(/\s+/g, '_');

  var cached = await RatingCache.get(cacheKey);
  if (cached) {
    console.log('[NetflixRating] Cache hit for:', title);
    return cached;
  }

  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  var promise = fetchAndCache(title, year, cacheKey);
  pendingRequests.set(cacheKey, promise);

  try {
    return await promise;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

async function fetchAndCache(title, year, cacheKey) {
  var settings = await getSettings();
  var ratings = {
    title: title, imdb: null, imdbId: null,
    rtCritics: null, rtAudience: null, rtUrl: null,
    letterboxd: null, letterboxdUrl: null
  };

  var wantsOmdb = settings.omdbApiKey && settings.showImdb;
  var wantsRT = settings.showRottenTomatoes;
  var wantsLb = settings.showLetterboxd;

  console.log('[NetflixRating] Fetching:', title, '| OMDb:', !!wantsOmdb, '| RT:', !!wantsRT, '| LB:', !!wantsLb);

  var promises = [];

  if (wantsOmdb) {
    promises.push(
      OmdbClient.fetchRatings(title, settings.omdbApiKey, year)
        .then(function(data) {
          if (data) {
            ratings.imdb = data.imdb;
            ratings.imdbId = data.imdbId;
            ratings.type = data.type;
            ratings.omdbTitle = data.title;
            ratings.year = data.year;
          }
          return RatingCache.incrementUsage(1);
        })
        .catch(function(e) { console.error('[NetflixRating] OMDb error for', title, ':', e); })
    );
  }

  if (wantsRT) {
    promises.push(
      RTClient.fetchScores(title, year)
        .then(function(data) {
          if (data) {
            ratings.rtCritics = data.critics;
            ratings.rtAudience = data.audience;
            ratings.rtUrl = data.url;
          }
        })
        .catch(function(e) { console.error('[NetflixRating] RT error for', title, ':', e); })
    );
  }

  if (wantsLb) {
    promises.push(
      LetterboxdClient.fetchRating(title, year)
        .then(function(data) {
          if (data) {
            ratings.letterboxd = data.rating;
            ratings.letterboxdUrl = data.url;
          }
        })
        .catch(function(e) { console.error('[NetflixRating] LB error for', title, ':', e); })
    );
  }

  await Promise.all(promises);

  console.log('[NetflixRating] Final ratings for', title, ':', JSON.stringify(ratings));

  var hasData = ratings.imdb || ratings.rtCritics || ratings.rtAudience || ratings.letterboxd;

  if (hasData) {
    var ttl = 7 * 24 * 60 * 60 * 1000;
    await RatingCache.set(cacheKey, ratings, ttl);
  }

  return ratings;
}

async function handleBatchRequest(titles) {
  var results = {};

  var promises = titles.map(function(entry) {
    return getRatingsForTitle(entry.title, entry.year)
      .then(function(ratings) {
        if (ratings) {
          results[entry.title] = ratings;
        }
      });
  });

  await Promise.all(promises);
  return results;
}

async function validateApiKey(apiKey) {
  try {
    var response = await fetch(
      'https://www.omdbapi.com/?apikey=' + encodeURIComponent(apiKey) + '&t=Inception'
    );
    var data = await response.json();

    if (data.Response === 'True') {
      return { valid: true };
    }
    return { valid: false, error: data.Error || 'Invalid API key' };
  } catch (e) {
    return { valid: false, error: 'Network error: ' + e.message };
  }
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log('[NetflixRating] Message received:', message.type);

  if (message.type === 'VALIDATE_KEY') {
    validateApiKey(message.apiKey)
      .then(sendResponse)
      .catch(function() { sendResponse({ valid: false, error: 'Validation failed' }); });
    return true;
  }

  if (message.type === 'GET_RATINGS') {
    getRatingsForTitle(message.title, message.year)
      .then(sendResponse)
      .catch(function() { sendResponse(null); });
    return true;
  }

  if (message.type === 'GET_RATINGS_BATCH') {
    handleBatchRequest(message.titles)
      .then(sendResponse)
      .catch(function() { sendResponse({}); });
    return true;
  }

  if (message.type === 'GET_USAGE') {
    RatingCache.getUsage()
      .then(function(count) { sendResponse({ count: count }); })
      .catch(function() { sendResponse({ count: 0 }); });
    return true;
  }

  if (message.type === 'GET_CACHE_STATS') {
    RatingCache.getStats()
      .then(sendResponse)
      .catch(function() { sendResponse({ total: 0, active: 0, expired: 0, memorySize: 0 }); });
    return true;
  }

  if (message.type === 'CLEAR_CACHE') {
    RatingCache.clearRatings()
      .then(function(count) { sendResponse({ cleared: count }); })
      .catch(function() { sendResponse({ cleared: 0 }); });
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    getSettings()
      .then(sendResponse)
      .catch(function() { sendResponse(DEFAULT_SETTINGS); });
    return true;
  }

  if (message.type === 'SAVE_SETTINGS') {
    chrome.storage.local.set({ nr_settings: message.settings })
      .then(function() {
        chrome.tabs.query({ url: 'https://www.netflix.com/*' }).then(function(tabs) {
          tabs.forEach(function(tab) {
            chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_CHANGED', settings: message.settings })
              .catch(function() {});
          });
        });
        sendResponse({ ok: true });
      })
      .catch(function() { sendResponse({ ok: false }); });
    return true;
  }

  return false;
});

console.log('[NetflixRating] Service worker initialized');
