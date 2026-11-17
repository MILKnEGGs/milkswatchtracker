<script lang="ts">
  import { TYPES } from '../lib/data';
  import type { MediaType } from '../lib/types';

  let { type, plural = false }: { type: MediaType; plural?: boolean } = $props();
</script>

<span class="type-tag" data-type={type}>{plural ? TYPES[type].plural : TYPES[type].label}</span>
