# Watchlist

A single-page watchlist for movies, TV shows, anime, games, and albums. Vanilla JS, localStorage, deployable on GitHub Pages.

## Use

Open `index.html` in a browser, or push to GitHub Pages.

1. **Settings** → paste your API keys:
   - **TMDB** v3 API key — used for Movies and TV Shows. Get one at <https://www.themoviedb.org/settings/api>.
   - **Twitch Client ID + App Access Token** — used for IGDB (games). See <https://api-docs.igdb.com/#getting-started>.
   - **CORS proxy** — IGDB blocks direct browser calls. Default is `https://corsproxy.io/?`. Replace with your own proxy if needed.
   - Anime uses **Jikan** (no key, MAL data).
   - Albums use **iTunes Search API** (no key, sorted by popularity).

2. **+ Add** → pick a type, search, click Add.

3. **Random** → picks something at random from the active tab.

4. **Import**:
   - **Letterboxd**: export your watchlist from Letterboxd (a `.csv`). Requires TMDB key — each row is matched against TMDB by name + year.
   - **MyAnimeList**: export your animelist (`.xml`). Only entries with status `Plan to Watch` are imported (rate-limited to ~3/sec).

## Storage

All data is in `localStorage` (`watchlist:v1`, `watchlist:settings:v1`). Clearing site data wipes it.

## Files

- `index.html` — markup and modals
- `styles.css` — monochrome theme with subtle topical accents per tab
- `app.js` — state, rendering, API calls, imports
