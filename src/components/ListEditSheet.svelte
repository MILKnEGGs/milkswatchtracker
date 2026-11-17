<script lang="ts">
  import { uid } from '../lib/data';
  import { app, save, toast } from '../lib/store.svelte';
  import type { CustomList } from '../lib/types';
  import Sheet from './Sheet.svelte';

  // New list (optionally with one item in it already) or rename an existing one.
  let { onclose, list, addItem }: { onclose: () => void; list?: CustomList; addItem?: string } = $props();

  const EMOJI = ['📋', '🍿', '❤️', '👨‍👩‍👧', '🛋️', '🎃', '🎄', '☀️', '✈️', '🌙', '🔥', '😂', '😱', '🧠', '⭐', '🎯'];
  // svelte-ignore state_referenced_locally
  let name = $state(list?.name ?? '');
  // svelte-ignore state_referenced_locally
  let emoji = $state(list?.emoji ?? '📋');

  function done(e: SubmitEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (list) {
      list.name = n;
      list.emoji = emoji;
    } else {
      app.d.lists.push({ id: uid(), name: n, emoji, items: addItem ? [addItem] : [], createdAt: Date.now() });
      toast(`Made “${n}”`);
    }
    save();
    onclose();
  }
</script>

<Sheet {onclose} label={list ? 'Rename list' : 'New list'}>
  <form class="stack" onsubmit={done}>
    <h2>{list ? 'Rename list' : 'New list'}</h2>
    <!-- svelte-ignore a11y_autofocus -->
    <input class="input" bind:value={name} placeholder="With my wife, Spooky season, Comfort shows…" required autofocus />
    <div class="emoji-grid">
      {#each EMOJI as e (e)}
        <button type="button" class:on={emoji === e} onclick={() => (emoji = e)} aria-label="Icon {e}">{e}</button>
      {/each}
    </div>
    <button class="btn primary block">{list ? 'Save' : 'Make list'}</button>
  </form>
</Sheet>
