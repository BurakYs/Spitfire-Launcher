<script lang="ts">
  import LanguagesIcon from 'lucide-svelte/icons/languages';
  import CheckIcon from 'lucide-svelte/icons/check';
  import { language } from '$lib/stores';
  import type { Locale } from '$lib/paraglide/runtime';
  import { DropdownMenu } from '$components/ui/DropdownMenu';
  import { changeLocale, t } from '$lib/utils/util';

  const locales: { locale: Locale; country: string }[] = [
    { locale: 'en', country: 'usa' },
    { locale: 'es', country: 'spain' },
    { locale: 'tr', country: 'turkey' }
  ];
</script>

<DropdownMenu.Root>
  {#snippet trigger()}
    <div class="p-2 rounded-md hover:bg-accent">
      <LanguagesIcon class="size-6"/>
    </div>
  {/snippet}

  {#each locales as { locale, country } (locale)}
    <DropdownMenu.Item
      class="flex items-center gap-2"
      onclick={() => changeLocale(locale)}
    >
      <img
        class="size-7 rounded-sm"
        alt={country}
        src="/assets/flags/{country}.svg"
      />
      <span class="truncate">{$t('language', {}, { locale })}</span>

      {#if $language === locale}
        <span class="ml-auto">
          <CheckIcon class="size-4"/>
        </span>
      {/if}
    </DropdownMenu.Item>
  {/each}
</DropdownMenu.Root>
