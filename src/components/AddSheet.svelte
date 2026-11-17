<script lang="ts">
  import { newItem, serviceForNetwork, TYPE_KEYS, TYPES } from '../lib/data';
  import { canLookup, lookup, LOOKUP_FOR, refresh, type LookupResult } from '../lib/lookup';
  import { app, go, listById, save, toast } from '../lib/store.svelte';
  import type { Item, MediaType, Status } from '../lib/types';
  import Cover from './Cover.svelte';
  import Sheet from './Sheet.svelte';

  let {
    onclose,
    type: startType,
    listId,
    status = 'want',
  }: { onclose: () => void; type?: MediaType; listId?: string; status?: Status } = $props();

  // svelte-ignore state_referenced_locally
  let type = $state<MediaType>(startType ?? lastType());
  let q = $state('');
  let results = $state<LookupResult[]>([]);
  let busy = $state(false);
  let error = $state('');
  let input = $state<HTMLInputElement>();
  let ctrl: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function lastType(): MediaType {
    try {
      const t = localStorage.getItem('mwt-add-type') as MediaType | null;
      if (t && t in TYPES) return t;
    } catch {}
    return 'tv';
  }

  function setType(t: MediaType) {
    type = t;
    try {
      localStorage.setItem('mwt-add-type', t);
    } catch {}
    results = [];
    error = '';
    run();
    input?.focus();
  }

  function run() {
    clearTimeout(timer);
    ctrl?.abort();
    const text = q.trim();
    if (!canLookup(type) || text.length < 2) {
      results = [];
      busy = false;
      return;
    }
    busy = true;
    timer = setTimeout(async () => {
      ctrl = new AbortController();
      try {
        results = await lookup(type, text, ctrl.signal);
        error = '';
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        error = navigator.onLine ? (err as Error).message : "You're offline, so there's no lookup. You can still add it by hand.";
        results = [];
      }
      busy = false;
    }, 350);
  }

  $effect(() => () => {
    clearTimeout(timer);
    ctrl?.abort();
  });

  const existing = (r: LookupResult): Item | undefined =>
    app.d.items.find((i) => i.ext?.src === r.ext.src && i.ext.id === r.ext.id);

  function finish(it: Item) {
    app.d.items.push(it);
    const list = listById(listId);
    if (list && !list.items.includes(it.id)) list.items.push(it.id);
    save();
    onclose();
    go('i/' + it.id);
    toast(`Added “${it.title}”${list ? ` to ${list.name}` : ''}`);
  }

  async function pick(r: LookupResult) {
    const have = existing(r);
    if (have) {
      const list = listById(listId);
      if (list && !list.items.includes(have.id)) {
        list.items.push(have.id);
        save();
        toast(`Added to ${list.name}`);
      }
      onclose();
      go('i/' + have.id);
      return;
    }
    const svc = serviceForNetwork(app.d, r.ext.network);
    const it = newItem(app.d, { type, title: r.title, year: r.year, by: r.by, cover: r.cover, genres: r.genres, ext: r.ext, where: svc ? [svc] : [], status });
    finish(it);
    // TV episode counts need a second request; fill them in after the item opens.
    if (r.ext.src === 'tvmaze') {
      try {
        const ext = await refresh(r.ext);
        const live = app.d.items.find((i) => i.id === it.id);
        if (live) {
          live.ext = ext;
          save();
        }
      } catch {}
    }
  }

  function addByHand() {
    const title = q.trim();
    if (!title) return input?.focus();
    finish(newItem(app.d, { type, title, status }));
  }
</script>

<Sheet {onclose} label="Add something" full>
  <div class="pinned stack" style="gap:10px">
    <h2>Add something</h2>
    <div class="chips scroll" role="radiogroup" aria-label="Type">
      {#each TYPE_KEYS as t (t)}
        <button class="chip type-chip" data-type={t} class:on={type === t} role="radio" aria-checked={type === t} onclick={() => setType(t)}>
          {TYPES[t].emoji} {TYPES[t].label}
        </button>
      {/each}
    </div>
    <form class="row" style="flex-wrap:nowrap" onsubmit={(e) => (e.preventDefault(), canLookup(type) ? run() : addByHand())}>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        bind:this={input}
        class="input"
        type="search"
        enterkeyhint={canLookup(type) ? 'search' : 'done'}
        placeholder={canLookup(type) ? `Search ${TYPES[type].noun} by title` : `${TYPES[type].label} title`}
        bind:value={q}
        oninput={run}
        autocomplete="off"
        autofocus
      />
    </form>
  </div>

  <div class="stack" style="gap:8px;margin-top:4px">
    {#if q.trim()}
      <button class="btn block" onclick={addByHand}>✍️ Add “{q.trim()}” by hand</button>
    {/if}

    {#if !canLookup(type)}
      <p class="muted small center">There's no free lookup for {TYPES[type].noun}, so type the title and add it by hand. You can fill in the rest after.</p>
    {:else if busy && !results.length}
      <p class="muted small center">Searching {LOOKUP_FOR[type]}…</p>
    {:else if error}
      <p class="muted small center">{error}</p>
    {:else if q.trim().length >= 2 && !results.length}
      <p class="muted small center">Nothing found on {LOOKUP_FOR[type]}. Try another spelling or add it by hand.</p>
    {/if}

    {#each results as r (r.ext.id)}
      {@const have = existing(r)}
      <button class="result" onclick={() => pick(r)}>
        <Cover src={r.cover} {type} title={r.title} size={44} />
        <span class="item-text">
          <strong class="item-title">{r.title}</strong>
          <span class="item-meta">{r.sub}</span>
          {#if r.ext.rating}<span class="item-meta small">★ {r.ext.rating.toFixed(1)} on {LOOKUP_FOR[type]}</span>{/if}
        </span>
        {#if have}<span class="have">✓ Have it</span>{/if}
      </button>
    {/each}

    {#if results.length}
      <p class="muted small center">Details from {LOOKUP_FOR[type]}. Only the title you typed is sent.</p>
    {/if}
  </div>
</Sheet>
