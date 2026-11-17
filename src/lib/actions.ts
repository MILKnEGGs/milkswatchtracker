// Actions shared by several screens: +1, status changes, deleting, with undo toasts.

import { newItem, serviceForNetwork, setStatus, statusLabel, step, TYPES } from './data';
import { refresh, type LookupResult } from './lookup';
import { app, dismissToast, save, toast, toasts } from './store.svelte';
import type { Item, MediaType, Status } from './types';

const snap = (it: Item): Item => JSON.parse(JSON.stringify(it));

function restore(it: Item, before: Item): void {
  const live = app.d.items.find((i) => i.id === it.id);
  if (live) Object.assign(live, before);
  save();
}

let stepToast = 0;
let stepBefore: { id: string; item: Item } | undefined;

export function stepItem(it: Item): void {
  // Tapping +1 several times replaces the toast, and Undo goes back to before the first tap.
  if (stepBefore?.id !== it.id || !toasts.some((t) => t.id === stepToast)) stepBefore = { id: it.id, item: snap(it) };
  const before = stepBefore.item;
  dismissToast(stepToast);
  const r = step(it);
  save();
  if (r.reachedEnd) {
    stepToast = toast(`${r.text}. That's the last one! 🎉`, { label: `Mark ${statusLabel('done', it.type).toLowerCase()}`, run: () => changeStatus(it, 'done') }, 8000);
  } else stepToast = toast(`${it.title}: ${r.text}`, { label: 'Undo', run: () => restore(it, before) }, 4000);
}

export function changeStatus(it: Item, s: Status): void {
  if (it.status === s) return;
  const before = snap(it);
  setStatus(it, s, app.d);
  save();
  const msg = s === 'done' ? `${TYPES[it.type].emoji} ${statusLabel('done', it.type)}! Rate it?` : `${statusLabel(s, it.type)}`;
  toast(msg, { label: 'Undo', run: () => restore(it, before) });
}

export function deleteItem(it: Item): void {
  const i = app.d.items.findIndex((x) => x.id === it.id);
  if (i < 0) return;
  const lists = app.d.lists.map((l) => ({ l, at: l.items.indexOf(it.id) })).filter((x) => x.at >= 0);
  const [removed] = app.d.items.splice(i, 1);
  for (const { l, at } of lists) l.items.splice(at, 1);
  save();
  toast(`Deleted “${it.title}”`, {
    label: 'Undo',
    run: () => {
      app.d.items.splice(i, 0, removed);
      for (const { l, at } of lists) l.items.splice(at, 0, removed.id);
      save();
    },
  });
}

/** The library item that came from this lookup result, if you already have it. */
export const inLibrary = (r: LookupResult): Item | undefined => app.d.items.find((i) => i.ext?.src === r.ext.src && i.ext.id === r.ext.id);

/**
 * Adds a new item (from a lookup result, or just a title) and puts it on a list if one is given.
 * Returns the new item. Doesn't save; the caller does, once for a batch.
 */
export function addNew(type: MediaType, from: LookupResult | string, status: Status, listId?: string): Item {
  const it =
    typeof from === 'string'
      ? newItem(app.d, { type, title: from, status })
      : newItem(app.d, {
          type,
          title: from.title,
          year: from.year,
          by: from.by,
          cover: from.cover,
          genres: from.genres,
          ext: from.ext,
          where: [serviceForNetwork(app.d, from.ext.network)].filter((x): x is string => !!x),
          status,
        });
  app.d.items.push(it);
  onList(it, listId);
  return it;
}

export function onList(it: Item, listId?: string): void {
  const list = app.d.lists.find((l) => l.id === listId);
  if (list && !list.items.includes(it.id)) list.items.push(it.id);
}

/** TV episode counts need a second request per show; fetch them one at a time after adding. */
export async function fillTvDetails(ids: string[]): Promise<void> {
  for (const id of ids) {
    const it = app.d.items.find((i) => i.id === id);
    if (it?.ext?.src !== 'tvmaze' || it.ext.seasons) continue;
    try {
      it.ext = await refresh(JSON.parse(JSON.stringify(it.ext)));
      save();
    } catch {
      return;
    }
  }
}

/** Writes text to the clipboard, falling back to a hidden textarea for older browsers. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
