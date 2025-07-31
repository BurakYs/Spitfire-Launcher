<script lang="ts">
  import { Combobox, type WithoutChildrenOrChild } from 'bits-ui';
  import { cn, t } from '$lib/utils/util';
  import ChevronsDownIcon from 'lucide-svelte/icons/chevrons-down';
  import ChevronsUpIcon from 'lucide-svelte/icons/chevrons-up';
  import ChevronsUpDownIcon from 'lucide-svelte/icons/chevrons-up-down';
  import CheckIcon from 'lucide-svelte/icons/check';
  import SearchIcon from 'lucide-svelte/icons/search';
  import type { ClassValue } from 'svelte/elements';

  type Item = { value: string; label: string };

  type Props = Combobox.RootProps & {
    items: Item[];
    placeholder?: string;
    maxSelections?: number;
    triggerClass?: ClassValue;
    inputProps?: WithoutChildrenOrChild<Combobox.InputProps>;
    contentProps?: WithoutChildrenOrChild<Combobox.ContentProps>;
    icon: any;
    // A temporary workaround, without this the search input inside the combobox doesn't work
    isGiftFriendSelection?: boolean
  };

  let {
    type,
    items,
    placeholder,
    maxSelections = Number.POSITIVE_INFINITY,
    value = $bindable(),
    open = $bindable(false),
    triggerClass,
    inputProps,
    contentProps,
    icon: Icon = SearchIcon,
    isGiftFriendSelection = false,
    ...restProps
  }: Props = $props();

  let searchValue = $state('');
  let customAnchor = $state<HTMLElement>();

  const filteredItems = $derived.by(() => {
    if (!searchValue) return items;
    return items.filter((item) => item.label.toLowerCase().includes(searchValue.toLowerCase()));
  });

  function handleInput(e: Event & { currentTarget: HTMLInputElement }) {
    searchValue = e.currentTarget.value;
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) searchValue = '';
  }
</script>

<Combobox.Root
  onOpenChange={handleOpenChange}
  type={type as never}
  bind:value={value as never}
  bind:open
  {...restProps}
>
  <Combobox.Trigger
    class={cn(
      'flex w-full items-center peer disabled:cursor-not-allowed disabled:opacity-50 rounded-lg bg-surface-alt',
      triggerClass
    )}
  >
    <div
      bind:this={customAnchor}
      class={cn(
        'rounded-lg inline-flex bg-transparent items-center text-muted-foreground w-full truncate border px-2 transition-colors h-11',
        'focus:ring-foreground focus:ring-offset-background focus:outline-hidden focus:ring-2 focus:ring-offset-2'
      )}
    >
      <Icon class="size-5"/>
      {#if isGiftFriendSelection}
        <Combobox.Input
          {placeholder}
          {...inputProps}
          class={cn(
            'w-full focus:outline-none ml-2',
            inputProps?.class
          )}
          oninput={handleInput}
        />
      {:else}
        <span class="ml-2">{placeholder || $t('combobox.selectItems')}</span>
      {/if}
      <ChevronsUpDownIcon class="text-muted-foreground size-5 ml-auto"/>
    </div>
  </Combobox.Trigger>

  <Combobox.Portal>
    <Combobox.Content
      class={cn(
        'bg-background shadow-popover outline-hidden z-50 select-none rounded-xl border p-1',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        'w-[var(--bits-combobox-anchor-width)] min-w-[var(--bits-combobox-anchor-width)] max-h-[var(--bits-combobox-content-available-height)]'
      )}
      {customAnchor}
      sideOffset={10}
      {...contentProps}
    >
      {#if !isGiftFriendSelection}
        <div class="flex items-center border-b mb-1 p-2 gap-2">
          <SearchIcon class="text-muted-foreground size-5"/>
          <Combobox.Input
            placeholder={$t('combobox.search')}
            {...inputProps}
            class={cn(
              'w-full text-sm bg-transparent grow focus:outline-none',
              inputProps?.class
            )}
            onclick={(e) => e.stopPropagation()}
            oninput={handleInput}
          />
        </div>
      {/if}

      <Combobox.ScrollUpButton class="flex w-full items-center justify-center">
        <ChevronsUpIcon class="size-3"/>
      </Combobox.ScrollUpButton>

      <Combobox.Viewport class="p-1">
        {#each filteredItems as item, i (i + item.value)}
          <Combobox.Item
            class="rounded-md outline-hidden flex h-10 w-full select-none items-center pl-3 text-sm cursor-pointer truncate data-highlighted:bg-muted data-disabled:opacity-50 data-disabled:cursor-default"
            disabled={item.disabled || (type === 'multiple' && (value?.length ||0) >= maxSelections && !value?.includes(item.value))}
            label={item.label}
            value={item.value}
          >
            {#snippet children({ selected })}
              <span class="truncate">{item.label}</span>
              {#if selected}
                <div class="ml-auto">
                  <CheckIcon class="size-4 mr-3"/>
                </div>
              {/if}
            {/snippet}
          </Combobox.Item>
        {:else}
          <span class="block px-5 py-2 text-sm text-muted-foreground">
            {$t('combobox.noResults')}
          </span>
        {/each}
      </Combobox.Viewport>

      <Combobox.ScrollDownButton class="flex w-full items-center justify-center">
        <ChevronsDownIcon class="size-3"/>
      </Combobox.ScrollDownButton>
    </Combobox.Content>
  </Combobox.Portal>
</Combobox.Root>