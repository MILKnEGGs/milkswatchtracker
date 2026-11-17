<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { backupJson, move, newData, parseBackup, SERVICE_IDEAS, uid } from '../lib/data';
  import { fileStamp, shareFile } from '../lib/files';
  import { sortable } from '../lib/sortable';
  import { app, isStandalone, replaceData, save, toast } from '../lib/store.svelte';
  import type { Service, ThemeMode } from '../lib/types';

  let { offlineReady }: { offlineReady: boolean } = $props();

  let fileInput: HTMLInputElement;
  let newService = $state('');
  let ideasOpen = $state(false);

  const ideas = $derived(
    [...SERVICE_IDEAS.watch, ...SERVICE_IDEAS.read, ...SERVICE_IDEAS.play].filter(
      (n) => !app.d.settings.services.some((s) => s.name.toLowerCase() === n.toLowerCase()),
    ),
  );
  const uses = (sid: string) => app.d.items.filter((i) => i.where.includes(sid)).length;

  function setTheme(t: ThemeMode) {
    app.d.settings.theme = t;
    save();
  }

  function addService(name: string) {
    const n = name.trim();
    if (!n) return;
    if (!app.d.settings.services.some((s) => s.name.toLowerCase() === n.toLowerCase())) app.d.settings.services.push({ id: uid(6), name: n });
    newService = '';
    save();
  }

  function renameService(s: Service) {
    const n = prompt('Rename this service', s.name)?.trim();
    if (!n) return;
    s.name = n;
    save();
  }

  function removeService(s: Service) {
    const n = uses(s.id);
    if (n && !confirm(`Remove “${s.name}”? It's on ${n} thing${n === 1 ? '' : 's'}; they'll just lose this tag.`)) return;
    app.d.settings.services = app.d.settings.services.filter((x) => x.id !== s.id);
    for (const it of app.d.items) it.where = it.where.filter((w) => w !== s.id);
    save();
  }

  async function exportBackup() {
    const file = new File([backupJson($state.snapshot(app.d))], `watchtracker-backup-${fileStamp()}.json`, { type: 'application/json' });
    await shareFile(file, "Milk's Watch Tracker backup");
  }

  async function importBackup(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      const d = parseBackup(await file.text());
      const msg = `Replace everything on this device with this backup?\n\n${d.items.length} things, ${d.lists.length} lists.\n\nWhat's here now will be replaced.`;
      if (!confirm(msg)) return;
      await replaceData(d);
      toast('Backup restored ✓');
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function eraseAll() {
    const typed = prompt("Erase EVERYTHING on this device: your library, lists and history? This can't be undone.\n\nType ERASE to confirm.");
    if (typed?.trim().toUpperCase() !== 'ERASE') return;
    const fresh = newData();
    fresh.settings = { ...$state.snapshot(app.d.settings) };
    await replaceData(fresh);
    toast('Everything erased. Fresh start! 🍿');
  }
</script>

<TopBar title="Settings" />

<main class="page stack" style="gap:16px">
  <section class="card stack">
    <h3>📍 Your services</h3>
    <p class="muted small" style="margin:0">Where you watch, read and play. Tag things with them, then filter: “what can I watch on Netflix?” Drag to reorder.</p>
    {#if app.d.settings.services.length}
      <div class="rows tight" use:sortable={{ onmove: (a, b) => (move(app.d.settings.services, a, b), save()) }}>
        {#each app.d.settings.services as s (s.id)}
          <div data-sort class="svc-row">
            <button class="svc-name" onclick={() => renameService(s)}>{s.name} <span class="muted small">{uses(s.id) || ''}</span></button>
            <button class="remove-btn" aria-label="Remove {s.name}" onclick={() => removeService(s)}><Icon name="x" size={18} /></button>
            <span class="handle" data-handle aria-label="Drag to reorder"><Icon name="grip" /></span>
          </div>
        {/each}
      </div>
    {/if}
    <form class="row" style="flex-wrap:nowrap" onsubmit={(e) => (e.preventDefault(), addService(newService))}>
      <input class="input" bind:value={newService} placeholder="Add a service or platform" />
      <button class="btn primary" disabled={!newService.trim()}>Add</button>
    </form>
    <button class="link-btn" onclick={() => (ideasOpen = !ideasOpen)}>{ideasOpen ? 'Hide ideas' : 'Show ideas'}</button>
    {#if ideasOpen}
      <div class="chips">
        {#each ideas as n (n)}<button class="chip small-chip guess" onclick={() => addService(n)}>+ {n}</button>{/each}
      </div>
    {/if}
  </section>

  <section class="card stack">
    <h3>💌 Sharing</h3>
    <label class="field">
      <span>Your name on recommendations</span>
      <input class="input" bind:value={app.d.settings.name} oninput={save} placeholder="Optional" />
    </label>
  </section>

  <section class="card stack">
    <h3>🎨 Look</h3>
    <div class="seg">
      <button class:on={app.d.settings.theme === 'dark'} onclick={() => setTheme('dark')}>🍿 Movie night</button>
      <button class:on={app.d.settings.theme === 'light'} onclick={() => setTheme('light')}>☀️ Light</button>
      <button class:on={app.d.settings.theme === 'auto'} onclick={() => setTheme('auto')}>Match device</button>
    </div>
  </section>

  <section class="card stack">
    <h3>💾 Backup & move to another device</h3>
    <p class="muted small" style="margin:0">
      Everything is saved only on this device. Export a backup to keep a copy or move to a new phone, then <em>Import</em> it there. Importing
      <strong>replaces</strong> what's on that device.
    </p>
    <div class="row">
      <button class="btn primary" onclick={exportBackup}>⬆️ Export backup</button>
      <button class="btn" onclick={() => fileInput.click()}>⬇️ Import backup</button>
      <input bind:this={fileInput} type="file" accept=".json,application/json" hidden onchange={importBackup} />
    </div>
  </section>

  <section class="card stack">
    <h3>📲 Install on your phone</h3>
    <p class="muted small" style="margin:0">
      {#if isStandalone}
        ✓ You're using the installed app{offlineReady ? ' and it works offline' : ''}.
      {:else}
        Add the app to your Home Screen so it opens like an app and works with no signal.
      {/if}
    </p>
    <a class="btn" href="#/install">How to install</a>
  </section>

  <section class="card stack">
    <h3>🔎 Where details come from</h3>
    <p class="muted small" style="margin:0">
      Covers, ratings and episode counts come from <a href="https://www.tvmaze.com" target="_blank" rel="noopener">TVmaze</a> (TV),
      <a href="https://anilist.co" target="_blank" rel="noopener">AniList</a> (anime, manga) and
      <a href="https://openlibrary.org" target="_blank" rel="noopener">Open Library</a> (books, comics) and
      <a href="https://en.wikipedia.org" target="_blank" rel="noopener">Wikipedia</a> (movies, games; posters, runtime, director or studio,
      no ratings). No account or key needed; only the titles you search for are sent.
    </p>
  </section>

  <section class="card stack">
    <h3>Danger zone</h3>
    <button class="btn danger" onclick={eraseAll}>Erase everything on this device</button>
  </section>

  <p class="muted small center">
    Milk's Watch Tracker v{__APP_VERSION__} · made with 🍿 · <a href="https://milkneggs.github.io/pitch/milkswatchtracker.html" target="_blank" rel="noopener">See what it does</a>
  </p>
</main>
