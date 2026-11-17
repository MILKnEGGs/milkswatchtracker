// Free lookups that need no account or API key. Only the title you type is sent.
//   TVmaze      TV shows: covers, ratings, network, episodes per season, next air date
//   AniList     anime and manga: covers, scores, episode/chapter/volume counts
//   Open Library books and comics: covers, authors, page counts, ratings
// Movies and games have no keyless source, so they are typed in by hand.

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
  return Promise.resolve([]);
}

/** Fetches the details a search doesn't give (TV episode counts) or that change (new seasons, scores). */
export async function refresh(ext: External): Promise<External> {
  if (ext.src === 'tvmaze') return tvmazeDetails(ext);
  if (ext.src === 'anilist') return anilistById(ext);
  return ext;
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
  return `https://openlibrary.org${ext.id}`;
}
