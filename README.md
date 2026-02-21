# NetflixRating

Chrome extension that overlays IMDb, Rotten Tomatoes, and Letterboxd ratings directly onto Netflix's browse UI.

![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-green) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **IMDb ratings** via OMDb API
- **Rotten Tomatoes** critics and/or audience scores (scraped directly from RT)
- **Letterboxd** ratings via page scraping
- Ratings appear on **browse cards** and **detail modals**
- **Top 10** section support
- Compact and detailed display modes
- Two-tier caching (in-memory + persistent) to minimize API calls
- Configurable via popup: toggle sources, choose RT score type, manage cache

## Screenshots

| Browse Cards | Popup Settings |
|---|---|
| Ratings overlay on Netflix title cards | Configure sources, API key, display style |

## Setup

1. Clone this repo
2. Go to `chrome://extensions` and enable **Developer mode**
3. Click **Load unpacked** and select the project folder
4. Click the extension icon and enter your **OMDb API key**
   - Get a free key at [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx) (1,000 requests/day)
   - You must **activate the key via email** before it will work
   - Enter just the key (e.g. `a1b2c3d4`), not the full URL

## Configuration

| Setting | Options | Default |
|---|---|---|
| IMDb | On / Off | On |
| Rotten Tomatoes | On / Off | On |
| RT Score Type | Audience / Critics / Both | Audience |
| Letterboxd | On / Off | On |
| Display Style | Compact / Detailed | Compact |

## Architecture

```
Netflix Tab (Content Scripts)              Service Worker (Background)
┌────────────────────────────┐            ┌──────────────────────────┐
│ observer.js (DOM changes)  │  messages  │ service-worker.js        │
│ extractor.js (get titles)  │──────────> │ cache.js (memory+storage)│
│ injector.js (add badges)   │ <────────  │ omdb.js (IMDb)           │
│ content.css (styling)      │  ratings   │ rottentomatoes.js (RT)   │
└────────────────────────────┘            │ letterboxd.js (LB)       │
                                          └──────────────────────────┘
```

## License

MIT
