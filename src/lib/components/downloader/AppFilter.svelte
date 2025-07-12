<script lang="ts">
  import Select from '$components/ui/Select.svelte';
  import type { AppFilterValue } from '$types/legendary';
  import FilterIcon from 'lucide-svelte/icons/filter';
  import ChevronsUpAndDownIcon from 'lucide-svelte/icons/chevrons-up-down';
  import { t } from '$lib/utils/util';

  const filters: { label: string; value: AppFilterValue }[] = $derived([
    { label: 'Show Hidden', value: 'hidden' },
    { label: 'Installed Only', value: 'installed' },
    { label: 'Updates Available', value: 'updatesAvailable' }
  ]);

  type Props = {
    selected: AppFilterValue[];
    disabled?: boolean;
  };

  let { selected = $bindable() }: Props = $props();
</script>

<Select
  items={filters}
  triggerClass="bg-surface-alt max-xs:min-w-44 max-xs:ml-auto"
  type="multiple"
  bind:value={selected}
>
  {#snippet trigger(label)}
    <FilterIcon class="text-muted-foreground size-5 mr-2"/>
    <span class="text-muted-foreground truncate">{label || 'Select filters'}</span>
    <ChevronsUpAndDownIcon class="text-muted-foreground size-5 ml-auto"/>
  {/snippet}
</Select>
