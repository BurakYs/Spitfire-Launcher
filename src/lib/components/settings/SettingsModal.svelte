<script lang="ts">
  import DownloaderSettings from '$components/settings/categories/DownloaderSettings.svelte';
  import Dialog from '$components/ui/Dialog.svelte';
  import AppSettings from '$components/settings/categories/AppSettings.svelte';
  import CustomizableMenu from '$components/settings/categories/CustomizableMenu.svelte';
  import { platform as getPlatform } from '@tauri-apps/plugin-os';
  import SettingsIcon from 'lucide-svelte/icons/settings';
  import { cn, t } from '$lib/utils/util';

  const platform = getPlatform();

  const categories = $derived([
    { id: 'appSettings', name: $t('settings.tabs.appSettings'), component: AppSettings },
    { id: 'customizableMenu', name: $t('settings.tabs.customizableMenu'), component: CustomizableMenu },
    ...(platform === 'windows' ? [{ id: 'downloaderSettings', name: $t('settings.tabs.downloaderSettings'), component: DownloaderSettings }] : [])
  ]);

  // svelte-ignore state_referenced_locally
  let activeTab = $state(categories[0].id);
</script>

<Dialog
  contentProps={{ class: '!max-w-[calc(100%-2rem)] sm:!max-w-180  max-xs:w-full' }}
  triggerClass="p-2 rounded-md hover:bg-accent"
>
  {#snippet trigger()}
    <SettingsIcon class="size-6"/>
  {/snippet}

  {#snippet title()}
    {$t('settings.title')}
  {/snippet}

  <div class="flex flex-col sm:flex-row">
    <div class="sm:w-44 sm:pr-4 sm:border-r">
      <div class="flex flex-wrap sm:flex-nowrap sm:flex-col gap-2 mb-2 sm:mb-0">
        {#each categories as category (category.id)}
          <button
            class={cn(
              'text-left px-3 py-2 rounded-md text-sm font-medium transition-colors w-fit sm:w-full mb-2 sm:mb-0',
              activeTab === category.id
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
            onclick={() => (activeTab = category.id)}
          >
            {category.name}
          </button>
        {/each}
      </div>
    </div>

    <div class="flex-1 p-1 sm:p-4 max-h-114 max-xs:max-h-128 overflow-y-auto">
      <div>
        {#each categories as category (category.id)}
          {@const CategoryComponent = category.component}

          {#if activeTab === category.id}
            <CategoryComponent/>
          {/if}
        {/each}
      </div>
    </div>
  </div>
</Dialog>
