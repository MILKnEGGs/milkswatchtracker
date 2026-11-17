// Saved data shapes. Everything is one record in IndexedDB (see db.ts) and in the JSON backup.

export type ThemeMode = 'auto' | 'light' | 'dark';

export type MediaType = 'tv' | 'anime' | 'movie' | 'book' | 'manga' | 'comic' | 'game';

/** want → active → done, with hold and dropped on the side. Labels depend on the type ("Watching", "Reading"...). */
export type Status = 'want' | 'active' | 'hold' | 'done' | 'dropped';

/** Unit for books, manga and comics. Optional: most people only use status. */
export type ReadUnit = 'chapter' | 'volume' | 'page' | 'percent';

export interface Progress {
  /** TV and anime. Anime usually has no seasons (each season is its own entry on AniList). */
  season?: number;
  episode?: number;
  /** Books, manga, comics. */
  unit?: ReadUnit;
  n?: number;
  /** Games. */
  hours?: number;
  pct?: number;
  /** Free text "where I am", any type ("Chapter 4, after the bridge"). */
  note?: string;
}

export type Source = 'tvmaze' | 'anilist' | 'openlibrary';

export interface External {
  src: Source;
  id: string;
  /** Average rating out of 10 (converted from the source's scale). */
  rating?: number;
  ratingCount?: number;
  /** TV: episodes in each season, index 0 = season 1. */
  seasons?: number[];
  /** Anime episodes, manga chapters, book pages. */
  total?: number;
  volumes?: number;
  /** Minutes per episode or movie. */
  runtime?: number;
  /** Where it airs, from TVmaze ("Apple TV", "HBO"). */
  network?: string;
  /** Next episode air date (YYYY-MM-DD) from TVmaze, if one is scheduled. */
  nextAir?: string;
  fetchedAt: number;
}

export type LogKind = 'add' | 'start' | 'progress' | 'done' | 'drop' | 'hold' | 'again';

export interface LogEntry {
  at: number;
  kind: LogKind;
  /** Short text: "S2 E5", "Chapter 12", "Finished". */
  text: string;
  /** Progress steps merged into this line (quick +1 taps); 1 when missing. */
  n?: number;
}

export interface Item {
  id: string;
  type: MediaType;
  title: string;
  year?: number;
  /** Author, creator, developer: one line under the title. */
  by?: string;
  cover?: string;
  genres: string[];
  status: Status;
  /** Hand order inside a status. Lower comes first. */
  order: number;
  /** Service ids from settings.services. */
  where: string[];
  tags: string[];
  progress: Progress;
  /** Your rating out of 10 (shown as 5 stars with halves). */
  rating?: number;
  review: string;
  notes: string;
  /** Who recommended it (filled when added from a shared code). */
  from?: string;
  ext?: External;
  /** How many times finished (rewatches, rereads). */
  times: number;
  log: LogEntry[];
  addedAt: number;
  updatedAt: number;
  startedAt?: number;
  finishedAt?: number;
}

export interface CustomList {
  id: string;
  name: string;
  emoji: string;
  /** Item ids in hand order. */
  items: string[];
  createdAt: number;
}

export interface Service {
  id: string;
  name: string;
}

export interface Settings {
  theme: ThemeMode;
  /** Your name, put on recommendations you share. */
  name: string;
  /** Your services and platforms, in your order. */
  services: Service[];
}

export interface Data {
  version: 1;
  items: Item[];
  lists: CustomList[];
  settings: Settings;
}
