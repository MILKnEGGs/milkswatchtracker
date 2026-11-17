<script lang="ts">
  import { addNew, fillDetails, inLibrary, onList } from '../lib/actions';
  import { TYPES } from '../lib/data';
  import { canLookup, lookup, LOOKUP_FOR, type LookupResult } from '../lib/lookup';
  import { app, save, toast } from '../lib/store.svelte';
  import type { Item, MediaType, Status } from '../lib/types';
  import Cover from './Cover.svelte';

  // Several titles at once: one per line, looked up one by one, checked over, then added together.
  let { type, status, listId, ondone }: { type: MediaType; status: Status; listId?: string; ondone: () => void } = $props();

  interface Row {
    line: string;
    results: LookupResult[];
    /** Index into results, or -1 for "just the title, by hand". */
    choice: number;
    include: boolean;
    state: 'waiting' | 'done' | 'failed';
  }

  let text = $state('');
  let rows = $state<Row[]>([]);
  let looking = $state(false);
  let stopped = false;

  /** Titles from the box: bullets and numbering ("1.", "-", "•") are dropped, repeats skipped. */
  const lines = $derived.by(() => {
    const seen = new Set<string>();
    return text
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '').trim())
      .filter((l) => l && !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase()));
  });

  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const chosen = (r: Row): LookupResult | undefined => (r.choice >= 0 ? r.results[r.choice] : undefined);
  const haveFor = (r: Row): Item | undefined => {
    const c = chosen(r);
    return c ? inLibrary(c) : app.d.items.find((i) => i.type === type && norm(i.title) === norm(r.line));
  };
  const count = $derived(rows.filter((r) => r.include).length);
  const progress = $derived(rows.filter((r) => r.state !== 'waiting').length);

  async function start() {
    rows = lines.map((line) => ({ line, results: [], choice: -1, include: true, state: canLookup(type) ? 'waiting' : 'done' }));
    for (const r of rows) r.include = !haveFor(r);
    if (!canLookup(type)) return;
    looking = true;
    stopped = false;
    for (const r of rows) {
      if (stopped) break;
      try {
        r.results = (await lookup(type, r.line)).slice(0, 6);
        // Best match: same title, else the first result.
        const exact = r.results.findIndex((x) => norm(x.title) === norm(r.line));
        r.choice = r.results.length ? Math.max(exact, 0) : -1;
        r.state = 'done';
      } catch {
        r.state = 'failed';
      }
      r.include = !haveFor(r);
      // Be gentle with the free lookup sites.
      await new Promise((res) => setTimeout(res, 250));
    }
    looking = false;
  }

  function addAll() {
    const added: Item[] = [];
    let listed = 0;
    for (const r of rows) {
      if (!r.include) continue;
      const have = haveFor(r);
      if (have) {
        onList(have, listId);
        listed++;
        continue;
      }
      added.push(addNew(type, chosen(r) ?? r.line, status, listId));
    }
    save();
    void fillDetails(added.map((i) => i.id));
    toast(`Added ${added.length} ${added.length === 1 ? TYPES[type].label.toLowerCase() : TYPES[type].noun}${listed ? `, put ${listed} you had on the list` : ''} ✓`);
    ondone();
  }

  function back() {
    stopped = true;
    looking = false;
    rows = [];
  }
</script>

{#if !rows.length}
  <div class="stack" style="gap:10px">
    <textarea
      class="input quick-box"
      rows="7"
      bind:value={text}
      placeholder={`One ${TYPES[type].label.toLowerCase()} per line, e.g.\n${type === 'game' ? 'Hades\nStardew Valley' : type === 'book' || type === 'comic' ? 'Dune\nProject Hail Mary' : type === 'movie' ? 'Arrival\nPaddington 2' : 'Severance\nThe Bear'}`}
    ></textarea>
    <p class="muted small" style="margin:0">
      Paste a list from your notes or type them in. {canLookup(type) ? `Each one is looked up on ${LOOKUP_FOR[type]}, and you check the matches before anything is added.` : 'They are added by hand; fill in the details later if you like.'}
    </p>
    <button class="btn primary block big" disabled={!lines.length} onclick={() => (canLookup(type) ? start() : (start(), addAll()))}>
      {canLookup(type) ? `🔎 Look up ${lines.length || ''}` : `Add ${lines.length || ''}`}
    </button>
  </div>
{:else}
  <div class="stack" style="gap:8px">
    {#if looking}<p class="muted small center" style="margin:0">Looking up {progress + 1} of {rows.length}…</p>{/if}
    {#each rows as r, i (i)}
      {@const c = chosen(r)}
      {@const have = haveFor(r)}
      <div class="quick-row" class:off={!r.include}>
        <input type="checkbox" bind:checked={r.include} aria-label="Add {c?.title ?? r.line}" />
        <Cover src={c?.cover} {type} title={c?.title ?? r.line} size={40} />
        <div class="item-text">
          <strong class="item-title">{c?.title ?? r.line}</strong>
          {#if r.state === 'waiting'}
            <span class="item-meta">Looking up…</span>
          {:else}
            <span class="item-meta">
              {#if c}{c.sub}{:else if r.state === 'failed'}Lookup failed; adds by hand{:else if canLookup(type)}No match; adds by hand{:else}By hand{/if}
            </span>
            {#if have}<span class="item-meta small have-note">✓ Already in your library{listId ? '; it goes on the list' : ''}</span>{/if}
            {#if r.results.length}
              <select class="input slim quick-pick" bind:value={r.choice} onchange={() => (r.include = !haveFor(r))} aria-label="Match for {r.line}">
                {#each r.results as x, j (j)}<option value={j}>{x.title}{x.year ? ` (${x.year})` : ''}</option>{/each}
                <option value={-1}>Just “{r.line}”, by hand</option>
              </select>
            {/if}
          {/if}
        </div>
      </div>
    {/each}
  </div>
  <div class="quick-bar">
    <button class="btn ghost" onclick={back}>Back</button>
    <button class="btn primary" style="flex:1" disabled={!count || looking} onclick={addAll}>
      {looking ? 'Looking up…' : `Add ${count}`}
    </button>
  </div>
{/if}
