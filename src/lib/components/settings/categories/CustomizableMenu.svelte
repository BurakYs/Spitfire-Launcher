<script lang="ts">
  import { Separator } from 'bits-ui';
  import Label from '$components/ui/Label.svelte';
  import Switch from '$components/ui/Switch.svelte';
  import { settingsStorage } from '$lib/core/data-storage';
  import { SidebarCategories } from '$lib/constants/sidebar';

  function setVisibility(key: string, value: boolean) {
    settingsStorage.update((settings) => ({
      ...settings,
      customizableMenu: {
        ...settings.customizableMenu,
        [key]: value
      }
    }));
  }
</script>

<div class="space-y-6">
  {#each $SidebarCategories as category (category.key)}
    <div>
      <h2 class="text-lg font-semibold mb-1">{category.name}</h2>
      <Separator.Root class="bg-border h-px mb-2"/>

      <div class="grid grid-cols-1 xs:grid-cols-2 gap-y-1 gap-x-3">
        {#each category.items as item (item.key)}
          <div class="flex items-center justify-between">
            <Label class="flex-1 text-sm font-normal" for={item.key}>{item.name}</Label>
            <Switch
              id={item.key}
              checked={($settingsStorage.customizableMenu || {})[item.key] !== false}
              onCheckedChange={(checked) => setVisibility(item.key, checked)}
            />
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>
