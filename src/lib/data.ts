// Pure data helpers: media types, statuses, progress, ordering, backups and share codes.

import type { CustomList, Data, External, Item, LogKind, MediaType, ReadUnit, Service, Status } from './types';

export const uid = (n = 10): string => {
  const a = 'abcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => a[b % a.length]).join('');
};

// ---------------------------------------------------------------------------------------------
// Media types and statuses

export interface TypeInfo {
  label: string;
  plural: string;
  /** Lowercase plural for sentences ("TV shows", "books"). */
  noun: string;
  emoji: string;
  verb: 'watch' | 'read' | 'play';
  /** How progress is tracked. */
  track: 'episodes' | 'reading' | 'game' | 'none';
}

export const TYPES: Record<MediaType, TypeInfo> = {
  tv: { label: 'TV show', plural: 'TV', noun: 'TV shows', emoji: '📺', verb: 'watch', track: 'episodes' },
  anime: { label: 'Anime', plural: 'Anime', noun: 'anime', emoji: '🌸', verb: 'watch', track: 'episodes' },
  movie: { label: 'Movie', plural: 'Movies', noun: 'movies', emoji: '🎬', verb: 'watch', track: 'none' },
  book: { label: 'Book', plural: 'Books', noun: 'books', emoji: '📖', verb: 'read', track: 'reading' },
  manga: { label: 'Manga', plural: 'Manga', noun: 'manga', emoji: '🗯️', verb: 'read', track: 'reading' },
  comic: { label: 'Comic', plural: 'Comics', noun: 'comics', emoji: '💥', verb: 'read', track: 'reading' },
  game: { label: 'Game', plural: 'Games', noun: 'games', emoji: '🎮', verb: 'play', track: 'game' },
};

export const TYPE_KEYS = Object.keys(TYPES) as MediaType[];

export const STATUSES: Status[] = ['active', 'want', 'hold', 'done', 'dropped'];

const ING = { watch: 'Watching', read: 'Reading', play: 'Playing' };

/** Status label for one type ("Want to read"), or for a mix of types when type is omitted. */
export function statusLabel(s: Status, type?: MediaType): string {
  const verb = type ? TYPES[type].verb : undefined;
  switch (s) {
    case 'want':
      return verb ? `Want to ${verb}` : 'Want to';
    case 'active':
      return verb ? ING[verb] : 'In progress';
    case 'hold':
      return 'On hold';
    case 'done':
      return verb === 'play' ? 'Finished' : verb === 'read' ? 'Read' : verb ? 'Watched' : 'Done';
    case 'dropped':
      return 'Dropped';
  }
}

export const STATUS_EMOJI: Record<Status, string> = { want: '🔖', active: '▶️', hold: '⏸️', done: '✅', dropped: '🚫' };

export const UNITS: { key: ReadUnit; label: string; short: string }[] = [
  { key: 'chapter', label: 'Chapter', short: 'Ch.' },
  { key: 'volume', label: 'Volume', short: 'Vol.' },
  { key: 'page', label: 'Page', short: 'p.' },
  { key: 'percent', label: 'Percent', short: '%' },
];

// ---------------------------------------------------------------------------------------------
// New data and normalizing old saves / hand-edited backups

export function newData(): Data {
  return { version: 1, items: [], lists: [], settings: { theme: 'dark', name: '', services: [] } };
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const num = (v: unknown): number | undefined => (typeof v === 'number' && isFinite(v) ? v : undefined);
const STATUS_SET = new Set<string>(STATUSES);

export function normalize(raw: unknown): Data {
  const d = (raw ?? {}) as Partial<Data>;
  const base = newData();
  const services: Service[] = (Array.isArray(d.settings?.services) ? d.settings.services : [])
    .filter((s) => s && s.name)
    .map((s) => ({ id: s.id || uid(6), name: String(s.name) }));
  const items = (Array.isArray(d.items) ? d.items : []).map(normalizeItem);
  const ids = new Set(items.map((i) => i.id));
  const lists: CustomList[] = (Array.isArray(d.lists) ? d.lists : []).map((l) => ({
    id: l.id || uid(),
    name: l.name ?? 'List',
    emoji: l.emoji || '📋',
    items: [...new Set(strings(l.items))].filter((id) => ids.has(id)),
    createdAt: num(l.createdAt) ?? Date.now(),
  }));
  return {
    version: 1,
    settings: {
      theme: (['auto', 'light', 'dark'] as const).includes(d.settings?.theme as never) ? d.settings!.theme : base.settings.theme,
      name: d.settings?.name ?? '',
      services,
    },
    items,
    lists,
  };
}

export function normalizeItem(raw: Partial<Item>): Item {
  const now = Date.now();
  const type: MediaType = raw.type && raw.type in TYPES ? raw.type : 'tv';
  return {
    id: raw.id || uid(),
    type,
    title: raw.title ?? '',
    year: num(raw.year),
    by: raw.by || undefined,
    cover: raw.cover || undefined,
    genres: strings(raw.genres),
    status: raw.status && STATUS_SET.has(raw.status) ? raw.status : 'want',
    order: num(raw.order) ?? now,
    where: strings(raw.where),
    tags: strings(raw.tags),
    progress: { ...(raw.progress ?? {}) },
    rating: num(raw.rating),
    review: raw.review ?? '',
    notes: raw.notes ?? '',
    from: raw.from || undefined,
    ext: raw.ext?.src && raw.ext.id ? { ...raw.ext, id: String(raw.ext.id) } : undefined,
    times: num(raw.times) ?? 0,
    log: Array.isArray(raw.log) ? raw.log.filter((l) => l && num(l.at)) : [],
    addedAt: num(raw.addedAt) ?? now,
    updatedAt: num(raw.updatedAt) ?? now,
    startedAt: num(raw.startedAt),
    finishedAt: num(raw.finishedAt),
  };
}

/** A fresh item at the end of its status. */
export function newItem(d: Data, fields: Partial<Item> & Pick<Item, 'type' | 'title'>): Item {
  const status = fields.status ?? 'want';
  const it = normalizeItem({ ...fields, status, order: nextOrder(d, status) });
  log(it, 'add', fields.from ? `Added (from ${fields.from})` : 'Added');
  if (status === 'active') it.startedAt = Date.now();
  return it;
}

// ---------------------------------------------------------------------------------------------
// Progress

export function progressText(it: Item): string {
  const p = it.progress;
  const parts: string[] = [];
  switch (TYPES[it.type].track) {
    case 'episodes': {
      if (p.episode == null && p.season == null) break;
      const seasons = it.ext?.seasons;
      const total = p.season && seasons ? seasons[p.season - 1] : it.type === 'anime' ? it.ext?.total : undefined;
      if (p.season) parts.push(`S${p.season}`);
      if (p.episode != null) parts.push(`E${p.episode}${total ? ` of ${total}` : ''}`);
      break;
    }
    case 'reading':
      if (p.n != null) {
        if (p.unit === 'percent') parts.push(`${p.n}%`);
        else {
          const u = UNITS.find((x) => x.key === (p.unit ?? 'chapter'))!;
          const total = readTotal(it);
          parts.push(`${u.label} ${p.n}${total ? ` of ${total}` : ''}`);
        }
      }
      break;
    case 'game':
      if (p.pct != null) parts.push(`${p.pct}%`);
      if (p.hours != null) parts.push(`${p.hours} h`);
      break;
  }
  if (p.note) parts.push(p.note);
  return parts.join(' · ');
}

/** The known total for the reading unit in use: volumes, chapters (manga) or pages (books). */
export function readTotal(it: Item): number | undefined {
  const u = it.progress.unit ?? 'chapter';
  if (u === 'volume') return it.ext?.volumes;
  if (u === 'chapter' && it.ext?.src === 'anilist') return it.ext.total;
  if (u === 'page' && it.ext?.src === 'openlibrary') return it.ext.total;
  return undefined;
}

/** True when the +1 button makes sense for this item. */
export function canStep(it: Item): boolean {
  const t = TYPES[it.type].track;
  if (t === 'episodes') return true;
  if (t === 'reading') return it.progress.n != null && it.progress.unit !== 'percent';
  return false;
}

export interface StepResult {
  /** Text for the log and the toast. */
  text: string;
  /** The last episode/chapter we know of was just reached. */
  reachedEnd: boolean;
}

/**
 * Moves to the next episode or chapter. With TVmaze season lengths, the episode after a season's last
 * one is the next season's first episode.
 */
export function step(it: Item): StepResult {
  const p = it.progress;
  let reachedEnd = false;
  if (TYPES[it.type].track === 'episodes') {
    const seasons = it.ext?.seasons;
    if (it.type === 'tv' && seasons?.length) {
      const s = p.season ?? 1;
      const e = p.episode ?? 0;
      if (e >= (seasons[s - 1] ?? Infinity) && s < seasons.length) {
        p.season = s + 1;
        p.episode = 1;
      } else {
        p.season = s;
        p.episode = e + 1;
      }
      const last = seasons.length;
      reachedEnd = p.season === last && p.episode >= seasons[last - 1] && !it.ext?.nextAir;
    } else {
      p.episode = (p.episode ?? 0) + 1;
      const total = it.type === 'anime' ? it.ext?.total : undefined;
      reachedEnd = !!total && p.episode >= total;
    }
  } else {
    p.unit ??= 'chapter';
    p.n = (p.n ?? 0) + 1;
    const total = readTotal(it);
    reachedEnd = !!total && p.n >= total;
  }
  const text = progressText({ ...it, progress: { ...p, note: undefined } });
  if (it.status !== 'active' && it.status !== 'done') setStatus(it, 'active');
  log(it, 'progress', text);
  return { text, reachedEnd };
}

// ---------------------------------------------------------------------------------------------
// Status changes and the history log

export function log(it: Item, kind: LogKind, text: string): void {
  const now = Date.now();
  const last = it.log[it.log.length - 1];
  // Several +1 taps in a row while catching up collapse into one line per item every few minutes.
  if (kind === 'progress' && last?.kind === 'progress' && now - last.at < 5 * 60_000) {
    last.at = now;
    last.text = text;
    last.n = (last.n ?? 1) + 1;
  } else it.log.push({ at: now, kind, text });
  it.updatedAt = now;
}

export function setStatus(it: Item, s: Status, d?: Data): void {
  if (it.status === s) return;
  const prev = it.status;
  it.status = s;
  if (d) it.order = nextOrder(d, s, true);
  const now = Date.now();
  if (s === 'active') {
    if (prev === 'done') {
      it.progress = { note: it.progress.note };
      log(it, 'again', `Started again`);
    } else log(it, 'start', 'Started');
    it.startedAt ??= now;
  } else if (s === 'done') {
    it.times++;
    it.finishedAt = now;
    log(it, 'done', it.times > 1 ? `Finished (×${it.times})` : 'Finished');
  } else if (s === 'dropped') log(it, 'drop', 'Dropped');
  else if (s === 'hold') log(it, 'hold', 'On hold');
  else it.updatedAt = now;
}

// ---------------------------------------------------------------------------------------------
// Ordering

/** An order value at the end of a status (or the top, for items just started). */
export function nextOrder(d: Data, s: Status, top = false): number {
  const orders = d.items.filter((i) => i.status === s).map((i) => i.order);
  if (!orders.length) return 1000;
  return top && s === 'active' ? Math.min(...orders) - 1 : Math.max(...orders) + 1;
}

/**
 * Drag-to-reorder for a filtered view: `shown` is what's on screen in order. The moved items swap into
 * each other's order slots, so items hidden by the filter keep their place.
 */
export function reorderShown(shown: Item[], from: number, to: number): void {
  const slots = shown.map((i) => i.order).sort((a, b) => a - b);
  const moved = [...shown];
  const [it] = moved.splice(from, 1);
  moved.splice(to, 0, it);
  // Equal slots (old data) would make the order unstable; spread them out first.
  for (let i = 1; i < slots.length; i++) if (slots[i] <= slots[i - 1]) slots[i] = slots[i - 1] + 0.001;
  moved.forEach((m, i) => (m.order = slots[i]));
}

export function move<T>(arr: T[], from: number, to: number): void {
  const [x] = arr.splice(from, 1);
  arr.splice(to, 0, x);
}

export type SortKey = 'mine' | 'title' | 'added' | 'rating' | 'updated';

export function sortItems(items: Item[], key: SortKey): Item[] {
  const a = [...items];
  const rank = (i: Item) => STATUSES.indexOf(i.status);
  switch (key) {
    case 'title':
      return a.sort((x, y) => sortTitle(x.title).localeCompare(sortTitle(y.title)));
    case 'added':
      return a.sort((x, y) => y.addedAt - x.addedAt);
    case 'updated':
      return a.sort((x, y) => y.updatedAt - x.updatedAt);
    case 'rating':
      return a.sort((x, y) => (y.rating ?? y.ext?.rating ?? -1) - (x.rating ?? x.ext?.rating ?? -1));
    default:
      return a.sort((x, y) => rank(x) - rank(y) || x.order - y.order);
  }
}

const sortTitle = (t: string) => t.replace(/^(the|a|an)\s+/i, '').toLowerCase();

export function search(items: Item[], q: string): Item[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  return items.filter((i) => {
    const hay = [i.title, i.by, ...i.tags, ...i.genres, i.notes, i.from].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

// ---------------------------------------------------------------------------------------------
// Ratings

/** 0–10 as a star string with halves: 7 → ★★★½☆ */
export function stars(r: number): string {
  const full = Math.floor(r / 2);
  const half = r % 2 >= 1;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - (half ? 1 : 0));
}

export const SOURCE_NAME: Record<External['src'], string> = { tvmaze: 'TVmaze', anilist: 'AniList', openlibrary: 'Open Library' };

// ---------------------------------------------------------------------------------------------
// Random pick

export interface PickFilter {
  types: MediaType[];
  where: string[];
  tags: string[];
  listId?: string;
  includeHold: boolean;
}

export function pickPool(d: Data, f: PickFilter): Item[] {
  const list = f.listId ? new Set(d.lists.find((l) => l.id === f.listId)?.items ?? []) : undefined;
  return d.items.filter(
    (i) =>
      (i.status === 'want' || (f.includeHold && i.status === 'hold')) &&
      (!f.types.length || f.types.includes(i.type)) &&
      (!f.where.length || i.where.some((w) => f.where.includes(w))) &&
      (!f.tags.length || i.tags.some((t) => f.tags.includes(t))) &&
      (!list || list.has(i.id)),
  );
}

export function allTags(d: Data): string[] {
  return [...new Set(d.items.flatMap((i) => i.tags))].sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------------------------
// Stats for the yearly recap

export interface YearStats {
  year: number;
  finished: Item[];
  byType: { type: MediaType; n: number }[];
  episodes: number;
  avgRating?: number;
  top: Item[];
}

export function yearStats(d: Data, year: number): YearStats {
  const inYear = (t?: number) => !!t && new Date(t).getFullYear() === year;
  const finished = d.items
    .filter((i) => i.log.some((l) => (l.kind === 'done') && inYear(l.at)))
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));
  const byType = TYPE_KEYS.map((type) => ({ type, n: finished.filter((i) => i.type === type).length })).filter((x) => x.n);
  const rated = finished.filter((i) => i.rating != null);
  const avgRating = rated.length ? rated.reduce((s, i) => s + i.rating!, 0) / rated.length : undefined;
  const episodes = d.items.reduce((s, i) => s + i.log.reduce((t, l) => t + (l.kind === 'progress' && inYear(l.at) ? (l.n ?? 1) : 0), 0), 0);
  const top = [...rated].sort((a, b) => b.rating! - a.rating!).slice(0, 5);
  return { year, finished, byType, episodes, avgRating, top };
}

export function years(d: Data): number[] {
  const ys = new Set<number>([new Date().getFullYear()]);
  for (const i of d.items) for (const l of i.log) if (l.kind === 'done') ys.add(new Date(l.at).getFullYear());
  return [...ys].sort((a, b) => b - a);
}

// ---------------------------------------------------------------------------------------------
// Backup

export const backupJson = (d: Data): string => JSON.stringify({ app: 'milkswatchtracker', ...d }, null, 1);

export function parseBackup(text: string): Data {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a Watch Tracker backup (it isn't JSON).");
  }
  const r = raw as { app?: string; items?: unknown };
  if (r?.app !== 'milkswatchtracker' || !Array.isArray(r.items)) throw new Error("That file isn't a Watch Tracker backup.");
  return normalize(raw);
}

// ---------------------------------------------------------------------------------------------
// Share codes: "MWT:" + base64url(JSON). Copy/paste only, because on iPhone a link opens Safari,
// whose storage is separate from the Home Screen app.

export interface ShareItem {
  t: string; // title
  ty: MediaType;
  y?: number;
  b?: string; // by
  c?: string; // cover
  g?: string[]; // genres
  x?: External; // lookup details
  w?: string[]; // where (service names, not ids)
  n?: string; // a note from the sender
  r?: number; // sender's rating
}

export interface Share {
  v: 1;
  from?: string;
  list?: { name: string; emoji: string };
  items: ShareItem[];
}

const PREFIX = 'MWT:';

function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function shareItem(d: Data, it: Item, withRating = true): ShareItem {
  const names = it.where.map((w) => d.settings.services.find((s) => s.id === w)?.name).filter((x): x is string => !!x);
  const ext = it.ext ? { ...it.ext, nextAir: undefined } : undefined;
  return {
    t: it.title,
    ty: it.type,
    y: it.year,
    b: it.by,
    c: it.cover,
    g: it.genres.length ? it.genres.slice(0, 5) : undefined,
    x: ext,
    w: names.length ? names : undefined,
    r: withRating ? it.rating : undefined,
  };
}

export function encodeShare(s: Share): string {
  return PREFIX + b64url(JSON.stringify(s));
}

/** Finds an MWT: code anywhere in pasted text (the whole message usually gets pasted). */
export function decodeShare(text: string): Share | undefined {
  const m = text.match(/MWT:([A-Za-z0-9_-]+)/);
  if (!m) return undefined;
  try {
    const s = JSON.parse(unb64url(m[1])) as Share;
    if (!Array.isArray(s.items)) return undefined;
    s.items = s.items.filter((i) => i && typeof i.t === 'string' && i.ty in TYPES);
    return s;
  } catch {
    return undefined;
  }
}

/** The readable message that goes with a code. */
export function shareText(s: Share): string {
  const lines = s.items.map((i) => {
    const bits = [TYPES[i.ty].label, i.y].filter(Boolean).join(', ');
    const on = i.w?.length ? ` on ${i.w.join(' / ')}` : '';
    const r = i.r != null ? ` ${stars(i.r)}` : '';
    return `${TYPES[i.ty].emoji} ${i.t} (${bits})${on}${r}${i.n ? `\n   “${i.n}”` : ''}`;
  });
  const head = s.list
    ? `${s.from ? `${s.from} shared a list` : 'A list for you'}: “${s.list.emoji} ${s.list.name}”`
    : s.from
      ? `${s.from} recommends:`
      : 'You might like:';
  return `${head}\n${lines.join('\n')}\n\nGot Milk's Watch Tracker? Copy this whole message and tap “Paste a recommendation”.\n${encodeShare(s)}`;
}

/** The existing item that matches a shared one (same lookup id, or same type and title). */
export function findSame(d: Data, si: ShareItem): Item | undefined {
  return d.items.find(
    (i) => (si.x && i.ext && i.ext.src === si.x.src && i.ext.id === si.x.id) || (i.type === si.ty && i.title.trim().toLowerCase() === si.t.trim().toLowerCase()),
  );
}

/** Service ids for shared service names; services you don't have are left off. */
export function matchServices(d: Data, names: string[] = []): string[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return names.map((n) => d.settings.services.find((s) => norm(s.name) === norm(n))?.id).filter((x): x is string => !!x);
}

export function itemFromShare(d: Data, si: ShareItem, from?: string): Item {
  const it = newItem(d, {
    type: si.ty,
    title: si.t,
    year: si.y,
    by: si.b,
    cover: si.c,
    genres: si.g ?? [],
    ext: si.x,
    where: matchServices(d, si.w),
    from,
    notes: si.n ? `${from ? from + ': ' : ''}“${si.n}”` : '',
  });
  return it;
}

export const SERVICE_IDEAS: Record<'watch' | 'read' | 'play', string[]> = {
  watch: ['Netflix', 'Hulu', 'Disney+', 'Max', 'Prime Video', 'Apple TV', 'Peacock', 'Paramount+', 'Crunchyroll', 'YouTube', 'Blu-ray / DVD'],
  read: ['Kindle', 'Libby', 'Library', 'Audible', 'Paperback', 'Shonen Jump', 'Webtoon', 'Comixology'],
  play: ['Switch', 'PlayStation', 'Xbox', 'Steam', 'PC', 'Game Pass', 'Phone'],
};

/** TVmaze/AniList network names that map onto your services ("Apple TV+" → "Apple TV"). */
export function serviceForNetwork(d: Data, network?: string): string | undefined {
  if (!network) return undefined;
  const norm = (s: string) => s.toLowerCase().replace(/\+|plus/g, '').replace(/[^a-z0-9]/g, '');
  const n = norm(network);
  return d.settings.services.find((s) => {
    const m = norm(s.name);
    return m && (m === n || n.startsWith(m) || m.startsWith(n));
  })?.id;
}
