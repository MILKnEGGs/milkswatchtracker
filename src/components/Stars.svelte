<script lang="ts">
  // Five stars with halves; the value is out of 10. Tap the left half of a star for a half star.
  // Tapping the current rating again clears it.
  let { value, onchange, size = 30 }: { value?: number; onchange?: (v: number | undefined) => void; size?: number } = $props();

  function tap(e: MouseEvent, i: number) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const half = e.clientX - r.left < r.width / 2;
    const v = i * 2 + (half ? 1 : 2);
    onchange?.(v === value ? undefined : v);
  }

  function key(e: KeyboardEvent) {
    const v = value ?? 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onchange?.(Math.min(10, v + 1));
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onchange?.(v <= 1 ? undefined : v - 1);
    else return;
    e.preventDefault();
  }

  const fill = (i: number) => {
    const v = value ?? 0;
    return v >= i * 2 + 2 ? 1 : v >= i * 2 + 1 ? 0.5 : 0;
  };
  const STAR = 'M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9L12 2.8Z';
  const uid = Math.random().toString(36).slice(2, 8);
</script>

{#if onchange}
  <div class="stars" role="slider" tabindex="0" aria-label="Your rating" aria-valuemin={0} aria-valuemax={5} aria-valuenow={(value ?? 0) / 2} aria-valuetext={value ? `${value / 2} of 5 stars` : 'Not rated'} onkeydown={key}>
    {#each [0, 1, 2, 3, 4] as i (i)}
      <button type="button" tabindex="-1" aria-hidden="true" onclick={(e) => tap(e, i)} style:width="{size + 6}px" style:height="{size + 6}px">
        {@render star(i)}
      </button>
    {/each}
  </div>
{:else}
  <span class="stars ro" aria-label={value ? `${value / 2} of 5 stars` : 'Not rated'}>
    {#each [0, 1, 2, 3, 4] as i (i)}{@render star(i)}{/each}
  </span>
{/if}

{#snippet star(i: number)}
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <clipPath id="h-{uid}-{i}"><rect x="0" y="0" width={24 * fill(i)} height="24" /></clipPath>
    </defs>
    <path d={STAR} class="star-empty" />
    <path d={STAR} class="star-full" clip-path="url(#h-{uid}-{i})" />
  </svg>
{/snippet}
