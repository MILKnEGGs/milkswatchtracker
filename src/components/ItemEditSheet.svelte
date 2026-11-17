<script lang="ts">
  import { TYPE_KEYS, TYPES } from '../lib/data';
  import { save } from '../lib/store.svelte';
  import type { Item, MediaType } from '../lib/types';
  import Sheet from './Sheet.svelte';

  let { item, onclose }: { item: Item; onclose: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const f = $state({ title: item.title, type: item.type as MediaType, year: item.year?.toString() ?? '', by: item.by ?? '', cover: item.cover ?? '' });

  function done(e: SubmitEvent) {
    e.preventDefault();
    if (!f.title.trim()) return;
    item.title = f.title.trim();
    if (f.type !== item.type) {
      item.type = f.type;
      item.progress = { note: item.progress.note };
    }
    const y = Number(f.year);
    item.year = f.year.trim() && y > 0 ? Math.round(y) : undefined;
    item.by = f.by.trim() || undefined;
    item.cover = f.cover.trim() || undefined;
    item.updatedAt = Date.now();
    save();
    onclose();
  }
</script>

<Sheet {onclose} label="Edit details">
  <form class="stack" onsubmit={done}>
    <h2>Edit details</h2>
    <label class="field"><span>Title</span><input class="input" bind:value={f.title} required /></label>
    <div class="field">
      <span>Type</span>
      <div class="chips">
        {#each TYPE_KEYS as t (t)}
          <button type="button" class="chip small-chip type-chip" data-type={t} class:on={f.type === t} onclick={() => (f.type = t)}>{TYPES[t].emoji} {TYPES[t].label}</button>
        {/each}
      </div>
      {#if f.type !== item.type}<span class="muted small">Changing the type clears the episode/chapter count.</span>{/if}
    </div>
    <div class="row">
      <label class="field" style="flex:1"><span>Year</span><input class="input" bind:value={f.year} inputmode="numeric" placeholder="2024" /></label>
      <label class="field" style="flex:2"><span>{TYPES[f.type].verb === 'read' ? 'Author' : f.type === 'game' ? 'Studio' : 'By'}</span><input class="input" bind:value={f.by} placeholder="Optional" /></label>
    </div>
    <label class="field"><span>Cover picture link</span><input class="input" bind:value={f.cover} type="url" placeholder="https://… (optional)" /></label>
    <button class="btn primary block">Save</button>
  </form>
</Sheet>
