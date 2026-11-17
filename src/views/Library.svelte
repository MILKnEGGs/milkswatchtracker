<script lang="ts">
  import AddSheet from '../components/AddSheet.svelte';
  import Icon from '../components/Icon.svelte';
  import ItemRow from '../components/ItemRow.svelte';
  import PasteSheet from '../components/PasteSheet.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { stepItem } from '../lib/actions';
  import { reorderShown, search, sortItems, STATUS_EMOJI, STATUSES, statusLabel, TYPE_KEYS, TYPES, type SortKey } from '../lib/data';
  import { sortable } from '../lib/sortable';
  import { app, libView as v, save } from '../lib/store.svelte';

  let adding = $state(false);
  let pasting = $state(false);

  const byType = $derived(v.type ? app.d.items.filter((i) => i.type === v.type) : app.d.items);
  const byWhere = $derived(v.where ? byType.filter((i) => i.where.includes(v.where)) : byType);
  const counts = $derived(Object.fromEntries(STATUSES.map((s) => [s, byWhere.filter((i) => i.status === s).length])));
  const shown = $derived(sortItems(search(v.status ? byWhere.filter((i) => i.status === v.status) : byWhere, v.q), v.sort));
  const typesHere = $derived(TYPE_KEYS.filter((t) => app.d.items.some((i) => i.type === t)));
  // Hand order lives inside a status, so dragging needs one status picked and no search.
  const canDrag = $derived(v.sort === 'mine' && !!v.status && !v.q.trim() && shown.length > 1);

  const SORTS: { key: SortKey; label: string }[] = [
    { key: 'mine', label: 'My order' },
    { key: 'title', label: 'Title A–Z' },
    { key: 'added', label: 'Newest added' },
    { key: 'updated', label: 'Recently active' },
    { key: 'rating', label: 'Rating' },
  ];
</script>

<TopBar title="Library" sub="{app.d.items.length} total">
  <button class="icon-btn" aria-label="Paste a recommendation" onclick={() => (pasting = true)}><Icon name="paste" /></button>
</TopBar>

<main class="page stack">
  <input class="input" type="search" placeholder="Search titles, tags, genres…" bind:value={v.q} aria-label="Search" />

  {#if typesHere.length > 1}
    <div class="chips scroll">
      <button class="chip" class:on={!v.type} onclick={() => (v.type = '')}>All</button>
      {#each typesHere as t (t)}
        <button class="chip type-chip" data-type={t} class:on={v.type === t} onclick={() => (v.type = v.type === t ? '' : t)}>{TYPES[t].emoji} {TYPES[t].plural}</button>
      {/each}
    </div>
  {/if}

  <div class="chips scroll">
    <button class="chip small-chip" class:on={!v.status} onclick={() => (v.status = '')}>Any status <span class="count">{byWhere.length}</span></button>
    {#each STATUSES as s (s)}
      {#if counts[s] || v.status === s}
        <button class="chip small-chip" class:on={v.status === s} onclick={() => (v.status = v.status === s ? '' : s)}>
          {STATUS_EMOJI[s]} {statusLabel(s, v.type || undefined)} <span class="count">{counts[s]}</span>
        </button>
      {/if}
    {/each}
  </div>

  <div class="row">
    {#if app.d.settings.services.length}
      <select class="input slim" style="flex:1" bind:value={v.where} aria-label="Where">
        <option value="">📍 Anywhere</option>
        {#each app.d.settings.services as s (s.id)}<option value={s.id}>📍 {s.name}</option>{/each}
      </select>
    {/if}
    <select class="input slim" style="flex:1" bind:value={v.sort} aria-label="Sort">
      {#each SORTS as s (s.key)}<option value={s.key}>↕ {s.label}</option>{/each}
    </select>
  </div>

  {#if !app.d.items.length}
    <div class="empty">
      <span class="big-emoji">📚</span>
      <p class="muted">Your library is empty. Add something, or paste a recommendation someone sent you.</p>
      <button class="btn primary" onclick={() => (adding = true)}><Icon name="plus" /> Add</button>
    </div>
  {:else if !shown.length}
    <p class="muted center">Nothing matches.</p>
  {:else}
    {#if v.sort === 'mine' && !v.status && shown.length > 1}
      <p class="muted small hint">Pick a status above to drag things into your own order.</p>
    {/if}
    <div class="rows" use:sortable={{ onmove: (a, b) => (reorderShown(shown, a, b), save()) }}>
      {#each shown as it (it.id)}
        <div data-sort>
          <ItemRow item={it} onstep={it.status === 'active' ? stepItem : undefined} handle={canDrag} showStatus={!v.status} showType={!v.type} />
        </div>
      {/each}
    </div>
  {/if}
</main>

<button class="fab" onclick={() => (adding = true)}><Icon name="plus" /> Add</button>

{#if adding}<AddSheet onclose={() => (adding = false)} type={v.type || undefined} status={v.status === 'active' ? 'active' : 'want'} />{/if}
{#if pasting}<PasteSheet onclose={() => (pasting = false)} />{/if}
