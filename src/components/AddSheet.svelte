<script lang="ts">
  import { addNew, fillTvDetails, inLibrary, onList } from '../lib/actions';
  import { TYPE_KEYS, TYPES } from '../lib/data';
  import { takeFocus } from '../lib/keyboard';
  import { canLookup, lookup, LOOKUP_FOR, type LookupResult } from '../lib/lookup';
  import { go, listById, save, toast } from '../lib/store.svelte';
  import type { MediaType, Status } from '../lib/types';
  import Cover from './Cover.svelte';
  import QuickList from './QuickList.svelte';
  import Sheet from './Sheet.svelte';

  let {
    onclose,
    type: startType,
    listId,
    status = 'want',
  }: { onclose: () => void; type?: MediaType; listId?: string; status?: Status } = $props();

  const remembered = (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const remember = (key: string, v: string) => {
    try {
      localStorage.setItem(key, v);
    } catch {}
  };

  // svelte-ignore state_referenced_locally
  let type = $state<MediaType>(startType ?? lastType());
  let mode = $state<'search' | 'list'>(remembered('mwt-add-mode') === 'list' ? 'list' : 'search');
  /** "Add several": the sheet stays open after each add, ready for the next title. */
  let several = $state(remembered('mwt-add-several') === '1');
  let added = $state<string[]>([]);
  let q = $state('');
  let results = $state<LookupResult[]>([]);
  let busy = $state(false);
  let error = $state('');
  let input = $state<HTMLInputElement>();
  let ctrl: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const list = $derived(listById(listId));

  function lastType(): MediaType {
    const t = remembered('mwt-add-type') as MediaType | null;
    return t && t in TYPES ? t : 'tv';
  }

  // Take the keyboard over from the stand-in field the Add button focused (see keyboard.ts).
  $effect(() => {
    if (mode === 'search' && input) takeFocus(input);
  });

  function setType(t: MediaType) {
    type = t;
    remember('mwt-add-type', t);
    results = [];
    error = '';
    run();
    if (mode === 'search') input?.focus();
  }

  function setMode(m: 'search' | 'list') {
    mode = m;
    remember('mwt-add-mode', m);
    if (m === 'search') input?.focus();
  }

  function setSeveral(on: boolean) {
    several = on;
    remember('mwt-add-several', on ? '1' : '0');
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

  /** After adding: either open the new item, or (adding several) clear the box for the next one. */
  function after(id: string, title: string, isNew: boolean) {
    save();
    if (several) {
      added.push(id);
      toast(isNew ? `Added “${title}”${list ? ` to ${list.name}` : ''}` : `“${title}” is on ${list?.name}`, undefined, 2500);
      q = '';
      results = [];
      input?.focus();
    } else {
      onclose();
      go('i/' + id);
      toast(isNew ? `Added “${title}”${list ? ` to ${list.name}` : ''}` : list ? `Added to ${list.name}` : 'Already in your library');
    }
  }

  function pick(r: LookupResult) {
    const have = inLibrary(r);
    if (have) {
      onList(have, listId);
      return after(have.id, have.title, false);
    }
    const it = addNew(type, r, status, listId);
    void fillTvDetails([it.id]);
    after(it.id, it.title, true);
  }

  function addByHand() {
    const title = q.trim();
    if (!title) return input?.focus();
    const it = addNew(type, title, status, listId);
    after(it.id, it.title, true);
  }
</script>

<Sheet {onclose} label="Add something" full>
  <div class="pinned stack" style="gap:10px">
    <div class="row" style="flex-wrap:nowrap">
      <h2>Add{list ? ` to ${list.name}` : ' something'}</h2>
      <span class="spacer"></span>
      {#if added.length}
        <span class="added-count">✓ {added.length} added</span>
        <button class="btn small primary" onclick={onclose}>Done</button>
      {/if}
    </div>
    <div class="seg mode-seg" role="tablist" aria-label="How to add">
      <button role="tab" aria-selected={mode === 'search'} class:on={mode === 'search'} onclick={() => setMode('search')}>🔎 Search</button>
      <button role="tab" aria-selected={mode === 'list'} class:on={mode === 'list'} onclick={() => setMode('list')}>📋 Quick list</button>
    </div>
    <div class="chips scroll" role="radiogroup" aria-label="Type">
      {#each TYPE_KEYS as t (t)}
        <button class="chip type-chip" data-type={t} class:on={type === t} role="radio" aria-checked={type === t} onclick={() => setType(t)}>
          {TYPES[t].emoji} {TYPES[t].label}
        </button>
      {/each}
    </div>
    {#if mode === 'search'}
      <form class="row" style="flex-wrap:nowrap" onsubmit={(e) => (e.preventDefault(), canLookup(type) ? run() : addByHand())}>
        <input
          bind:this={input}
          class="input"
          type="search"
          enterkeyhint={canLookup(type) ? 'search' : several ? 'next' : 'done'}
          placeholder={canLookup(type) ? `Search ${TYPES[type].noun} by title` : `${TYPES[type].label} title`}
          bind:value={q}
          oninput={run}
          autocomplete="off"
        />
      </form>
      <label class="toggle slim-toggle">
        <input type="checkbox" checked={several} onchange={(e) => setSeveral(e.currentTarget.checked)} />
        <span>Add several (stay here after each one)</span>
      </label>
    {/if}
  </div>

  {#if mode === 'list'}
    {#key type}
      <QuickList {type} {status} {listId} ondone={onclose} />
    {/key}
  {:else}
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
        {@const have = inLibrary(r)}
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
  {/if}
</Sheet>
