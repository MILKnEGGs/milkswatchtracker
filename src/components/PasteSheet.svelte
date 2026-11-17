<script lang="ts">
  import { decodeShare, findSame, itemFromShare, uid, type Share } from '../lib/data';
  import { app, go, save, toast } from '../lib/store.svelte';
  import Cover from './Cover.svelte';
  import Sheet from './Sheet.svelte';
  import TypeTag from './TypeTag.svelte';

  let { onclose }: { onclose: () => void } = $props();

  let text = $state('');
  let share = $state<Share>();
  let checked = $state<boolean[]>([]);
  let asList = $state(true);
  let from = $state('');

  async function fromClipboard() {
    try {
      text = await navigator.clipboard.readText();
      read();
    } catch {
      toast('Long-press the box and tap Paste.');
    }
  }

  function read() {
    share = decodeShare(text);
    if (share) {
      checked = share.items.map((si) => !findSame(app.d, si));
      from = share.from ?? '';
    }
  }

  function add() {
    if (!share) return;
    const who = from.trim() || undefined;
    const ids: string[] = [];
    let added = 0;
    share.items.forEach((si, i) => {
      const same = findSame(app.d, si);
      if (same) {
        ids.push(same.id);
        return;
      }
      if (!checked[i]) return;
      const it = itemFromShare(app.d, si, who);
      app.d.items.push(it);
      ids.push(it.id);
      added++;
    });
    let listId: string | undefined;
    if (share.list && asList) {
      listId = uid();
      app.d.lists.push({ id: listId, name: share.list.name, emoji: share.list.emoji, items: ids, createdAt: Date.now() });
    }
    save();
    onclose();
    toast(added ? `Added ${added} to your want list${listId ? ' and a new list' : ''} ✓` : listId ? 'List added ✓' : 'You already have all of these');
    if (listId) go('l/' + listId);
    else if (share.items.length === 1 && ids[0]) go('i/' + ids[0]);
  }
</script>

<Sheet {onclose} label="Paste a recommendation" full>
  <div class="stack">
    <h2>📋 Paste a recommendation</h2>
    {#if !share}
      <p class="muted small" style="margin:0">
        Someone sent you something from Milk's Watch Tracker? Copy their <strong>whole message</strong> and paste it here.
      </p>
      <button class="btn primary block" onclick={fromClipboard}>📋 Paste from clipboard</button>
      <textarea class="input" rows="5" placeholder="…or paste here (the part starting with MWT:)" bind:value={text} oninput={read}></textarea>
      {#if text.trim() && !share}
        <p class="muted small">That doesn't have a Watch Tracker code in it. Make sure the part starting with <strong>MWT:</strong> got copied too.</p>
      {/if}
    {:else}
      <p style="margin:0">
        {#if share.list}<strong>{share.list.emoji} {share.list.name}</strong>:{/if}
        {share.items.length} thing{share.items.length === 1 ? '' : 's'}
        {#if share.from}from <strong>{share.from}</strong>{/if}
      </p>
      <div class="rows">
        {#each share.items as si, i (i)}
          {@const same = findSame(app.d, si)}
          <label class="result" class:faded={!!same}>
            <input type="checkbox" bind:checked={checked[i]} disabled={!!same} />
            <Cover src={si.c} type={si.ty} title={si.t} size={40} />
            <span class="item-text">
              <strong class="item-title">{si.t}</strong>
              <span class="item-meta"><TypeTag type={si.ty} /> {si.y ?? ''}</span>
              {#if si.n}<span class="item-meta small">“{si.n}”</span>{/if}
              {#if same}<span class="item-meta small">✓ Already in your library</span>{/if}
            </span>
          </label>
        {/each}
      </div>
      <label class="field">
        <span>Recommended by</span>
        <input class="input" bind:value={from} placeholder="Name (optional)" />
      </label>
      {#if share.list}
        <label class="toggle">
          <input type="checkbox" bind:checked={asList} />
          <span><strong>Also add it as a list</strong><span class="muted small">Keeps their order as “{share.list.name}”.</span></span>
        </label>
      {/if}
      <div class="row">
        <button class="btn primary" style="flex:1" onclick={add}>Add to my want list</button>
        <button class="btn ghost" onclick={() => ((share = undefined), (text = ''))}>Back</button>
      </div>
    {/if}
  </div>
</Sheet>
