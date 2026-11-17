<script lang="ts">
  import { copyText } from '../lib/actions';
  import { shareItem, shareText, type Share } from '../lib/data';
  import { app, save, toast } from '../lib/store.svelte';
  import type { CustomList, Item } from '../lib/types';
  import Sheet from './Sheet.svelte';

  // Share one item (with an optional note) or a whole list, as readable text plus an MWT: code.
  let { onclose, items, list }: { onclose: () => void; items: Item[]; list?: CustomList } = $props();

  let note = $state('');
  let withRating = $state(true);
  const rated = $derived(items.some((i) => i.rating != null));

  const share = $derived<Share>({
    v: 1,
    from: app.d.settings.name.trim() || undefined,
    list: list ? { name: list.name, emoji: list.emoji } : undefined,
    items: items.map((it, i) => ({ ...shareItem(app.d, it, withRating), n: i === 0 && items.length === 1 && note.trim() ? note.trim() : undefined })),
  });
  const message = $derived(shareText(share));

  async function copy() {
    if (await copyText(message)) {
      toast('Copied ✓ Paste it into a text or email');
      onclose();
    } else toast("Couldn't copy. Long-press the text and copy it.");
  }

  async function send() {
    try {
      await navigator.share({ text: message });
      onclose();
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') copy();
    }
  }
</script>

<Sheet {onclose} label="Share" full>
  <div class="stack">
    <h2>{list ? `Share “${list.name}”` : `Recommend “${items[0]?.title}”`}</h2>
    {#if items.length === 1 && !list}
      <label class="field">
        <span>Add a note</span>
        <input class="input" bind:value={note} placeholder="You'd love the second season!" />
      </label>
    {/if}
    {#if rated}
      <label class="toggle">
        <input type="checkbox" bind:checked={withRating} />
        <span>Include my rating</span>
      </label>
    {/if}
    <label class="field">
      <span>Your name on it</span>
      <input class="input" bind:value={app.d.settings.name} oninput={save} placeholder="Optional" />
    </label>
    <pre class="share-preview">{message}</pre>
    <div class="row">
      <button class="btn primary" style="flex:1" onclick={copy}>📋 Copy message</button>
      {#if 'share' in navigator}<button class="btn" onclick={send}>Share…</button>{/if}
    </div>
    <p class="muted small" style="margin:0">
      They copy the whole message and tap <strong>Paste a recommendation</strong> in their Watch Tracker. Without the app, they can still read the titles.
    </p>
  </div>
</Sheet>
