<script lang="ts">
  import AddSheet from '../components/AddSheet.svelte';
  import Icon from '../components/Icon.svelte';
  import ItemRow from '../components/ItemRow.svelte';
  import PickSheet from '../components/PickSheet.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { stepItem } from '../lib/actions';
  import { primeKeyboard } from '../lib/keyboard';
  import { reorderShown, sortItems, TYPE_KEYS, TYPES } from '../lib/data';
  import { sortable } from '../lib/sortable';
  import { app, save } from '../lib/store.svelte';
  import type { MediaType } from '../lib/types';

  let adding = $state(false);
  let picking = $state(false);
  let showHold = $state(false);
  let filter = $state<MediaType | ''>('');

  const active = $derived(sortItems(app.d.items.filter((i) => i.status === 'active' && (!filter || i.type === filter)), 'mine'));
  const hold = $derived(sortItems(app.d.items.filter((i) => i.status === 'hold' && (!filter || i.type === filter)), 'mine'));
  const wantCount = $derived(app.d.items.filter((i) => i.status === 'want').length);
  const activeTypes = $derived(TYPE_KEYS.filter((t) => app.d.items.some((i) => i.status === 'active' && i.type === t)));

  // New-episode hints from TVmaze: a scheduled episode whose date has passed since the last refresh.
  const today = new Date().toISOString().slice(0, 10);
  const aired = (id: string) => {
    const it = app.d.items.find((i) => i.id === id);
    return !!it?.ext?.nextAir && it.ext.nextAir <= today;
  };
</script>

<TopBar title="Up Next" sub={active.length ? `${active.length} in progress` : undefined}>
  <button class="icon-btn" aria-label="Pick something for me" onclick={() => (picking = true)}><Icon name="dice" /></button>
</TopBar>

<main class="page stack">
  {#if !app.d.items.length}
    <div class="empty">
      <span class="big-emoji">🍿</span>
      <h2>Welcome to movie night</h2>
      <p class="muted">Add the shows, movies, books, manga, comics and games you want to get to. Keep track of where to find them and how far you are.</p>
      <button class="btn primary" onclick={() => (primeKeyboard(), (adding = true))}><Icon name="plus" /> Add your first one</button>
    </div>
  {:else}
    {#if activeTypes.length > 1}
      <div class="chips scroll">
        <button class="chip" class:on={!filter} onclick={() => (filter = '')}>All</button>
        {#each activeTypes as t (t)}
          <button class="chip type-chip" data-type={t} class:on={filter === t} onclick={() => (filter = filter === t ? '' : t)}>{TYPES[t].emoji} {TYPES[t].plural}</button>
        {/each}
      </div>
    {/if}

    {#if active.length}
      <div class="rows" use:sortable={{ onmove: (a, b) => (reorderShown(active, a, b), save()) }}>
        {#each active as it (it.id)}
          <div data-sort class="row-wrap">
            {#if aired(it.id)}<span class="new-badge">New episode</span>{/if}
            <ItemRow item={it} onstep={stepItem} handle={active.length > 1} />
          </div>
        {/each}
      </div>
    {:else}
      <div class="card empty" style="padding:28px 16px">
        <span class="big-emoji">🛋️</span>
        <p class="muted">Nothing in progress{filter ? ` for ${TYPES[filter].plural}` : ''}. Start something from your library or let the dice choose.</p>
        <div class="row" style="justify-content:center">
          {#if wantCount}<button class="btn primary" onclick={() => (picking = true)}><Icon name="dice" /> Pick for me</button>{/if}
          <a class="btn" href="#/library">Library</a>
        </div>
      </div>
    {/if}

    {#if active.length && wantCount}
      <button class="btn block pick-btn" onclick={() => (picking = true)}>🎲 Can't decide? Pick for me</button>
    {/if}

    {#if hold.length}
      <button class="section-toggle" onclick={() => (showHold = !showHold)} aria-expanded={showHold}>
        ⏸️ On hold <span class="count">{hold.length}</span><span class="spacer"></span><span class="chev" class:open={showHold}>›</span>
      </button>
      {#if showHold}
        <div class="rows">
          {#each hold as it (it.id)}<ItemRow item={it} />{/each}
        </div>
      {/if}
    {/if}
  {/if}
</main>

{#if app.d.items.length}
  <button class="fab" onclick={() => (primeKeyboard(), (adding = true))}><Icon name="plus" /> Add</button>
{/if}

{#if adding}<AddSheet onclose={() => (adding = false)} />{/if}
{#if picking}<PickSheet onclose={() => (picking = false)} />{/if}
