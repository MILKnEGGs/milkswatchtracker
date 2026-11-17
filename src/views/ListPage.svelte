<script lang="ts">
  import AddSheet from '../components/AddSheet.svelte';
  import Cover from '../components/Cover.svelte';
  import Icon from '../components/Icon.svelte';
  import ItemRow from '../components/ItemRow.svelte';
  import ListEditSheet from '../components/ListEditSheet.svelte';
  import PickSheet from '../components/PickSheet.svelte';
  import ShareSheet from '../components/ShareSheet.svelte';
  import Sheet from '../components/Sheet.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { stepItem } from '../lib/actions';
  import { primeKeyboard } from '../lib/keyboard';
  import { move, search, sortItems } from '../lib/data';
  import { sortable } from '../lib/sortable';
  import { app, back, itemById, listById, save, toast } from '../lib/store.svelte';
  import type { Item } from '../lib/types';

  let { id }: { id: string } = $props();
  const list = $derived(listById(id));
  const items = $derived(list ? list.items.map(itemById).filter((i): i is Item => !!i) : []);
  let hideDone = $state(false);
  const shown = $derived(hideDone ? items.filter((i) => i.status !== 'done' && i.status !== 'dropped') : items);

  let menu = $state(false);
  let renaming = $state(false);
  let sharing = $state(false);
  let picking = $state(false);
  let adding = $state(false);
  let addingNew = $state(false);
  let editMode = $state(false);
  let q = $state('');

  const library = $derived(sortItems(search(app.d.items, q), 'title'));

  function toggle(it: Item) {
    if (!list) return;
    const i = list.items.indexOf(it.id);
    if (i >= 0) list.items.splice(i, 1);
    else list.items.push(it.id);
    save();
  }

  function remove(it: Item) {
    const l = list;
    if (!l) return;
    const at = l.items.indexOf(it.id);
    l.items.splice(at, 1);
    save();
    toast(`Took “${it.title}” off the list`, { label: 'Undo', run: () => (l.items.splice(at, 0, it.id), save()) });
  }

  function onmove(a: number, b: number) {
    if (!list) return;
    // Positions among the shown rows → positions in the whole list (finished ones may be hidden).
    move(list.items, list.items.indexOf(shown[a].id), list.items.indexOf(shown[b].id));
    save();
  }

  function del() {
    if (!list) return;
    menu = false;
    if (!confirm(`Delete the list “${list.name}”? The things on it stay in your library.`)) return;
    const i = app.d.lists.indexOf(list);
    const [removed] = app.d.lists.splice(i, 1);
    save();
    back('lists');
    toast('List deleted', { label: 'Undo', run: () => (app.d.lists.splice(i, 0, removed), save()) });
  }
</script>

{#if !list}
  <TopBar title="Not found" showBack />
  <main class="page"><p class="muted">This list was deleted.</p></main>
{:else}
  <TopBar title="{list.emoji} {list.name}" sub="{items.length} thing{items.length === 1 ? '' : 's'}" showBack ontitle={() => (renaming = true)}>
    <button class="icon-btn" aria-label="Pick from this list" onclick={() => (picking = true)}><Icon name="dice" /></button>
    <button class="icon-btn" aria-label="More" onclick={() => (menu = true)}><Icon name="more" /></button>
  </TopBar>

  <main class="page stack">
    {#if !items.length}
      <div class="empty">
        <span class="big-emoji">{list.emoji}</span>
        <p class="muted">Nothing on this list yet.</p>
        <div class="row" style="justify-content:center">
          <button class="btn primary" onclick={() => (adding = true)}>From my library</button>
          <button class="btn" onclick={() => (primeKeyboard(), (addingNew = true))}><Icon name="plus" /> Something new</button>
        </div>
      </div>
    {:else}
      <div class="row">
        <label class="toggle slim-toggle"><input type="checkbox" bind:checked={hideDone} /><span>Hide finished</span></label>
        <span class="spacer"></span>
        <button class="btn small" class:primary={editMode} onclick={() => (editMode = !editMode)}>{editMode ? 'Done' : 'Remove…'}</button>
      </div>
      <div class="rows" use:sortable={{ onmove }}>
        {#each shown as it (it.id)}
          <div data-sort class="row-wrap">
            {#if editMode}
              <div class="row" style="flex-wrap:nowrap">
                <button class="remove-btn" aria-label="Remove {it.title} from the list" onclick={() => remove(it)}><Icon name="x" /></button>
                <div style="flex:1;min-width:0"><ItemRow item={it} showStatus /></div>
              </div>
            {:else}
              <ItemRow item={it} onstep={it.status === 'active' ? stepItem : undefined} handle={shown.length > 1} showStatus />
            {/if}
          </div>
        {/each}
      </div>
      <div class="row">
        <button class="btn" style="flex:1" onclick={() => (adding = true)}>+ From my library</button>
        <button class="btn" style="flex:1" onclick={() => (primeKeyboard(), (addingNew = true))}>+ Something new</button>
      </div>
    {/if}
  </main>

  {#if menu}
    <Sheet onclose={() => (menu = false)} label="List options">
      <div class="menu">
        <button onclick={() => ((menu = false), (renaming = true))}><span class="ico">✏️</span>Rename</button>
        {#if items.length}<button onclick={() => ((menu = false), (sharing = true))}><span class="ico">💌</span>Share this list</button>{/if}
        <button onclick={() => ((menu = false), (picking = true))}><span class="ico">🎲</span>Pick something from it</button>
        <button class="danger" onclick={del}><span class="ico">🗑️</span>Delete list</button>
      </div>
    </Sheet>
  {/if}

  {#if adding}
    <Sheet onclose={() => (adding = false)} label="Add from library" full>
      <div class="pinned stack" style="gap:8px">
        <div class="row"><h2>Add to {list.name}</h2><span class="spacer"></span><button class="btn small primary" onclick={() => (adding = false)}>Done</button></div>
        <input class="input" type="search" bind:value={q} placeholder="Search your library" />
      </div>
      <div class="rows">
        {#each library as it (it.id)}
          {@const on = list.items.includes(it.id)}
          <button class="result" class:picked={on} onclick={() => toggle(it)} aria-pressed={on}>
            <Cover src={it.cover} type={it.type} size={34} />
            <span class="item-text"><strong class="item-title">{it.title}</strong><span class="item-meta">{[it.year, it.by].filter(Boolean).join(' · ')}</span></span>
            <span class="check" aria-hidden="true">{on ? '✓' : '+'}</span>
          </button>
        {:else}
          <p class="muted center">{app.d.items.length ? 'Nothing matches.' : 'Your library is empty.'}</p>
        {/each}
      </div>
    </Sheet>
  {/if}
  {#if addingNew}<AddSheet onclose={() => (addingNew = false)} listId={list.id} />{/if}
  {#if renaming}<ListEditSheet {list} onclose={() => (renaming = false)} />{/if}
  {#if sharing}<ShareSheet {items} {list} onclose={() => (sharing = false)} />{/if}
  {#if picking}<PickSheet listId={list.id} onclose={() => (picking = false)} />{/if}
{/if}
