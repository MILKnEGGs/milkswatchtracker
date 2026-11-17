import { describe, expect, it } from 'vitest';
import {
  decodeShare,
  encodeShare,
  findSame,
  itemFromShare,
  newData,
  newItem,
  normalize,
  parseBackup,
  backupJson,
  pickPool,
  progressText,
  reorderShown,
  serviceForNetwork,
  setStatus,
  shareText,
  sortItems,
  step,
  yearStats,
} from './data';

describe('step (+1)', () => {
  it('rolls over to the next season using TVmaze season lengths', () => {
    const d = newData();
    const it = newItem(d, { type: 'tv', title: 'Show', ext: { src: 'tvmaze', id: '1', seasons: [2, 3], fetchedAt: 0 } });
    step(it);
    expect(it.progress).toMatchObject({ season: 1, episode: 1 });
    expect(it.status).toBe('active');
    step(it);
    const r = step(it);
    expect(it.progress).toMatchObject({ season: 2, episode: 1 });
    expect(r.reachedEnd).toBe(false);
    step(it);
    expect(step(it).reachedEnd).toBe(true);
    expect(progressText(it)).toBe('S2 · E3 of 3');
  });

  it('does not call it the end while a new episode is scheduled', () => {
    const d = newData();
    const it = newItem(d, { type: 'tv', title: 'Show', ext: { src: 'tvmaze', id: '1', seasons: [1], nextAir: '2099-01-01', fetchedAt: 0 } });
    expect(step(it).reachedEnd).toBe(false);
  });

  it('counts anime episodes against AniList totals', () => {
    const d = newData();
    const it = newItem(d, { type: 'anime', title: 'A', ext: { src: 'anilist', id: '2', total: 2, fetchedAt: 0 } });
    step(it);
    expect(progressText(it)).toBe('E1 of 2');
    expect(step(it).reachedEnd).toBe(true);
  });

  it('steps chapters for manga', () => {
    const d = newData();
    const it = newItem(d, { type: 'manga', title: 'M', progress: { unit: 'chapter', n: 9 } });
    step(it);
    expect(progressText(it)).toBe('Chapter 10');
  });

  it('collapses quick +1 taps into one log line', () => {
    const d = newData();
    const it = newItem(d, { type: 'tv', title: 'Show' });
    step(it);
    step(it);
    step(it);
    expect(it.log.filter((l) => l.kind === 'progress')).toHaveLength(1);
    expect(it.log.at(-1)!.text).toBe('E3');
    expect(yearStats({ ...d, items: [it] }, new Date().getFullYear()).episodes).toBe(3);
  });
});

describe('status', () => {
  it('counts finishes and restarts progress on a rewatch', () => {
    const d = newData();
    const it = newItem(d, { type: 'tv', title: 'Show', progress: { season: 3, episode: 8 } });
    setStatus(it, 'done', d);
    expect(it.times).toBe(1);
    setStatus(it, 'active', d);
    expect(it.progress).toEqual({ note: undefined });
    setStatus(it, 'done', d);
    expect(it.times).toBe(2);
    expect(yearStats({ ...d, items: [it] }, new Date().getFullYear()).finished).toHaveLength(1);
  });
});

describe('reorderShown', () => {
  it('reorders visible items without moving hidden ones', () => {
    const d = newData();
    const [a, b, c, hidden] = ['a', 'b', 'c', 'h'].map((t, i) => ({ ...newItem(d, { type: 'tv', title: t }), order: i * 10 }));
    // Hidden sits between b and c.
    hidden.order = 15;
    const shown = [a, b, c];
    reorderShown(shown, 2, 0);
    const all = sortItems([a, b, c, hidden], 'mine').map((i) => i.title);
    expect(all).toEqual(['c', 'a', 'h', 'b']);
  });
});

describe('share codes', () => {
  it('round-trips through the pasted message, including unicode', () => {
    const d = newData();
    d.settings.services.push({ id: 's1', name: 'Apple TV+' });
    const it = newItem(d, { type: 'anime', title: 'Sousou no Frieren — 葬送のフリーレン', where: ['s1'], rating: 9 });
    const share = { v: 1 as const, from: 'Milk', items: [{ t: it.title, ty: it.type, r: it.rating, w: ['Apple TV+'], n: 'So good' }] };
    const text = shareText(share);
    const back = decodeShare('blah\n' + text + '\nthanks');
    expect(back).toEqual(share);
    expect(encodeShare(share)).toMatch(/^MWT:[A-Za-z0-9_-]+$/);

    const other = newData();
    other.settings.services.push({ id: 'x', name: 'apple tv' });
    const got = itemFromShare(other, back!.items[0], back!.from);
    expect(got.where).toEqual(['x']);
    expect(got.from).toBe('Milk');
    expect(got.status).toBe('want');
    other.items.push(got);
    expect(findSame(other, back!.items[0])).toBe(got);
  });

  it('ignores text without a code', () => {
    expect(decodeShare('hello')).toBeUndefined();
    expect(decodeShare('MWT:!!!')).toBeUndefined();
  });
});

describe('services', () => {
  it('matches TVmaze network names loosely', () => {
    const d = newData();
    d.settings.services.push({ id: 'a', name: 'Apple TV' }, { id: 'n', name: 'Netflix' });
    expect(serviceForNetwork(d, 'Apple TV+')).toBe('a');
    expect(serviceForNetwork(d, 'Netflix')).toBe('n');
    expect(serviceForNetwork(d, 'HBO')).toBeUndefined();
    // Game platforms from Wikidata.
    d.settings.services.push({ id: 's', name: 'Switch' }, { id: 'p', name: 'PlayStation' }, { id: 'pc', name: 'PC' });
    expect(serviceForNetwork(d, 'Nintendo Switch')).toBe('s');
    expect(serviceForNetwork(d, 'PlayStation 5')).toBe('p');
    expect(serviceForNetwork(d, 'Microsoft Windows')).toBeUndefined();
  });
});

describe('pick', () => {
  it('draws only from the want list (and hold when asked) with filters', () => {
    const d = newData();
    const a = newItem(d, { type: 'tv', title: 'a', where: ['n'] });
    const b = newItem(d, { type: 'game', title: 'b', status: 'hold' });
    const c = newItem(d, { type: 'tv', title: 'c', status: 'active' });
    d.items.push(a, b, c);
    expect(pickPool(d, { types: [], where: [], tags: [], includeHold: false })).toEqual([a]);
    expect(pickPool(d, { types: ['game'], where: [], tags: [], includeHold: true })).toEqual([b]);
    expect(pickPool(d, { types: [], where: ['zzz'], tags: [], includeHold: true })).toEqual([]);
  });
});

describe('backup', () => {
  it('round-trips and rejects other files', () => {
    const d = newData();
    d.items.push(newItem(d, { type: 'book', title: 'Dune' }));
    d.lists.push({ id: 'l', name: 'L', emoji: '📋', items: [d.items[0].id, 'gone'], createdAt: 1 });
    const back = parseBackup(backupJson(d));
    expect(back.items[0].title).toBe('Dune');
    expect(back.lists[0].items).toEqual([d.items[0].id]);
    expect(() => parseBackup('{"items":[]}')).toThrow();
    expect(normalize(undefined).settings.theme).toBe('dark');
  });
});
