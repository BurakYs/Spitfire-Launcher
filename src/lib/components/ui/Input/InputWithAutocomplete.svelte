<script lang="ts">
  import { avatarCache, displayNamesCache } from '$lib/stores';
  import { activeAccountStore as activeAccount } from '$lib/core/data-storage';
  import Avatar from '$components/ui/Avatar.svelte';
  import Input, { type InputProps } from '$components/ui/Input/Input.svelte';
  import { DropdownMenu } from '$components/ui/DropdownMenu';
  import debounce from '$lib/utils/debounce';
  import LookupManager from '$lib/core/managers/lookup';

  let {
    class: className,
    value = $bindable<string>(),
    ...restProps
  }: InputProps = $props();

  let inputElement = $state<HTMLInputElement>();
  let dropdownAvailable = $state(true);
  let selectedItemId = $state<string>();

  const debouncedSearch = debounce(async (search: string) => {
    if (!$activeAccount || !search || search.length < 3) return;
    await LookupManager.searchByName($activeAccount, search);
  }, 500);

  const autocompleteData = $derived.by(() => {
    if (!value) return [];

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

  const hasAutoComplete = $derived(!!(value && autocompleteData.length));

  function handleInput() {
    selectedItemId = undefined;
    dropdownAvailable = true;

    if (value) {
      debouncedSearch(value);
    }
  }
</script>

<div class="relative w-full">
  <Input
    oninput={handleInput}
    bind:ref={inputElement}
    bind:value
    {...restProps}
  />

  <DropdownMenu.Root
    contentProps={{
      customAnchor: inputElement,
      class: "sm:max-h-64 max-h-48 overflow-y-auto",
      onOpenAutoFocus: (event) => event.preventDefault()
    }}
    bind:open={() => dropdownAvailable && hasAutoComplete && !selectedItemId, () => dropdownAvailable = false}
  >
    {#each autocompleteData as [accountId, name] (accountId)}
      {@const fallbackAvatar = '/assets/misc/defaultOutfitIcon.png'}
      {@const avatar = avatarCache.get(accountId) || fallbackAvatar}

      <DropdownMenu.Item
        class={className}
        onclick={() => {
          value = name;
          selectedItemId = accountId;
          inputElement?.focus();
        }}
      >
        <Avatar alt={name} fallback={fallbackAvatar} imageClass="size-6" src={avatar}/>
        <span class="text-sm">{name}</span>
      </DropdownMenu.Item>
    {/each}
  </DropdownMenu.Root>
</div>
