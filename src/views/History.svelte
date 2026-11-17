<script lang="ts">
  import Cover from '../components/Cover.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { stars, TYPES, yearStats, years } from '../lib/data';
  import { app } from '../lib/store.svelte';
  import type { Item, LogEntry } from '../lib/types';

  const ys = $derived(years(app.d));
  let year = $state(new Date().getFullYear());
  const st = $derived(yearStats(app.d, year));
  let feedSize = $state(40);

  const feed = $derived.by(() => {
    const all: { it: Item; l: LogEntry }[] = [];
    for (const it of app.d.items) for (const l of it.log) if (l.kind !== 'add') all.push({ it, l });
    all.sort((a, b) => b.l.at - a.l.at);
    const rows = all.slice(0, feedSize);
    const days: { day: string; rows: typeof rows }[] = [];
    for (const r of rows) {
      const day = dayLabel(r.l.at);
      if (days[days.length - 1]?.day !== day) days.push({ day, rows: [] });
      days[days.length - 1].rows.push(r);
    }
    return { days, more: all.length > feedSize };
  });

  function dayLabel(t: number): string {
    const d = new Date(t);
    const today = new Date();
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
  }

  const KIND_EMOJI: Record<string, string> = { start: '▶️', progress: '➕', done: '✅', drop: '🚫', hold: '⏸️', again: '🔁' };
</script>

<TopBar title="History" />

<main class="page stack">
  {#if ys.length > 1}
    <div class="chips scroll">
      {#each ys as y (y)}<button class="chip small-chip" class:on={year === y} onclick={() => (year = y)}>{y}</button>{/each}
    </div>
  {/if}

  <section class="card recap stack">
    <h3>🏆 {year} so far</h3>
    {#if !st.finished.length && !st.episodes}
      <p class="muted" style="margin:0">Nothing finished in {year} yet. Mark things watched, read or played and they'll show up here.</p>
    {:else}
      <div class="recap-grid">
        <div><strong>{st.finished.length}</strong><span>finished</span></div>
        <div><strong>{st.episodes}</strong><span>episodes &amp; chapters logged</span></div>
        {#if st.avgRating != null}<div><strong>{(st.avgRating / 2).toFixed(1)}★</strong><span>your average</span></div>{/if}
      </div>
      {#if st.byType.length}
        <div class="chips">
          {#each st.byType as b (b.type)}<span class="chip small-chip type-chip on" data-type={b.type}>{TYPES[b.type].emoji} {b.n} {b.n === 1 ? TYPES[b.type].label : TYPES[b.type].plural === 'TV' ? 'TV shows' : TYPES[b.type].plural}</span>{/each}
        </div>
      {/if}
      {#if st.top.length}
        <h3 style="margin-top:4px">Your favorites</h3>
        <div class="rows">
          {#each st.top as it, i (it.id)}
            <a class="top-row" href="#/i/{it.id}">
              <span class="rank">{i + 1}</span>
              <Cover src={it.cover} type={it.type} size={30} />
              <span class="item-title">{it.title}</span>
              <span class="mini-stars">{stars(it.rating!)}</span>
            </a>
          {/each}
        </div>
      {/if}
      {#if st.finished.length}
        <details>
          <summary>Everything finished in {year} ({st.finished.length})</summary>
          <div class="cover-wall">
            {#each st.finished as it (it.id)}
              <a href="#/i/{it.id}" title={it.title}><Cover src={it.cover} type={it.type} title={it.title} size={58} /></a>
            {/each}
          </div>
        </details>
      {/if}
    {/if}
  </section>

  <h3 class="section-head">Recent activity</h3>
  {#if !feed.days.length}
    <p class="muted">Nothing yet. Tap +1 on something in Up Next and it's logged here.</p>
  {:else}
    {#each feed.days as d (d.day)}
      <section class="card feed">
        <h4>{d.day}</h4>
        {#each d.rows as r (r.it.id + r.l.at)}
          <a class="feed-row" href="#/i/{r.it.id}">
            <span class="feed-ico" aria-hidden="true">{KIND_EMOJI[r.l.kind] ?? '•'}</span>
            <span class="item-text">
              <strong class="item-title">{r.it.title}</strong>
              <span class="item-meta">{r.l.text}</span>
            </span>
            <span class="muted small">{new Date(r.l.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
          </a>
        {/each}
      </section>
    {/each}
    {#if feed.more}<button class="btn block" onclick={() => (feedSize += 60)}>Show more</button>{/if}
  {/if}
</main>
