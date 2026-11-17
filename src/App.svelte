<script lang="ts">
  import { registerSW } from 'virtual:pwa-register';
  import Icon from './components/Icon.svelte';
  import { requestPersistence } from './lib/db';
  import { refresh } from './lib/lookup';
  import { app, dismissToast, isStandalone, router, save, toast, toasts } from './lib/store.svelte';
  import { setThemeMode } from './lib/theme';
  import History from './views/History.svelte';
  import Install from './views/Install.svelte';
  import ItemPage from './views/ItemPage.svelte';
  import Library from './views/Library.svelte';
  import ListPage from './views/ListPage.svelte';
  import Lists from './views/Lists.svelte';
  import Settings from './views/Settings.svelte';
  import UpNext from './views/UpNext.svelte';

  let updateReady = $state(false);
  let offlineReady = $state(false);
  const updateSW = registerSW({
    onNeedRefresh: () => (updateReady = true),
    onOfflineReady() {
      offlineReady = true;
      if (isStandalone) toast('✓ Ready to use offline', undefined, 4000);
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      if (registration.active) offlineReady = true;
      // Check for a new version hourly while the app stays open. Failures (no signal) are harmless.
      setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    },
  });
  requestPersistence();

  $effect(() => setThemeMode(app.d.settings.theme));

  // Shows you're watching get new seasons and air dates. Quietly refresh a few stale ones on open.
  async function refreshShows() {
    if (!navigator.onLine) return;
    const stale = app.d.items
      .filter((i) => i.type === 'tv' && i.ext?.src === 'tvmaze' && (i.status === 'active' || i.status === 'hold') && Date.now() - i.ext.fetchedAt > 2 * 86_400_000)
      .slice(0, 8);
    for (const it of stale) {
      try {
        it.ext = await refresh($state.snapshot(it.ext!));
      } catch {
        break;
      }
    }
    if (stale.length) save();
  }
  setTimeout(refreshShows, 3000);

  const r = $derived(router.route);
  const TABS = [
    { page: 'next', href: '#/', ico: 'play', label: 'Up Next' },
    { page: 'library', href: '#/library', ico: 'grid', label: 'Library' },
    { page: 'lists', href: '#/lists', ico: 'lists', label: 'Lists' },
    { page: 'history', href: '#/history', ico: 'clock', label: 'History' },
    { page: 'settings', href: '#/settings', ico: 'settings', label: 'Settings' },
  ] as const;
  const showTabs = $derived(TABS.some((t) => t.page === r.page));
</script>

{#if r.page === 'item'}
  {#key r.arg}<ItemPage id={r.arg ?? ''} />{/key}
{:else if r.page === 'library'}
  <Library />
{:else if r.page === 'lists'}
  <Lists />
{:else if r.page === 'list'}
  {#key r.arg}<ListPage id={r.arg ?? ''} />{/key}
{:else if r.page === 'history'}
  <History />
{:else if r.page === 'settings'}
  <Settings {offlineReady} />
{:else if r.page === 'install'}
  <Install />
{:else}
  <UpNext />
{/if}

{#if updateReady}
  <div class="update" role="status">
    <span>✨ A new version is ready.</span>
    <button class="btn small primary" onclick={() => updateSW(true)}>Update</button>
    <button class="btn small ghost" onclick={() => (updateReady = false)}>Later</button>
  </div>
{/if}

{#if showTabs}
  <nav class="tabbar">
    {#each TABS as t (t.page)}
      <a href={t.href} class:active={r.page === t.page} aria-current={r.page === t.page ? 'page' : undefined}>
        <span class="ico"><Icon name={t.ico} size={25} /></span>{t.label}
      </a>
    {/each}
  </nav>
{/if}

<div class="toasts" aria-live="polite">
  {#each toasts as t (t.id)}
    <div class="toast">
      <span>{t.text}</span>
      {#if t.action}
        <button onclick={() => (t.action!.run(), dismissToast(t.id))}>{t.action.label}</button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .update {
    position: fixed;
    left: 12px;
    right: 12px;
    top: calc(66px + env(safe-area-inset-top));
    z-index: 40;
    max-width: 616px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 16px;
    background: var(--surface);
    box-shadow: 0 8px 24px rgb(0 0 0 / 25%);
    font-weight: 800;
  }
  .update span {
    flex: 1;
  }
  .ico {
    position: relative;
    display: inline-grid;
  }
</style>
