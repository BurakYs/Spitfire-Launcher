<script lang="ts" module>
  import { writable } from 'svelte/store';

  export const sidebarOpen = writable(false);
</script>

<script lang="ts">
  import AccountSwitcher from '$components/header/AccountSwitcher.svelte';
  import Button from '$components/ui/Button.svelte';
  import ExternalLink from '$components/ui/ExternalLink.svelte';
  import { settingsStorage } from '$lib/core/data-storage';
  import { getVersion } from '@tauri-apps/api/app';
  import { Separator } from 'bits-ui';
  import { slide } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { platform } from '@tauri-apps/plugin-os';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import { cn, t } from '$lib/utils/util';
  import { page } from '$app/state';
  import { SidebarCategories } from '$lib/constants/sidebar';
  import { SvelteSet } from 'svelte/reactivity';

  const currentPlatform = platform();
  const isMobile = currentPlatform === 'android' || currentPlatform === 'ios';
	
  let notExpandedCategories = new SvelteSet<string>();

  const externalLinks = $derived([
    {
      name: $t('sidebar.externalLinks.discord'),
      href: 'https://discord.gg/rAUbXf5xUZ',
      icon: '/assets/icons/discord.svg'
    },
    {
      name: $t('sidebar.externalLinks.repository'),
      href: 'https://github.com/BurakYs/Spitfire-Launcher',
      icon: '/assets/icons/github.svg'
    }
  ]);

  function toggleCategory(id: string) {
    const isNotExpanded = notExpandedCategories.has(id);
    if (!isNotExpanded) {
      notExpandedCategories.add(id);
    } else {
      notExpandedCategories.delete(id);
    }
  }

  function isCategoryVisible(name: string) {
    return $SidebarCategories
      .find((category) => category.name === name)
      ?.items.some((item) => getItemVisibility(item.key));
  }

  function getItemVisibility(key: string) {
    const menu = ($settingsStorage.customizableMenu || {}) as Record<string, boolean>;
    return menu[key] !== false;
  }
</script>

<div
  class="fixed inset-0 bg-black/50 z-40 lg:hidden" class:block={$sidebarOpen} class:hidden={!$sidebarOpen}
  onclick={() => sidebarOpen.set(false)}
  onkeydown={(e) => e.key === 'Escape' && sidebarOpen.set(false)}
  role="button"
  tabindex="0"
></div>

<aside
  class={cn(
    'w-60 sm:w-72 h-screen bg-surface-alt flex flex-col overflow-hidden select-none',
    'fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out',
    'lg:sticky lg:top-0 lg:translate-x-0',
    $sidebarOpen ? 'translate-x-0' : '-translate-x-full'
  )}
>
  <div
    class="flex items-center justify-center p-4 border-b border-r {isMobile ? 'pt-6 h-22' : 'h-16'}"
    data-tauri-drag-region
  >
    <a class="max-xs:text-xl text-2xl font-bold" href="/">Spitfire Launcher</a>
  </div>

  <nav class="flex-1 overflow-y-auto py-4 border-r">
    <ul class="space-y-1.5 px-2">
      {#each $SidebarCategories as category (category.key)}
        {#if isCategoryVisible(category.name)}
          <li>
            <button
              class={cn(
                'w-full px-2 py-1 text-sm font-medium rounded-md',
                'flex justify-between items-center',
                'hover:bg-accent'
              )}
              onclick={() => toggleCategory(category.key)}
            >
              <span>{category.name}</span>
              <ChevronDownIcon
                class={cn(
                  'size-4 transition-transform duration-200',
                  !notExpandedCategories.has(category.key) && 'rotate-180'
                )}
              />
            </button>

            {#if !notExpandedCategories.has(category.key)}
              <ul
                class="mt-1 ml-4 space-y-1 border-l border-border pl-2"
                transition:slide|local={{ duration: 200, easing: cubicInOut }}
              >
                {#each category.items as item (item.name)}
                  {#if getItemVisibility(item.key)}
                    <li>
                      <a
                        class={cn(
                          'block px-3 py-1 text-sm rounded-md truncate',
                          'hover:bg-accent',
                          page.url.pathname === item.href && 'bg-accent text-accent-foreground'
                        )}
                        href={item.href}
                        onclick={() => sidebarOpen.set(false)}
                      >
                        {item.name}
                      </a>
                    </li>
                  {/if}
                {/each}
              </ul>
            {/if}
          </li>
        {/if}
      {/each}
    </ul>
  </nav>

  <div class="border-t space-y-2 p-4">
    <AccountSwitcher/>

    <footer class="flex items-center justify-center gap-4 border-t pt-2.5">
      <div class="flex items-center gap-3">
        {#each externalLinks as link (link.name)}
          <Button
            class="text-muted-foreground text-left text-sm p-0 flex items-center"
            href={link.href}
            variant="ghost"
          >
            <img
              class="size-5"
              alt={link.name}
              src={link.icon}
            />
          </Button>
        {/each}
      </div>

      <Separator.Root class="bg-border h-4 w-px" orientation="vertical"/>

      {#await getVersion()}
        <!-- -->
      {:then version}
        <div class="text-xs text-muted-foreground">
          {$t('sidebar.version')}
          <ExternalLink
            class="underline underline-offset-2"
            href="https://github.com/BurakYs/Spitfire-Launcher/releases/tag/v{version}"
          >
            v{version}
          </ExternalLink>
        </div>
      {/await}
    </footer>
  </div>
</aside>
