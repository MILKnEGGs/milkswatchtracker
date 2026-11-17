<script lang="ts">
  import { TYPES } from '../lib/data';
  import type { MediaType } from '../lib/types';

  // Poster-shaped cover. Falls back to the type's emoji when there's no picture or it can't load (offline, never cached).
  let { src, type, title = '', size = 52 }: { src?: string; type: MediaType; title?: string; size?: number } = $props();
  let failed = $state(false);
  $effect(() => {
    void src;
    failed = false;
  });
</script>

<span class="cover" data-type={type} style:width="{size}px" style:height="{Math.round(size * 1.5)}px" style:font-size="{Math.round(size * 0.45)}px">
  {#if src && !failed}
    <img {src} alt="" loading="lazy" referrerpolicy="no-referrer" onerror={() => (failed = true)} />
  {:else}
    <span aria-hidden="true">{TYPES[type].emoji}</span>
    <span class="sr">{title}</span>
  {/if}
</span>
