<script lang="ts">
  import Select from '$components/ui/Select.svelte';
  import FilterIcon from 'lucide-svelte/icons/filter';
  import ChevronsUpAndDownIcon from 'lucide-svelte/icons/chevrons-up-down';
  import type { SpitfireShopFilter } from '$types/game/shop';
  import { t } from '$lib/utils/util';

  const filters: { label: string; value: SpitfireShopFilter }[] = $derived([
    { label: $t('itemShop.filters.all'), value: 'all' },
    { label: $t('itemShop.filters.new'), value: 'new' },
    { label: $t('itemShop.filters.leavingSoon'), value: 'leavingSoon' },
    { label: $t('itemShop.filters.longestWait'), value: 'longestWait' }
  ]);

  type Props = {
    selected: SpitfireShopFilter;
  };

  let { selected = $bindable() }: Props = $props();
</script>

<Select items={filters} type="single" bind:value={selected}>
  {#snippet trigger(label)}
    <FilterIcon class="text-muted-foreground size-5 mr-2"/>
    <span class="text-muted-foreground">{label || $t('itemShop.selectFilter')}</span>
    <ChevronsUpAndDownIcon class="text-muted-foreground size-5 ml-auto"/>
  {/snippet}
</Select>
