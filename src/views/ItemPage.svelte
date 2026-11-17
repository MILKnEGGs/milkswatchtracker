<script lang="ts">
  import Cover from '../components/Cover.svelte';
  import Icon from '../components/Icon.svelte';
  import ItemEditSheet from '../components/ItemEditSheet.svelte';
  import ListEditSheet from '../components/ListEditSheet.svelte';
  import ShareSheet from '../components/ShareSheet.svelte';
  import Sheet from '../components/Sheet.svelte';
  import Stars from '../components/Stars.svelte';
  import Stepper from '../components/Stepper.svelte';
  import TopBar from '../components/TopBar.svelte';
  import TypeTag from '../components/TypeTag.svelte';
  import { changeStatus, deleteItem, stepItem } from '../lib/actions';
  import { allTags, log, progressText, readTotal, SERVICE_IDEAS, serviceForNetwork, SOURCE_NAME, STATUS_EMOJI, STATUSES, statusLabel, TYPES, uid, UNITS } from '../lib/data';
  import { refresh, sourceUrl } from '../lib/lookup';
  import { app, back, itemById, save, toast } from '../lib/store.svelte';
  import type { Progress } from '../lib/types';

  let { id }: { id: string } = $props();

  const it = $derived(itemById(id));
  const info = $derived(it ? TYPES[it.type] : undefined);

  let menu = $state(false);
  let editing = $state(false);
  let sharing = $state(false);
  let newList = $state(false);
  let refreshing = $state(false);
  let showLog = $state(false);
  let addingService = $state(false);
  let serviceText = $state('');
  let tagText = $state('');
  // Reading and game progress is optional; it stays tucked away until used.
  let openProgress = $state(false);

  const hasProgress = $derived(!!it && (it.progress.n != null || it.progress.hours != null || it.progress.pct != null));
  const showProgress = $derived(!!it && info?.track !== 'none' && (info?.track === 'episodes' || hasProgress || openProgress));
  const seasons = $derived(it?.ext?.seasons);
  const seasonLen = $derived(it && seasons && it.progress.season ? seasons[it.progress.season - 1] : undefined);
  const network = $derived(it?.ext?.network);
  const networkMissing = $derived(!!it && !!network && !serviceForNetwork(app.d, network));
  const serviceIdeas = $derived(
    info ? SERVICE_IDEAS[info.verb].filter((n) => !app.d.settings.services.some((s) => s.name.toLowerCase() === n.toLowerCase())) : [],
  );
  // Services shown up front: ones on this item, ones used for the same kind of thing (watch/read/play),
  // and ones not used yet. The rest (Kindle on a TV show) wait under "+ Add a service".
  const services = $derived.by(() => {
    if (!it || !info) return { near: [], far: [] };
    const near = app.d.settings.services.filter((s) => {
      if (it.where.includes(s.id)) return true;
      const verbs = new Set(app.d.items.filter((i) => i.where.includes(s.id)).map((i) => TYPES[i.type].verb));
      return !verbs.size || verbs.has(info.verb);
    });
    return { near, far: app.d.settings.services.filter((s) => !near.includes(s)) };
  });
  const tagIdeas = $derived(it ? allTags(app.d).filter((t) => !it.tags.includes(t)) : []);

  function setProgress<K extends keyof Progress>(k: K, v: Progress[K]) {
    if (!it) return;
    it.progress[k] = v;
    if (v === undefined) delete it.progress[k];
    const text = progressText({ ...it, progress: { ...it.progress, note: undefined } });
    if (text && k !== 'note') log(it, 'progress', text);
    else it.updatedAt = Date.now();
    if (k !== 'note' && v !== undefined && it.status === 'want') changeStatus(it, 'active');
    save();
  }

  function toggleService(sid: string) {
    if (!it) return;
    const i = it.where.indexOf(sid);
    if (i >= 0) it.where.splice(i, 1);
    else it.where.push(sid);
    save();
  }

  function addService(name: string) {
    const n = name.trim();
    if (!n || !it) return;
    let s = app.d.settings.services.find((x) => x.name.toLowerCase() === n.toLowerCase());
    if (!s) {
      s = { id: uid(6), name: n };
      app.d.settings.services.push(s);
    }
    if (!it.where.includes(s.id)) it.where.push(s.id);
    serviceText = '';
    addingService = false;
    save();
  }

  function toggleList(lid: string) {
    const l = app.d.lists.find((x) => x.id === lid);
    if (!l || !it) return;
    const i = l.items.indexOf(it.id);
    if (i >= 0) l.items.splice(i, 1);
    else l.items.push(it.id);
    save();
  }

  function addTag(t: string) {
    const tag = t.trim().replace(/^#/, '').toLowerCase();
    if (!tag || !it || it.tags.includes(tag)) return void (tagText = '');
    it.tags.push(tag);
    tagText = '';
    save();
  }

  function removeTag(t: string) {
    if (!it) return;
    it.tags = it.tags.filter((x) => x !== t);
    save();
  }

  async function doRefresh() {
    if (!it?.ext) return;
    menu = false;
    refreshing = true;
    try {
      it.ext = await refresh($state.snapshot(it.ext));
      save();
      toast('Details updated ✓');
    } catch (err) {
      toast(navigator.onLine ? (err as Error).message : "You're offline. Try again with signal.");
    }
    refreshing = false;
  }

  function remove() {
    if (!it) return;
    menu = false;
    deleteItem(it);
    back('library');
  }

  const runtimeText = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim() : `${m} min`);
  const shortPlatform = (p: string) => p.replace(/^(Nintendo|Microsoft|Sony) /, '').replace('PlayStation', 'PS').replace('Windows', 'PC').replace(/ Series X and Series S$/, ' Series X|S');

  const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtAir = (d: string) => new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const log10 = $derived(it ? [...it.log].reverse().slice(0, showLog ? undefined : 6) : []);
</script>

{#if !it || !info}
  <TopBar title="Not found" showBack />
  <main class="page"><p class="muted">This was deleted.</p></main>
{:else}
  <TopBar title={it.title} showBack ontitle={() => (editing = true)}>
    <button class="icon-btn" aria-label="Recommend to someone" onclick={() => (sharing = true)}><Icon name="share" /></button>
    <button class="icon-btn" aria-label="More" onclick={() => (menu = true)}><Icon name="more" /></button>
  </TopBar>

  <main class="page stack" data-type={it.type}>
    <section class="hero">
      <Cover src={it.cover} type={it.type} title={it.title} size={104} />
      <div class="hero-text">
        <TypeTag type={it.type} />
        <h2 class="hero-title">{it.title}</h2>
        {#if it.year || it.by || (it.type === 'movie' && it.ext?.runtime)}
          <div class="muted">{[it.year, it.by, it.type === 'movie' && it.ext?.runtime ? runtimeText(it.ext.runtime) : ''].filter(Boolean).join(' · ')}</div>
        {/if}
        {#if it.ext?.platforms?.length}<div class="genres">🎮 {it.ext.platforms.slice(0, 5).map(shortPlatform).join(' · ')}</div>{/if}
        {#if it.ext?.rating}
          <a class="ext-rating" href={sourceUrl(it.ext, it.type)} target="_blank" rel="noopener">
            ★ {it.ext.rating.toFixed(1)}<span class="muted small"> /10 on {SOURCE_NAME[it.ext.src]} ↗</span>
          </a>
        {:else if it.ext}
          <a class="ext-rating small" href={sourceUrl(it.ext, it.type)} target="_blank" rel="noopener">On {SOURCE_NAME[it.ext.src]} ↗</a>
        {/if}
        {#if it.genres.length}<div class="genres">{it.genres.slice(0, 4).join(' · ')}</div>{/if}
        {#if it.from}<div class="small muted">💌 Recommended by {it.from}</div>{/if}
      </div>
    </section>

    <div class="status-seg" role="radiogroup" aria-label="Status">
      {#each STATUSES as s (s)}
        <button role="radio" aria-checked={it.status === s} class:on={it.status === s} data-status={s} onclick={() => changeStatus(it, s)}>
          <span aria-hidden="true">{STATUS_EMOJI[s]}</span>{statusLabel(s, it.type)}
        </button>
      {/each}
    </div>

    {#if showProgress}
      <section class="card stack">
        <div class="row">
          <h3>{info.track === 'episodes' ? '📍 Where I am' : info.track === 'game' ? '🎮 Progress' : '📍 Where I am'}</h3>
          <span class="spacer"></span>
          {#if it.ext?.nextAir}<span class="small muted">Next ep {fmtAir(it.ext.nextAir)}</span>{/if}
        </div>

        {#if info.track === 'episodes'}
          <div class="row steppers">
            {#if it.type === 'tv' || it.progress.season != null}
              <Stepper label="Season" value={it.progress.season} min={1} max={seasons?.length || undefined} onchange={(v) => setProgress('season', v)} />
            {/if}
            <Stepper
              label="Episode"
              value={it.progress.episode}
              max={seasonLen ?? (it.type === 'anime' ? it.ext?.total : undefined)}
              suffix={seasonLen ? `of ${seasonLen}` : it.type === 'anime' && it.ext?.total ? `of ${it.ext.total}` : undefined}
              onchange={(v) => setProgress('episode', v)}
            />
          </div>
          {#if it.status !== 'done'}
            <button class="btn primary block big" onclick={() => stepItem(it)}>+1 Watched the next episode</button>
          {/if}
          {#if seasons?.length}
            <p class="muted small" style="margin:0">
              {seasons.length} season{seasons.length === 1 ? '' : 's'} on TVmaze: {seasons.map((n, i) => `S${i + 1}·${n}`).join('  ')}
            </p>
          {/if}
        {:else if info.track === 'reading'}
          <div class="seg">
            {#each UNITS as u (u.key)}
              <button class:on={(it.progress.unit ?? 'chapter') === u.key} onclick={() => setProgress('unit', u.key)}>{u.label}</button>
            {/each}
          </div>
          <Stepper
            label={UNITS.find((u) => u.key === (it.progress.unit ?? 'chapter'))!.label}
            value={it.progress.n}
            max={it.progress.unit === 'percent' ? 100 : readTotal(it)}
            suffix={it.progress.unit === 'percent' ? '%' : readTotal(it) ? `of ${readTotal(it)}` : undefined}
            onchange={(v) => setProgress('n', v)}
          />
        {:else if info.track === 'game'}
          <div class="row steppers">
            <Stepper label="Hours" value={it.progress.hours} onchange={(v) => setProgress('hours', v)} />
            <Stepper label="Complete" value={it.progress.pct} max={100} suffix="%" onchange={(v) => setProgress('pct', v)} />
          </div>
        {/if}
        <input
          class="input"
          placeholder={info.track === 'game' ? 'Where I am: "Chapter 4, after the bridge"' : 'A note on where I am (optional)'}
          value={it.progress.note ?? ''}
          onchange={(e) => setProgress('note', e.currentTarget.value.trim() || undefined)}
        />
      </section>
    {:else if info.track !== 'none' && it.status !== 'done'}
      <button class="link-btn" onclick={() => (openProgress = true)}>
        + Track {info.track === 'game' ? 'hours or percent' : 'chapter, volume or page'} (optional)
      </button>
    {/if}

    <section class="card stack">
      <div class="row">
        <h3>⭐ My rating</h3>
        <span class="spacer"></span>
        {#if it.times > 1}<span class="small muted">{statusLabel('done', it.type)} ×{it.times}</span>{/if}
      </div>
      <Stars value={it.rating} onchange={(v) => ((it.rating = v), save())} />
      {#if it.status === 'done' || it.rating != null || it.review}
        <textarea class="input" rows="2" placeholder="A few words on what you thought (optional)" bind:value={it.review} oninput={save}></textarea>
      {/if}
    </section>

    <section class="card stack">
      <h3>📍 Where to {info.verb} it</h3>
      <div class="chips">
        {#each services.near as s (s.id)}
          <button class="chip small-chip" class:on={it.where.includes(s.id)} onclick={() => toggleService(s.id)}>{s.name}</button>
        {/each}
        {#if networkMissing}
          <button class="chip small-chip guess" onclick={() => addService(network!)}>+ {network}</button>
        {/if}
        <button class="chip small-chip ghost-chip" onclick={() => (addingService = !addingService)}>+ Add a service</button>
      </div>
      {#if addingService}
        <form class="row" style="flex-wrap:nowrap" onsubmit={(e) => (e.preventDefault(), addService(serviceText))}>
          <!-- svelte-ignore a11y_autofocus -->
          <input class="input" bind:value={serviceText} placeholder="Netflix, Kindle, Switch…" autofocus />
          <button class="btn primary">Add</button>
        </form>
        {#if services.far.length || serviceIdeas.length}
          <div class="chips">
            {#each services.far as s (s.id)}<button class="chip small-chip guess" onclick={() => toggleService(s.id)}>+ {s.name}</button>{/each}
            {#each serviceIdeas as n (n)}<button class="chip small-chip guess" onclick={() => addService(n)}>+ {n}</button>{/each}
          </div>
        {/if}
      {/if}
    </section>

    <section class="card stack">
      <h3>📋 Lists</h3>
      <div class="chips">
        {#each app.d.lists as l (l.id)}
          <button class="chip small-chip" class:on={l.items.includes(it.id)} onclick={() => toggleList(l.id)}>{l.emoji} {l.name}</button>
        {/each}
        <button class="chip small-chip ghost-chip" onclick={() => (newList = true)}>+ New list</button>
      </div>
    </section>

    <section class="card stack">
      <h3># Tags</h3>
      {#if it.tags.length}
        <div class="chips">
          {#each it.tags as t (t)}
            <button class="chip small-chip on" onclick={() => removeTag(t)} aria-label="Remove tag {t}">#{t} ✕</button>
          {/each}
        </div>
      {/if}
      <form class="row" style="flex-wrap:nowrap" onsubmit={(e) => (e.preventDefault(), addTag(tagText))}>
        <input class="input" bind:value={tagText} placeholder="cozy, with the kids, short…" enterkeyhint="done" />
        <button class="btn" disabled={!tagText.trim()}>Add</button>
      </form>
      {#if tagIdeas.length}
        <div class="chips">
          {#each tagIdeas.slice(0, 12) as t (t)}<button class="chip small-chip guess" onclick={() => addTag(t)}>#{t}</button>{/each}
        </div>
      {/if}
    </section>

    <section class="card stack">
      <h3>📝 Notes</h3>
      <textarea class="input" rows="2" placeholder="Anything to remember" bind:value={it.notes} oninput={save}></textarea>
    </section>

    {#if it.log.length}
      <section class="card stack">
        <h3>🕰️ History</h3>
        <ul class="log">
          {#each log10 as l, i (i)}
            <li><span class="log-date">{fmtDate(l.at)}</span><span>{l.text}</span></li>
          {/each}
        </ul>
        {#if it.log.length > 6 && !showLog}<button class="link-btn" onclick={() => (showLog = true)}>Show all {it.log.length}</button>{/if}
      </section>
    {/if}

    {#if refreshing}<p class="muted small center">Updating from {it.ext ? SOURCE_NAME[it.ext.src] : ''}…</p>{/if}
  </main>

  {#if menu}
    <Sheet onclose={() => (menu = false)} label="More">
      <div class="menu">
        <button onclick={() => ((menu = false), (editing = true))}><span class="ico">✏️</span>Edit title and details</button>
        <button onclick={() => ((menu = false), (sharing = true))}><span class="ico">💌</span>Recommend to someone</button>
        {#if it.ext && it.ext.src !== 'openlibrary'}
          <button onclick={doRefresh}><span class="ico">🔄</span>Refresh from {SOURCE_NAME[it.ext.src]}</button>
        {/if}
        <button class="danger" onclick={remove}><span class="ico">🗑️</span>Delete</button>
      </div>
    </Sheet>
  {/if}
  {#if editing}<ItemEditSheet item={it} onclose={() => (editing = false)} />{/if}
  {#if sharing}<ShareSheet items={[it]} onclose={() => (sharing = false)} />{/if}
  {#if newList}<ListEditSheet onclose={() => (newList = false)} addItem={it.id} />{/if}
{/if}
