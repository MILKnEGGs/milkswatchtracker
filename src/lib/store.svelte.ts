// App state: the saved data, the hash route, saving and toasts.

import { newData, normalize } from './data';
import { loadData, saveData } from './db';
import type { CustomList, Data, Item } from './types';

export const app = $state<{ d: Data; loaded: boolean }>({ d: newData(), loaded: false });

export async function load(): Promise<void> {
  const stored = await loadData();
  if (stored) app.d = normalize(stored);
  app.loaded = true;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Saves soon; debounced so typing in a field doesn't write on every keystroke. */
export function save(): void {
  clearTimeout(timer);
  timer = setTimeout(() => saveData(app.d).catch((err) => alert('Could not save: ' + err)), 150);
}

/** Replaces everything (backup import, erase). */
export async function replaceData(d: Data): Promise<void> {
  clearTimeout(timer);
  app.d = d;
  await saveData(d);
}

// Write any pending change before the app is closed or sent to the background.
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && timer) {
    clearTimeout(timer);
    timer = undefined;
    saveData(app.d).catch(() => {});
  }
});

export const itemById = (id: string | undefined): Item | undefined => app.d.items.find((i) => i.id === id);
export const listById = (id: string | undefined): CustomList | undefined => app.d.lists.find((l) => l.id === id);
export const serviceName = (id: string): string => app.d.settings.services.find((s) => s.id === id)?.name ?? '';

// ---------------------------------------------------------------------------------------------
// Routing

export interface Route {
  page: 'next' | 'library' | 'lists' | 'list' | 'item' | 'history' | 'settings' | 'install';
  arg?: string;
}

const PAGES: Record<string, Route['page']> = {
  library: 'library',
  lists: 'lists',
  l: 'list',
  i: 'item',
  history: 'history',
  settings: 'settings',
  install: 'install',
};

function parse(hash: string): Route {
  const [page, arg] = hash.replace(/^#\/?/, '').split('/');
  return { page: PAGES[page] ?? 'next', arg: arg ? decodeURIComponent(arg) : undefined };
}

export const router = $state({ route: parse(location.hash) });

addEventListener('hashchange', () => {
  router.route = parse(location.hash);
  scrollTo(0, 0);
});

export function go(path: string, replace = false): void {
  if (replace) {
    history.replaceState(null, '', '#/' + path);
    router.route = parse(location.hash);
    scrollTo(0, 0);
  } else location.hash = '#/' + path;
}

export function back(fallback = ''): void {
  if (history.length > 1) history.back();
  else go(fallback);
}

// ---------------------------------------------------------------------------------------------
// Toasts

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

export const toasts = $state<Toast[]>([]);
let toastId = 0;

export function toast(text: string, action?: Toast['action'], ms = 5000): number {
  const t = { id: ++toastId, text, action };
  toasts.push(t);
  setTimeout(() => dismissToast(t.id), ms);
  return t.id;
}

export function dismissToast(id: number): void {
  const i = toasts.findIndex((t) => t.id === id);
  if (i >= 0) toasts.splice(i, 1);
}

export const isStandalone =
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

// ---------------------------------------------------------------------------------------------
// Library filters, kept while the app is open so coming back from an item keeps your place.

import type { MediaType, Status } from './types';
import type { SortKey } from './data';

export const libView = $state<{ type: MediaType | ''; status: Status | ''; sort: SortKey; q: string; where: string }>({
  type: '',
  status: '',
  sort: 'mine',
  q: '',
  where: '',
});
