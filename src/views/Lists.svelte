<script lang="ts">
  import Cover from '../components/Cover.svelte';
  import Icon from '../components/Icon.svelte';
  import ListEditSheet from '../components/ListEditSheet.svelte';
  import PasteSheet from '../components/PasteSheet.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { move } from '../lib/data';
  import { sortable } from '../lib/sortable';
  import { app, itemById, save } from '../lib/store.svelte';
  import type { Item } from '../lib/types';

  let making = $state(false);
  let pasting = $state(false);

  const preview = (ids: string[]) => ids.map(itemById).filter((i): i is Item => !!i).slice(0, 4);
  const leftCount = (ids: string[]) => ids.map(itemById).filter((i) => i && i.status !== 'done' && i.status !== 'dropped').length;
</script>

<TopBar title="Lists">
  <button class="icon-btn" aria-label="Paste a shared list" onclick={() => (pasting = true)}><Icon name="paste" /></button>
</TopBar>

<main class="page stack">
  {#if !app.d.lists.length}
    <div class="empty">
      <span class="big-emoji">📋</span>
      <h2>Your own lists</h2>
      <p class="muted">
        Group things however you like, in your own order: “With my wife”, “Spooky season”, “Games for the trip”. One thing can be on many lists.
      </p>
      <button class="btn primary" onclick={() => (making = true)}><Icon name="plus" /> Make a list</button>
    </div>
  {:else}
    <div class="rows" use:sortable={{ onmove: (a, b) => (move(app.d.lists, a, b), save()) }}>
      {#each app.d.lists as l (l.id)}
        <div data-sort class="list-row">
          <a href="#/l/{l.id}" class="list-main">
            <span class="list-emoji">{l.emoji}</span>
            <span class="item-text">
              <strong class="item-title">{l.name}</strong>
              <span class="item-meta">{l.items.length} thing{l.items.length === 1 ? '' : 's'}{l.items.length ? ` · ${leftCount(l.items)} to go` : ''}</span>
            </span>
            <span class="covers-peek">
              {#each preview(l.items) as it (it.id)}<Cover src={it.cover} type={it.type} size={26} />{/each}
            </span>
          </a>
          {#if app.d.lists.length > 1}<span class="handle" data-handle aria-label="Drag to reorder"><Icon name="grip" /></span>{/if}
        </div>
      {/each}
    </div>
  {/if}
</main>

{#if app.d.lists.length}
  <button class="fab" onclick={() => (making = true)}><Icon name="plus" /> New list</button>
{/if}
{#if making}<ListEditSheet onclose={() => (making = false)} />{/if}
{#if pasting}<PasteSheet onclose={() => (pasting = false)} />{/if}
