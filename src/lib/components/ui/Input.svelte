<script lang="ts">
  import Avatar from '$components/ui/Avatar.svelte';
  import { activeAccountStore as activeAccount } from '$lib/core/data-storage';
  import LookupManager from '$lib/core/managers/lookup';
  import { avatarCache, displayNamesCache } from '$lib/stores';
  import { cn } from '$lib/utils/util';
  import debounce from '$lib/utils/debounce';
  import { onMount } from 'svelte';
  import { cubicInOut } from 'svelte/easing';
  import type { HTMLInputAttributes } from 'svelte/elements';
  import { tv, type VariantProps } from 'tailwind-variants';
  import { slide } from 'svelte/transition';
  import { outsideClick } from '$lib/actions';

  const inputVariants = tv({
    base: cn(
      'w-full px-4 py-2 text-sm rounded-md transition-all border border-input appearance-none h-10 peer',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'focus:ring-offset-background focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foreground'
    ),
    variants: {
      variant: {
        primary: 'bg-surface-alt',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'bg-transparent text-input-foreground',
        ghost: 'bg-transparent text-input-foreground border-none'
      }
    },
    defaultVariants: {
      variant: 'primary'
    }
  });

  type InputProps = HTMLInputAttributes & VariantProps<typeof inputVariants> & {
    onConfirm?: (event: Event & { currentTarget: HTMLInputElement }) => void;
    nameAutocomplete?: boolean;
  };

  let {
    class: className,
    variant,
    value = $bindable<string>(),
    onConfirm,
    nameAutocomplete = false,
    onblur,
    onkeydown,
    type,
    ...restProps
  }: InputProps = $props();

  const initialValue = value || '';

  let inputElement = $state<HTMLInputElement>();
  let dropdownVisible = $state(false);
  let selectedItemId = $state<string>();

  const debouncedSearch = debounce(async (search: string) => {
    if (!nameAutocomplete || !$activeAccount || !search || search.length < 3) return;
    await LookupManager.searchByName($activeAccount, search);
  }, 500);

  const autocompleteData = $derived.by(() => {
    if (!nameAutocomplete || !value) return [];

    return Array.from(displayNamesCache.entries())
      .filter(([id, name]) => name.toLowerCase().includes(value.toLowerCase()) || id === value)
      .sort(([idA, nameA], [idB, nameB]) => {
        const isFriendA = avatarCache.has(idA);
        const isFriendB = avatarCache.has(idB);

        if (isFriendA && !isFriendB) return -1;
        if (!isFriendA && isFriendB) return 1;

        if (nameA === value || idA === value) return -1;
        if (nameB === value || idB === value) return 1;

        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      });
  });

  $effect(() => {
    const hasAutoComplete = !!(value && autocompleteData.length);
    dropdownVisible = hasAutoComplete && !selectedItemId;
  });

  function handleBlur(event: FocusEvent & { currentTarget: HTMLInputElement }) {
    if (event.currentTarget.value !== initialValue && onConfirm) {
      onConfirm(event);
    }
  }

  function handleKeyDown(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (event.currentTarget.value !== initialValue && event.key === 'Enter' && onConfirm) {
      onConfirm(event);
    }
  }

  function handleFocus() {
    if (value && autocompleteData.length) {
      dropdownVisible = true;
    }
  }

  function handleInput() {
    selectedItemId = undefined;

    if (value) {
      debouncedSearch(value);
    }
  }

  function handleSearchShortcut(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === 'f') {
      event.preventDefault();
      inputElement?.focus();
    }
  }

  if (onConfirm) {
    onblur = handleBlur;
    onkeydown = handleKeyDown;
  }

  if (type === 'search') {
    onMount(() => {
      document.addEventListener('keydown', handleSearchShortcut);

      return () => {
        document.removeEventListener('keydown', handleSearchShortcut);
      };
    });
  }
</script>

{#if nameAutocomplete}
  <div class="relative w-full" use:outsideClick={{ handler: () => dropdownVisible = false }}>
    <input
      {...restProps}
      bind:this={inputElement}
      class={cn(inputVariants({ variant }), className)}
      autocomplete="off"
      {onblur}
      onfocus={handleFocus}
      oninput={handleInput}
      {onkeydown}
      spellcheck="false"
      {type}
      bind:value
    />

    {#if dropdownVisible}
      <div
        class="absolute left-0 right-0 top-full mt-2 z-50 border border-muted bg-background shadow-popover rounded-md px-1 py-1.5 max-h-48 overflow-y-auto"
        transition:slide={{ duration: 150, easing: cubicInOut }}
      >
        {#each autocompleteData as [accountId, name] (accountId)}
          {@const fallbackAvatar = '/assets/misc/defaultOutfitIcon.png'}
          {@const avatar = avatarCache.get(accountId) || fallbackAvatar}

          <button
            class={cn(
              'flex items-center gap-2 w-full text-left px-4 py-2 text-sm truncate rounded-md',
              'hover:bg-accent hover:cursor-pointer transition-colors',
              className
            )}
            onclick={() => {
              value = name;
              selectedItemId = accountId;
              inputElement?.focus();
            }}
            type="button"
          >
            <Avatar alt={name} fallback={fallbackAvatar} imageClass="size-6" src={avatar}/>
            <span class="text-sm">{name}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <input
    {...restProps}
    bind:this={inputElement}
    class={cn(inputVariants({ variant }), className)}
    autocomplete="off"
    {onblur}
    onfocus={handleFocus}
    oninput={handleInput}
    {onkeydown}
    spellcheck="false"
    {type}
    bind:value
  />
{/if}