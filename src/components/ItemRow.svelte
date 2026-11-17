<script lang="ts">
  import { canStep, progressText, STATUS_EMOJI, statusLabel, stars, TYPES } from '../lib/data';
  import { serviceName } from '../lib/store.svelte';
  import type { Item } from '../lib/types';
  import Cover from './Cover.svelte';
  import Icon from './Icon.svelte';

  let {
    item,
    onstep,
    handle = false,
    showStatus = false,
    showType = true,
  }: { item: Item; onstep?: (it: Item) => void; handle?: boolean; showStatus?: boolean; showType?: boolean } = $props();

  const prog = $derived(progressText(item));
  const where = $derived(item.where.map(serviceName).filter(Boolean).join(' · '));
  const meta = $derived(
    [showType ? TYPES[item.type].label : '', item.year, item.by].filter(Boolean).join(' · '),
  );
</script>

<div class="item-row" data-type={item.type} class:faded={item.status === 'done' || item.status === 'dropped'}>
  <a class="item-main" href="#/i/{item.id}">
    <Cover src={item.cover} type={item.type} title={item.title} size={46} />
    <span class="item-text">
      <strong class="item-title">{item.title}</strong>
      <span class="item-meta">
        {#if showType}<span class="dot" aria-hidden="true"></span>{/if}{meta}
      </span>
      {#if prog && item.status !== 'done'}<span class="item-prog">{prog}</span>{/if}
      <span class="item-meta small">
        {#if showStatus}<span>{STATUS_EMOJI[item.status]} {statusLabel(item.status, item.type)}</span>{/if}
        {#if item.rating != null}<span class="mini-stars">{stars(item.rating)}</span>{/if}
        {#if where}<span>📍 {where}</span>{/if}
      </span>
    </span>
  </a>
  {#if onstep && canStep(item) && item.status !== 'done'}
    <button class="step-btn" aria-label="Next {TYPES[item.type].track === 'episodes' ? 'episode' : (item.progress.unit ?? 'chapter')} of {item.title}" onclick={() => onstep(item)}>+1</button>
  {/if}
  {#if handle}
    <span class="handle" data-handle aria-label="Drag to reorder"><Icon name="grip" /></span>
  {/if}
</div>
