// ============================================================
// State
// ============================================================
const STORAGE_KEY = 'watchlist:v1';
const SETTINGS_KEY = 'watchlist:settings:v1';

const state = {
  items: [],          // array of {id, type, title, year, poster, sourceId, source, extra}
  settings: {
    tmdb: '',
    igdbClientId: '',
    igdbToken: '',
    corsProxy: 'https://corsproxy.io/?',
  },
  activeTab: 'all',
};

const TYPE_LABELS = {
  movie: 'Movie',
  tv: 'TV',
  anime: 'Anime',
  game: 'Game',
  album: 'Album',
};

// ============================================================
// Storage
// ============================================================
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state.items = JSON.parse(raw);
  } catch (e) { console.warn('load items', e); }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) Object.assign(state.settings, JSON.parse(raw));
  } catch (e) { console.warn('load settings', e); }
}
function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
}
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

// ============================================================
// Helpers
// ============================================================
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

function makeKey(type, sourceId) { return `${type}:${sourceId}`; }
function exists(type, sourceId) {
  return state.items.some(it => makeKey(it.type, it.sourceId) === makeKey(type, sourceId));
}
function addItem(item) {
  if (item.sourceId && exists(item.type, item.sourceId)) return false;
  state.items.push({ id: uid(), addedAt: Date.now(), ...item });
  saveItems();
  render();
  return true;
}
function removeItem(id) {
  state.items = state.items.filter(it => it.id !== id);
  saveItems();
  render();
}

function openModal(id) { $('#' + id).classList.remove('hidden'); }
function closeModal(id) { $('#' + id).classList.add('hidden'); }

// ============================================================
// Rendering
// ============================================================
function render() {
  document.body.dataset.tab = state.activeTab;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === state.activeTab));

  const items = state.activeTab === 'all'
    ? [...state.items].sort((a, b) => b.addedAt - a.addedAt)
    : state.items.filter(it => it.type === state.activeTab).sort((a, b) => b.addedAt - a.addedAt);

  const grid = $('#grid');
  grid.innerHTML = '';
  if (!items.length) {
    $('#empty').classList.remove('hidden');
  } else {
    $('#empty').classList.add('hidden');
    for (const it of items) grid.appendChild(card(it));
  }
}

function card(item) {
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.type = item.type;
  el.dataset.id = item.id;

  const posterImg = item.poster
    ? `<img class="poster" src="${escapeHtml(item.poster)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" />`
    : `<div class="poster"></div>`;
  el.innerHTML = `
    <div class="badge">${TYPE_LABELS[item.type] || item.type}</div>
    ${posterImg}
    <div class="meta">
      <div class="title">${escapeHtml(item.title)}</div>
      <div class="sub">${escapeHtml(item.year || item.extra?.subtitle || '')}</div>
    </div>
  `;
  el.addEventListener('click', () => showDetail(item));
  return el;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function showDetail(item) {
  const c = $('#detail-content');
  const poster = item.poster
    ? `<img class="d-poster" src="${item.poster}" alt="" />`
    : '';
  c.innerHTML = `
    ${poster}
    <h3>${escapeHtml(item.title)}</h3>
    <div class="d-sub">${escapeHtml(TYPE_LABELS[item.type])} ${item.year ? '· ' + escapeHtml(item.year) : ''}${item.extra?.subtitle ? ' · ' + escapeHtml(item.extra.subtitle) : ''}</div>
    <div class="d-overview">${escapeHtml(item.extra?.overview || '')}</div>
  `;
  const removeBtn = $('#detail-remove');
  removeBtn.onclick = () => { removeItem(item.id); closeModal('detail-modal'); };
  openModal('detail-modal');
}

// ============================================================
// Random pick
// ============================================================
function randomPick() {
  const pool = state.activeTab === 'all'
    ? state.items
    : state.items.filter(it => it.type === state.activeTab);
  if (!pool.length) {
    alert("Nothing in this tab to pick from.");
    return;
  }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const c = $('#random-content');
  const poster = pick.poster ? `<img class="d-poster" src="${pick.poster}" alt="" />` : '';
  c.innerHTML = `
    ${poster}
    <h3>${escapeHtml(pick.title)}</h3>
    <div class="d-sub">${escapeHtml(TYPE_LABELS[pick.type])} ${pick.year ? '· ' + escapeHtml(pick.year) : ''}</div>
  `;
  openModal('random-modal');
}

// ============================================================
// API: TMDB (movies + tv)
// ============================================================
async function tmdbSearch(type, query, opts = {}) {
  if (!state.settings.tmdb) throw new Error('Set TMDB API key in Settings.');
  const params = new URLSearchParams({
    api_key: state.settings.tmdb,
    query,
  });
  if (opts.year) {
    params.set(type === 'movie' ? 'primary_release_year' : 'first_air_date_year', opts.year);
  }
  const url = `https://api.themoviedb.org/3/search/${type}?${params}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('TMDB error ' + r.status);
  const data = await r.json();
  return (data.results || []).slice(0, 20).map(x => ({
    type,
    sourceId: String(x.id),
    source: 'tmdb',
    title: type === 'movie' ? x.title : x.name,
    year: (x.release_date || x.first_air_date || '').slice(0, 4),
    poster: x.poster_path ? `https://image.tmdb.org/t/p/w300${x.poster_path}` : '',
    extra: { overview: x.overview || '' },
  }));
}

function normalizeTitle(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function tmdbFindMovie(name, year) {
  // Use year filter when available; fall back to no filter.
  let results = year ? await tmdbSearch('movie', name, { year }) : [];
  if (!results.length) results = await tmdbSearch('movie', name);
  if (!results.length) return null;

  const target = normalizeTitle(name);
  // Exact normalized-title match wins. Prefer year match if known. Otherwise first.
  const exact = results.filter(r => normalizeTitle(r.title) === target);
  if (year) {
    const exactYear = exact.find(r => r.year === year);
    if (exactYear) return exactYear;
    if (exact.length) return exact[0];
    const yearOnly = results.find(r => r.year === year);
    if (yearOnly) return yearOnly;
  } else if (exact.length) {
    return exact[0];
  }
  return results[0];
}

// ============================================================
// API: Jikan (anime, MAL data)
// ============================================================
async function jikanSearch(query) {
  const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=12&sfw=false`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Jikan error ' + r.status);
  const data = await r.json();
  return (data.data || []).map(x => ({
    type: 'anime',
    sourceId: String(x.mal_id),
    source: 'mal',
    title: x.title,
    year: x.aired?.from ? x.aired.from.slice(0, 4) : '',
    poster: x.images?.jpg?.image_url || '',
    extra: { overview: x.synopsis || '', subtitle: x.type || '' },
  }));
}
async function jikanById(malId) {
  const r = await fetch(`https://api.jikan.moe/v4/anime/${malId}`);
  if (!r.ok) throw new Error('Jikan error ' + r.status);
  const x = (await r.json()).data;
  return {
    type: 'anime',
    sourceId: String(x.mal_id),
    source: 'mal',
    title: x.title,
    year: x.aired?.from ? x.aired.from.slice(0, 4) : '',
    poster: x.images?.jpg?.image_url || '',
    extra: { overview: x.synopsis || '', subtitle: x.type || '' },
  };
}

// ============================================================
// API: IGDB (games) — via CORS proxy
// ============================================================
async function igdbSearch(query) {
  const { igdbClientId, igdbToken, corsProxy } = state.settings;
  if (!igdbClientId || !igdbToken) {
    throw new Error('Set Twitch Client ID + Access Token in Settings (IGDB).');
  }
  const target = 'https://api.igdb.com/v4/games';
  const url = corsProxy ? `${corsProxy}${encodeURIComponent(target)}` : target;
  const body = `search "${query.replace(/"/g, '\\"')}"; fields name, cover.image_id, first_release_date, summary; limit 12;`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Client-ID': igdbClientId,
      'Authorization': `Bearer ${igdbToken}`,
      'Content-Type': 'text/plain',
    },
    body,
  });
  if (!r.ok) throw new Error('IGDB error ' + r.status + ' (CORS proxy may be required)');
  const data = await r.json();
  return data.map(x => ({
    type: 'game',
    sourceId: String(x.id),
    source: 'igdb',
    title: x.name,
    year: x.first_release_date ? new Date(x.first_release_date * 1000).getFullYear().toString() : '',
    poster: x.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${x.cover.image_id}.jpg` : '',
    extra: { overview: x.summary || '' },
  }));
}

// ============================================================
// API: MusicBrainz + Cover Art Archive (albums)
// ============================================================
async function mbSearch(query) {
  const url = `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=12`;
  const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) throw new Error('MusicBrainz error ' + r.status);
  const data = await r.json();
  return (data['release-groups'] || []).map(rg => ({
    type: 'album',
    sourceId: rg.id,
    source: 'musicbrainz',
    title: rg.title,
    year: rg['first-release-date'] ? rg['first-release-date'].slice(0, 4) : '',
    poster: `https://coverartarchive.org/release-group/${rg.id}/front-250`,
    extra: {
      overview: '',
      subtitle: (rg['artist-credit'] || []).map(a => a.name).join(', '),
    },
  }));
}

// ============================================================
// Search dispatcher
// ============================================================
async function doSearch(type, query) {
  switch (type) {
    case 'movie': return tmdbSearch('movie', query);
    case 'tv':    return tmdbSearch('tv', query);
    case 'anime': return jikanSearch(query);
    case 'game':  return igdbSearch(query);
    case 'album': return mbSearch(query);
    default: return [];
  }
}

// ============================================================
// Imports
// ============================================================
function parseCSV(text) {
  // Minimal CSV parser handling quoted fields.
  const rows = [];
  let cur = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i+1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i+1] === '\n') i++;
        cur.push(field); field = '';
        if (cur.some(v => v.length)) rows.push(cur);
        cur = [];
      } else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

async function importLetterboxd(file) {
  if (!state.settings.tmdb) {
    setImportStatus('Set TMDB key first.');
    return;
  }
  const text = await file.text();
  const rows = parseCSV(text);
  if (!rows.length) return;
  const headers = rows[0].map(h => h.trim());
  const nameIdx = headers.indexOf('Name');
  const yearIdx = headers.indexOf('Year');
  if (nameIdx < 0) {
    setImportStatus('CSV missing "Name" column.');
    return;
  }
  let added = 0, skipped = 0, failed = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = (row[nameIdx] || '').trim();
    const year = (yearIdx >= 0 ? row[yearIdx] : '').trim();
    if (!name) continue;
    setImportStatus(`Letterboxd: ${i}/${rows.length - 1} — ${name}`);
    try {
      const pick = await tmdbFindMovie(name, year);
      if (!pick) { failed++; continue; }
      if (addItem(pick)) added++; else skipped++;
    } catch (e) {
      failed++;
    }
    // gentle throttle
    await new Promise(r => setTimeout(r, 60));
  }
  setImportStatus(`Letterboxd done. Added ${added}, skipped ${skipped}, failed ${failed}.`);
}

async function importMAL(file) {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const animes = doc.getElementsByTagName('anime');
  let added = 0, skipped = 0, failed = 0;
  for (let i = 0; i < animes.length; i++) {
    const el = animes[i];
    const status = el.getElementsByTagName('my_status')[0]?.textContent || '';
    if (status && status.toLowerCase() !== 'plan to watch') continue; // only watchlist entries
    const malId = el.getElementsByTagName('series_animedb_id')[0]?.textContent;
    const title = el.getElementsByTagName('series_title')[0]?.textContent || '(unknown)';
    if (!malId) continue;
    setImportStatus(`MAL: ${i+1}/${animes.length} — ${title}`);
    if (exists('anime', malId)) { skipped++; continue; }
    try {
      const item = await jikanById(malId);
      if (addItem(item)) added++; else skipped++;
    } catch (e) {
      failed++;
    }
    await new Promise(r => setTimeout(r, 350)); // Jikan rate limit ~3 rps
  }
  setImportStatus(`MAL done. Added ${added}, skipped ${skipped}, failed ${failed}.`);
}

function setImportStatus(s) { $('#import-status').textContent = s; }

// ============================================================
// Wiring
// ============================================================
function bind() {
  // Tabs
  $('#tabs').addEventListener('click', e => {
    const t = e.target.closest('.tab');
    if (!t) return;
    state.activeTab = t.dataset.tab;
    render();
  });

  // Header buttons
  $('#random-btn').addEventListener('click', randomPick);
  $('#random-again').addEventListener('click', randomPick);
  $('#add-btn').addEventListener('click', () => {
    if (state.activeTab !== 'all') $('#add-type').value = state.activeTab;
    $('#add-results').innerHTML = '';
    $('#add-query').value = '';
    openModal('add-modal');
    setTimeout(() => $('#add-query').focus(), 50);
  });
  $('#import-btn').addEventListener('click', () => {
    setImportStatus('');
    openModal('import-modal');
  });
  $('#settings-btn').addEventListener('click', () => {
    $('#key-tmdb').value = state.settings.tmdb;
    $('#key-igdb-id').value = state.settings.igdbClientId;
    $('#key-igdb-token').value = state.settings.igdbToken;
    $('#key-cors').value = state.settings.corsProxy;
    openModal('settings-modal');
  });

  // Settings save
  $('#settings-save').addEventListener('click', () => {
    state.settings.tmdb = $('#key-tmdb').value.trim();
    state.settings.igdbClientId = $('#key-igdb-id').value.trim();
    state.settings.igdbToken = $('#key-igdb-token').value.trim();
    state.settings.corsProxy = $('#key-cors').value.trim();
    saveSettings();
    closeModal('settings-modal');
  });

  // Modal close buttons
  document.addEventListener('click', e => {
    const t = e.target;
    if (t.matches('[data-close]')) closeModal(t.dataset.close);
    if (t.classList.contains('modal')) t.classList.add('hidden');
  });

  // Search
  $('#add-search').addEventListener('click', runSearch);
  $('#add-query').addEventListener('keydown', e => {
    if (e.key === 'Enter') runSearch();
  });

  // Imports
  $('#import-letterboxd').addEventListener('change', e => {
    if (e.target.files[0]) importLetterboxd(e.target.files[0]);
  });
  $('#import-mal').addEventListener('change', e => {
    if (e.target.files[0]) importMAL(e.target.files[0]);
  });
}

async function runSearch() {
  const type = $('#add-type').value;
  const query = $('#add-query').value.trim();
  const results = $('#add-results');
  if (!query) return;
  results.innerHTML = '<div class="muted small">Searching...</div>';
  try {
    const items = await doSearch(type, query);
    if (!items.length) {
      results.innerHTML = '<div class="muted small">No results.</div>';
      return;
    }
    results.innerHTML = '';
    for (const it of items) {
      const row = document.createElement('div');
      row.className = 'result-item';
      const already = exists(it.type, it.sourceId);
      row.innerHTML = `
        <img src="${it.poster || ''}" onerror="this.style.visibility='hidden'" alt="" />
        <div class="info">
          <div class="t">${escapeHtml(it.title)}</div>
          <div class="y">${escapeHtml(it.year || '')}${it.extra?.subtitle ? ' · ' + escapeHtml(it.extra.subtitle) : ''}</div>
        </div>
      `;
      const btn = document.createElement('button');
      btn.textContent = already ? 'Added' : 'Add';
      btn.disabled = already;
      btn.addEventListener('click', () => {
        if (addItem(it)) { btn.textContent = 'Added'; btn.disabled = true; }
      });
      row.appendChild(btn);
      results.appendChild(row);
    }
  } catch (e) {
    results.innerHTML = `<div class="muted small">Error: ${escapeHtml(e.message)}</div>`;
  }
}

// ============================================================
// Boot
// ============================================================
load();
bind();
render();
