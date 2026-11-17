<script lang="ts">
  // − [number] + with a typed value. Empty means "not set".
  let {
    label,
    value,
    onchange,
    min = 0,
    max,
    suffix,
  }: { label: string; value?: number; onchange: (v: number | undefined) => void; min?: number; max?: number; suffix?: string } = $props();

  const clamp = (n: number) => Math.max(min, max != null ? Math.min(max, n) : n);
</script>

<div class="stepper">
  <span class="stepper-label">{label}</span>
  <div class="stepper-box">
    <button type="button" aria-label="Less {label}" disabled={value == null || value <= min} onclick={() => onchange(clamp((value ?? min) - 1))}>−</button>
    <input
      type="number"
      inputmode="decimal"
      aria-label={label}
      value={value ?? ''}
      {min}
      {max}
      placeholder="–"
      onchange={(e) => {
        const t = e.currentTarget.value.trim();
        onchange(t === '' ? undefined : clamp(Number(t)));
      }}
    />
    {#if suffix}<span class="suffix">{suffix}</span>{/if}
    <button type="button" aria-label="More {label}" disabled={max != null && value != null && value >= max} onclick={() => onchange(clamp(value == null ? Math.max(min, 1) : value + 1))}>+</button>
  </div>
</div>
