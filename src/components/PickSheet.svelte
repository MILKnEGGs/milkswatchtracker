<script lang="ts">
  import { changeStatus } from '../lib/actions';
  import { allTags, pickPool, TYPE_KEYS, TYPES, type PickFilter } from '../lib/data';
  import { app, go } from '../lib/store.svelte';
  import type { Item } from '../lib/types';
  import Cover from './Cover.svelte';
  import Sheet from './Sheet.svelte';
  import TypeTag from './TypeTag.svelte';

  let { onclose, listId }: { onclose: () => void; listId?: string } = $props();

  // svelte-ignore state_referenced_locally
  const f = $state<PickFilter>({ types: [], where: [], tags: [], listId, includeHold: false });
  let picked = $state<Item>();
  let spinning = $state(false);
  let seen: string[] = [];

  const pool = $derived(pickPool(app.d, f));
  const types = $derived(TYPE_KEYS.filter((t) => app.d.items.some((i) => i.type === t && (i.status === 'want' || i.status === 'hold'))));
  const tags = $derived(allTags(app.d));

  function toggle<T>(arr: T[], v: T) {
    const i = arr.indexOf(v);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(v);
    picked = undefined;
  }

  function roll() {
    if (!pool.length) return;
    // Don't show the same one twice in a row until the pool runs out.
    let fresh = pool.filter((i) => !seen.includes(i.id));
    if (!fresh.length) {
      seen = picked ? [picked.id] : [];
      fresh = pool.filter((i) => !seen.includes(i.id));
      if (!fresh.length) fresh = pool;
    }
    spinning = true;
    let n = 0;
    const tick = () => {
      picked = pool[Math.floor(Math.random() * pool.length)];
      if (++n < 8) setTimeout(tick, 40 + n * 12);
      else {
        picked = fresh[Math.floor(Math.random() * fresh.length)];
        seen.push(picked.id);
        spinning = false;
      }
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) n = 7;
    tick();
  }

  function start() {
    if (!picked) return;
    changeStatus(picked, 'active');
    onclose();
    go('i/' + picked.id);
  }
</script>

<Sheet {onclose} label="Pick something for me">
  <div class="stack">
    <h2>🎲 Pick something for me</h2>

    {#if types.length > 1}
      <div class="chips">
        {#each types as t (t)}
          <button class="chip type-chip" data-type={t} class:on={f.types.includes(t)} onclick={() => toggle(f.types, t)}>{TYPES[t].emoji} {TYPES[t].plural}</button>
        {/each}
      </div>
    {/if}
    {#if app.d.settings.services.length}
      <div class="chips">
        {#each app.d.settings.services as s (s.id)}
          <button class="chip small-chip" class:on={f.where.includes(s.id)} onclick={() => toggle(f.where, s.id)}>📍 {s.name}</button>
        {/each}
      </div>
    {/if}
    {#if tags.length}
      <div class="chips">
        {#each tags as t (t)}
          <button class="chip small-chip" class:on={f.tags.includes(t)} onclick={() => toggle(f.tags, t)}>#{t}</button>
        {/each}
      </div>
    {/if}
    <div class="row">
      {#if app.d.lists.length}
        <select
          class="input"
          style="flex:1;min-width:160px"
          value={f.listId ?? ''}
          onchange={(e) => ((f.listId = e.currentTarget.value || undefined), (picked = undefined))}
          aria-label="From a list"
        >
          <option value="">From everything</option>
          {#each app.d.lists as l (l.id)}<option value={l.id}>{l.emoji} {l.name}</option>{/each}
        </select>
      {/if}
      <label class="toggle" style="flex:1;min-width:160px">
        <input type="checkbox" bind:checked={f.includeHold} onchange={() => (picked = undefined)} />
        <span>Include on hold</span>
      </label>
    </div>

    {#if picked}
      <div class="pick-card" class:spinning>
        <Cover src={picked.cover} type={picked.type} title={picked.title} size={78} />
        <div class="item-text">
          <TypeTag type={picked.type} />
          <strong class="pick-title">{picked.title}</strong>
          <span class="item-meta">{[picked.year, picked.by].filter(Boolean).join(' · ')}</span>
          {#if picked.from}<span class="item-meta small">Recommended by {picked.from}</span>{/if}
        </div>
      </div>
      {#if !spinning}
        <div class="row">
          <button class="btn primary" style="flex:1;white-space:nowrap" onclick={start}>▶️ Start</button>
          <button class="btn" onclick={roll}>🎲 Another</button>
          <button class="btn ghost" onclick={() => (onclose(), go('i/' + picked!.id))}>Open</button>
        </div>
      {/if}
    {:else}
      <button class="btn primary block big" disabled={!pool.length} onclick={roll}>🎲 Roll ({pool.length} to choose from)</button>
      {#if !pool.length}<p class="muted small center">Nothing on your want list matches. Loosen the filters.</p>{/if}
    {/if}
  </div>
</Sheet>
