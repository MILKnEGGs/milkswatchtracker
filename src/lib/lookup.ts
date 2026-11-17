// Free lookups that need no account or API key. Only the title you type is sent.
//   TVmaze      TV shows: covers, ratings, network, episodes per season, next air date
//   AniList     anime and manga: covers, scores, episode/chapter/volume counts
//   Open Library books and comics: covers, authors, page counts, ratings
//   Wikipedia    movies and games: posters and descriptions, then runtime, director/studio, genres
//                and platforms from Wikidata. No ratings.

import type { External, MediaType } from './types';

export interface LookupResult {
  title: string;
  year?: number;
  by?: string;
  cover?: string;
  genres: string[];
  /** One line of detail under the title in the results. */
  sub: string;
  ext: External;
}

export const LOOKUP_FOR: Partial<Record<MediaType, string>> = {
  tv: 'TVmaze',
  anime: 'AniList',
  manga: 'AniList',
  book: 'Open Library',
  comic: 'Open Library',
  movie: 'Wikipedia',
  game: 'Wikipedia',
};

export const canLookup = (t: MediaType): boolean => t in LOOKUP_FOR;

const round1 = (n: number) => Math.round(n * 10) / 10;
const yearOf = (s?: string | null) => (s ? Number(s.slice(0, 4)) || undefined : undefined);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(res.status === 429 ? 'Too many lookups. Wait a minute and try again.' : `Lookup failed (${res.status}).`);
  return res.json() as Promise<T>;
}

export function lookup(type: MediaType, q: string, signal?: AbortSignal): Promise<LookupResult[]> {
  if (type === 'tv') return tvmaze(q, signal);
  if (type === 'anime' || type === 'manga') return anilist(type, q, signal);
  if (type === 'book' || type === 'comic') return openLibrary(q, signal);
  if (type === 'movie' || type === 'game') return wikipedia(type, q, signal);
  return Promise.resolve([]);
}

/** Fetches the details a search doesn't give (TV episode counts) or that change (new seasons, scores). */
export async function refresh(ext: External): Promise<External> {
  if (ext.src === 'tvmaze') return tvmazeDetails(ext);
  if (ext.src === 'anilist') return anilistById(ext);
  if (ext.src === 'wikipedia') return (await wikiDetails(ext)).ext;
  return ext;
}

// ---------------------------------------------------------------------------------------------
// Wikipedia + Wikidata (movies and games)
//
// One search request finds articles that use the film or video game infobox and returns their
// description ("2016 film by Denis Villeneuve") and poster together. Runtime, director or studio,
// genres and platforms come from Wikidata, fetched only for what you actually add.

// Wikimedia asks apps to say who they are; browsers can't set User-Agent, so this header is the way.
const WIKI_HEADERS = { 'Api-User-Agent': "Milk's Watch Tracker (https://milkneggs.github.io/milkswatchtracker/)" };

interface WikiPage {
  title: string;
  index: number;
  description?: string;
  thumbnail?: { source: string };
  pageprops?: { wikibase_item?: string };
}

/** "Arrival (film)" → "Arrival", "Hades (video game)" → "Hades", "Dune (2021 film)" → "Dune". */
const cleanTitle = (t: string) => t.replace(/\s*\((?:\d{4}\s+)?(?:[\w\s-]*\s)?(?:film|video game|game)\)$/i, '');

async function wikipedia(type: 'movie' | 'game', q: string, signal?: AbortSignal): Promise<LookupResult[]> {
  const infobox = type === 'movie' ? 'Infobox film' : 'Infobox video game';
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    generator: 'search',
    gsrsearch: `${q} hastemplate:"${infobox}"`,
    gsrlimit: '12',
    prop: 'description|pageimages|pageprops',
    piprop: 'thumbnail',
    pithumbsize: '320',
    // Posters and box art are non-free images, which Wikipedia leaves out unless asked.
    pilicense: 'any',
    ppprop: 'wikibase_item',
  });
  const r = await getJson<{ query?: { pages: WikiPage[] } }>(`https://en.wikipedia.org/w/api.php?${params}`, { signal, headers: WIKI_HEADERS });
  return (r.query?.pages ?? [])
    .sort((a, b) => a.index - b.index)
    .map((p) => {
      const desc = p.description ?? '';
      const year = Number(desc.match(/^(\d{4})\b/)?.[1]) || undefined;
      const by = type === 'movie' ? desc.match(/\bfilm by (.+)$/)?.[1] : undefined;
      return {
        title: cleanTitle(p.title),
        year,
        by,
        cover: p.thumbnail?.source.replace(/\?utm_.*$/, ''),
        genres: [],
        sub: desc,
        ext: { src: 'wikipedia', id: p.pageprops?.wikibase_item ?? p.title, page: p.title, qid: p.pageprops?.wikibase_item, fetchedAt: Date.now() },
      } satisfies LookupResult;
    });
}

interface WdClaim {
  mainsnak: { datavalue?: { value: unknown } };
  rank?: string;
}
type WdEntity = { claims?: Record<string, WdClaim[]>; labels?: { en?: { value: string } } };

export interface WikiDetails {
  ext: External;
  /** Director(s) for movies, developer(s) for games. */
  by?: string;
  genres: string[];
}

/** Runtime, director or developer, genres and platforms from Wikidata. */
export async function wikiDetails(ext: External): Promise<WikiDetails> {
  if (!ext.qid) return { ext, genres: [] };
  const base = 'https://www.wikidata.org/w/api.php?format=json&origin=*&action=wbgetentities&languages=en';
  const r = await getJson<{ entities: Record<string, WdEntity> }>(`${base}&props=claims&ids=${ext.qid}`, { headers: WIKI_HEADERS });
  const claims = r.entities[ext.qid]?.claims ?? {};
  const values = (p: string) => (claims[p] ?? []).filter((c) => c.rank !== 'deprecated').map((c) => c.mainsnak.datavalue?.value);
  const ids = (p: string, n: number) =>
    values(p)
      .map((v) => (v as { id?: string } | undefined)?.id)
      .filter((x): x is string => !!x)
      .slice(0, n);

  // Runtime: an amount with a unit (minutes, or now and then hours).
  let runtime: number | undefined;
  const dur = values('P2047')[0] as { amount?: string; unit?: string } | undefined;
  if (dur?.amount) {
    const n = Math.abs(Number(dur.amount));
    runtime = dur.unit?.endsWith('/Q25235') ? Math.round(n * 60) : Math.round(n);
  }

  const people = [...ids('P57', 2), ...ids('P178', 2)];
  const genreIds = ids('P136', 4);
  const platformIds = ids('P400', 8);
  const all = [...new Set([...people, ...genreIds, ...platformIds])];
  const labels: Record<string, string> = {};
  if (all.length) {
    const l = await getJson<{ entities: Record<string, WdEntity> }>(`${base}&props=labels&ids=${all.join('|')}`, { headers: WIKI_HEADERS });
    for (const [id, e] of Object.entries(l.entities)) if (e.labels?.en) labels[id] = e.labels.en.value;
  }
  const label = (id: string) => labels[id];
  // Genre labels read like "science fiction film" or "action role-playing game"; keep the genre part.
  const genres = genreIds
    .map(label)
    .filter(Boolean)
    .map((g) => g.replace(/\s+(film|video game|game)$/i, ''))
    .map((g) => g.charAt(0).toUpperCase() + g.slice(1));
  return {
    ext: { ...ext, runtime: runtime ?? ext.runtime, platforms: platformIds.map(label).filter(Boolean), fetchedAt: Date.now() },
    by: people.map(label).filter(Boolean).join(', ') || undefined,
    genres: [...new Set(genres)],
  };
}

// ---------------------------------------------------------------------------------------------
// TVmaze

interface TvShow {
  id: number;
  name: string;
  premiered?: string | null;
  genres?: string[];
  averageRuntime?: number | null;
  runtime?: number | null;
  status?: string;
  rating?: { average?: number | null };
  network?: { name: string } | null;
  webChannel?: { name: string } | null;
  image?: { medium?: string; original?: string } | null;
  _embedded?: { episodes?: { season: number; number: number | null }[]; nextepisode?: { airdate?: string } };
}

async function tvmaze(q: string, signal?: AbortSignal): Promise<LookupResult[]> {
  const rows = await getJson<{ show: TvShow }[]>(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`, { signal });
  return rows.map(({ show: s }) => {
    const network = s.webChannel?.name ?? s.network?.name;
    const ext: External = {
      src: 'tvmaze',
      id: String(s.id),
      rating: s.rating?.average ?? undefined,
      runtime: s.averageRuntime ?? s.runtime ?? undefined,
      network,
      fetchedAt: Date.now(),
    };
    const year = yearOf(s.premiered);
    return {
      title: s.name,
      year,
      cover: s.image?.medium,
      genres: s.genres ?? [],
      sub: [year, network, s.status === 'Ended' ? 'Ended' : s.status === 'Running' ? 'Still airing' : s.status].filter(Boolean).join(' · '),
      ext,
    };
  });
}

async function tvmazeDetails(ext: External): Promise<External> {
  const s = await getJson<TvShow>(`https://api.tvmaze.com/shows/${ext.id}?embed[]=episodes&embed[]=nextepisode`);
  const counts: number[] = [];
  for (const e of s._embedded?.episodes ?? []) {
    if (e.number == null || e.season < 1) continue; // specials
    counts[e.season - 1] = (counts[e.season - 1] ?? 0) + 1;
  }
  return {
    ...ext,
    rating: s.rating?.average ?? ext.rating,
    runtime: s.averageRuntime ?? s.runtime ?? ext.runtime,
    network: s.webChannel?.name ?? s.network?.name ?? ext.network,
    seasons: Array.from(counts, (n) => n ?? 0),
    nextAir: s._embedded?.nextepisode?.airdate || undefined,
    fetchedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------------------------
// AniList (GraphQL)

interface AniMedia {
  id: number;
  title: { romaji?: string; english?: string | null };
  startDate?: { year?: number | null };
  coverImage?: { large?: string; medium?: string };
  averageScore?: number | null;
  popularity?: number | null;
  episodes?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  duration?: number | null;
  genres?: string[];
  format?: string | null;
  status?: string | null;
  staff?: { nodes?: { name?: { full?: string } }[] };
}

const ANI_FIELDS = `id title{romaji english} startDate{year} coverImage{large} averageScore popularity episodes chapters volumes duration genres format status`;

async function anilistQuery<T>(query: string, variables: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const r = await getJson<{ data: T }>('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal,
  });
  return r.data;
}

function aniExt(m: AniMedia): External {
  return {
    src: 'anilist',
    id: String(m.id),
    rating: m.averageScore != null ? m.averageScore / 10 : undefined,
    ratingCount: m.popularity ?? undefined,
    total: m.episodes ?? m.chapters ?? undefined,
    volumes: m.volumes ?? undefined,
    runtime: m.duration ?? undefined,
    fetchedAt: Date.now(),
  };
}

const FORMAT: Record<string, string> = { TV: 'TV', TV_SHORT: 'Short', MOVIE: 'Movie', OVA: 'OVA', ONA: 'ONA', SPECIAL: 'Special', MANGA: 'Manga', NOVEL: 'Light novel', ONE_SHOT: 'One-shot' };

async function anilist(type: 'anime' | 'manga', q: string, signal?: AbortSignal): Promise<LookupResult[]> {
  const data = await anilistQuery<{ Page: { media: AniMedia[] } }>(
    `query($s:String,$t:MediaType){Page(perPage:15){media(search:$s,type:$t,sort:SEARCH_MATCH){${ANI_FIELDS}}}}`,
    { s: q, t: type === 'anime' ? 'ANIME' : 'MANGA' },
    signal,
  );
  return data.Page.media.map((m) => {
    const ext = aniExt(m);
    const year = m.startDate?.year ?? undefined;
    const count =
      type === 'anime'
        ? m.episodes
          ? plural(m.episodes, 'ep')
          : ''
        : [m.volumes ? plural(m.volumes, 'vol') : '', m.chapters ? plural(m.chapters, 'ch') : ''].filter(Boolean).join(', ');
    return {
      title: m.title.english || m.title.romaji || '?',
      year,
      cover: m.coverImage?.large ?? m.coverImage?.medium,
      genres: m.genres ?? [],
      sub: [year, m.format ? FORMAT[m.format] ?? m.format : '', count, m.title.english && m.title.romaji !== m.title.english ? m.title.romaji : '']
        .filter(Boolean)
        .join(' · '),
      ext,
    };
  });
}

async function anilistById(ext: External): Promise<External> {
  const data = await anilistQuery<{ Media: AniMedia }>(`query($id:Int){Media(id:$id){${ANI_FIELDS}}}`, { id: Number(ext.id) });
  const fresh = aniExt(data.Media);
  return { ...ext, ...Object.fromEntries(Object.entries(fresh).filter(([, v]) => v !== undefined)) };
}

// ---------------------------------------------------------------------------------------------
// Open Library

interface OlDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  number_of_pages_median?: number;
  ratings_average?: number;
  ratings_count?: number;
  subject?: string[];
}

async function openLibrary(q: string, signal?: AbortSignal): Promise<LookupResult[]> {
  const fields = 'key,title,author_name,first_publish_year,cover_i,number_of_pages_median,ratings_average,ratings_count,subject';
  const r = await getJson<{ docs: OlDoc[] }>(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=15&fields=${fields}`,
    { signal },
  );
  return r.docs.map((b) => {
    const by = b.author_name?.slice(0, 2).join(', ');
    return {
      title: b.title,
      year: b.first_publish_year,
      by,
      cover: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : undefined,
      // Open Library subjects are noisy; keep a few short, plain ones.
      genres: (b.subject ?? []).filter((s) => s.length < 22 && !/[:=,(]/.test(s)).slice(0, 4),
      sub: [b.first_publish_year, by, b.number_of_pages_median ? `${b.number_of_pages_median} pages` : ''].filter(Boolean).join(' · '),
      ext: {
        src: 'openlibrary',
        id: b.key,
        rating: b.ratings_average && b.ratings_count && b.ratings_count >= 3 ? round1(b.ratings_average * 2) : undefined,
        ratingCount: b.ratings_count,
        total: b.number_of_pages_median,
        fetchedAt: Date.now(),
      },
    };
  });
}

/** A web page for the item on its source site. */
export function sourceUrl(ext: External, type: MediaType): string {
  if (ext.src === 'tvmaze') return `https://www.tvmaze.com/shows/${ext.id}`;
  if (ext.src === 'anilist') return `https://anilist.co/${type === 'anime' ? 'anime' : 'manga'}/${ext.id}`;
  if (ext.src === 'wikipedia') return `https://en.wikipedia.org/wiki/${encodeURIComponent((ext.page ?? ext.id).replace(/ /g, '_'))}`;
  return `https://openlibrary.org${ext.id}`;
}
