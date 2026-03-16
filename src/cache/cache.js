/**
 * Two-tier cache: in-memory Map (fast, ephemeral) + chrome.storage.local (persistent, TTL-based).
 * Used by the service worker for rating data.
 */

const memoryCache = new Map();

var RatingCache = {
  async get(key) {
    const prefixed = 'nr_' + key;

    if (memoryCache.has(prefixed)) {
      const entry = memoryCache.get(prefixed);
      if (Date.now() < entry.expiresAt) {
        return entry.data;
      }
      memoryCache.delete(prefixed);
    }

    try {
      const result = await chrome.storage.local.get(prefixed);
      if (result[prefixed]) {
        const entry = result[prefixed];
        if (Date.now() < entry.expiresAt) {
          memoryCache.set(prefixed, entry);
          return entry.data;
        }
        chrome.storage.local.remove(prefixed);
      }
    } catch (e) {
      console.warn('[NetflixRating] Cache read error:', e);
    }

    return null;
  },

  async set(key, data, ttl) {
    const prefixed = 'nr_' + key;
    const entry = {
      data,
      expiresAt: Date.now() + ttl,
      cachedAt: Date.now(),
    };

    memoryCache.set(prefixed, entry);

    try {
      await chrome.storage.local.set({ [prefixed]: entry });
    } catch (e) {
      console.warn('[NetflixRating] Cache write error:', e);
    }
  },

  async getUsage() {
    try {
      const result = await chrome.storage.local.get('nr_daily_usage');
      const usage = result.nr_daily_usage;
      if (usage && usage.date === new Date().toISOString().slice(0, 10)) {
        return usage.count;
      }
      return 0;
    } catch {
      return 0;
    }
  },

  async incrementUsage(amount = 1) {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const result = await chrome.storage.local.get('nr_daily_usage');
      const usage = result.nr_daily_usage;
      let count = amount;
      if (usage && usage.date === today) {
        count = usage.count + amount;
      }
      await chrome.storage.local.set({
        nr_daily_usage: { date: today, count },
      });
      return count;
    } catch {
      return amount;
    }
  },

  async clearRatings() {
    try {
      const all = await chrome.storage.local.get(null);
      const ratingKeys = Object.keys(all).filter(
        k => k.startsWith('nr_') && k !== 'nr_daily_usage' && k !== 'nr_settings' && k !== 'nr_watched'
      );
      if (ratingKeys.length > 0) {
        await chrome.storage.local.remove(ratingKeys);
      }
      memoryCache.clear();
      return ratingKeys.length;
    } catch (e) {
      console.warn('[NetflixRating] Cache clear error:', e);
      return 0;
    }
  },

  async getStats() {
    try {
      const all = await chrome.storage.local.get(null);
      const ratingKeys = Object.keys(all).filter(
        k => k.startsWith('nr_') && k !== 'nr_daily_usage' && k !== 'nr_settings' && k !== 'nr_watched'
      );
      let expired = 0;
      const now = Date.now();
      for (const k of ratingKeys) {
        if (all[k].expiresAt && now >= all[k].expiresAt) expired++;
      }
      return {
        total: ratingKeys.length,
        active: ratingKeys.length - expired,
        expired,
        memorySize: memoryCache.size,
      };
    } catch {
      return { total: 0, active: 0, expired: 0, memorySize: 0 };
    }
  },
};
