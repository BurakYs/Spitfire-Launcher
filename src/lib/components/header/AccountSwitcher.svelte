<script lang="ts">
  import { page } from '$app/state';
  import { accountsStorage, activeAccountStore } from '$lib/core/data-storage';
  import { MediaQuery } from 'svelte/reactivity';
  import Avatar from '$components/ui/Avatar.svelte';
  import ChevronDownIcon from 'lucide-svelte/icons/chevron-down';
  import PlusIcon from 'lucide-svelte/icons/plus';
  import LogOutIcon from 'lucide-svelte/icons/log-out';
  import CheckIcon from 'lucide-svelte/icons/check';
  import { DropdownMenu } from '$components/ui/DropdownMenu';
  import Account from '$lib/core/account';
  import type { AccountData } from '$types/accounts';
  import { avatarCache } from '$lib/stores';
  import { toast } from 'svelte-sonner';
  import LoginModal from '$components/login/LoginModal.svelte';
  import { cn, handleError, nonNull, t } from '$lib/utils/util';

  type PageState = {
    showLoginModal?: boolean;
  };

  const allAccounts = $derived(nonNull($accountsStorage.accounts));
  const activeAccount = $derived(nonNull($activeAccountStore));

  let dropdownOpen = $state(false);
  let searchTerm = $state<string>();
  let showLoginModal = $state(false);

  let isSmall = new MediaQuery('max-width: 640px');
  let dropdownSide: 'top' | 'right' = $derived(isSmall.current ? 'top' : 'right');

  $effect(() => {
    const pageState = page.state as PageState;
    showLoginModal = pageState.showLoginModal || false;
  });

  const filteredAccounts = $derived(searchTerm
    ? allAccounts.filter(account => account.displayName.toLowerCase().includes(searchTerm!.toLowerCase()))
    : allAccounts);

  function closeDropdown() {
    dropdownOpen = false;
  }

  async function changeAccounts(account: AccountData) {
    dropdownOpen = false;

    accountsStorage.update(settings => {
      settings.activeAccountId = account.accountI;
      return settings;
    });
  }

  function addNewAccount() {
    setTimeout(() => {
      showLoginModal = true;
    });
  }

  async function logout() {
    const accountName = activeAccount!.displayName || activeAccount!.accountId;
    const toastId = toast.loading($t('accountManager.loggingOut', { name: accountName }));

    try {
      await Account.removeAccount(activeAccount!.accountId);
      toast.success($t('accountManager.loggedOut', { name: accountName }), { id: toastId });
    } catch (error) {
      handleError(error, $t('accountManager.failedToLogout', { name: accountName }), toastId);
    }
  }

  function handleKeyPress(event: KeyboardEvent) {
    event.stopPropagation();

    if (event.key === 'Escape') {
      dropdownOpen = false;
    }
  }
</script>

<div class="relative">
  <DropdownMenu.Root
    contentProps={{ side: dropdownSide }}
    triggerClass="block w-full duration-0"
    bind:open={dropdownOpen}
  >
    {#snippet trigger()}
      <button class="flex items-center gap-3 px-3 py-2 rounded-md w-full transition-colors hover:bg-accent" onclick={closeDropdown}>
        <img
          class="size-8 rounded-full"
          alt={activeAccount?.displayName}
          src={(activeAccount && avatarCache.get(activeAccount.accountId)) || '/assets/misc/defaultOutfitIcon.png'}
        />
        <span class="font-medium truncate">{activeAccount?.displayName || $t('accountManager.noAccount')}</span>
        <ChevronDownIcon
          class={cn(
            'size-7 ml-auto transition-transform duration-200  hover:bg-muted rounded-md p-1',
            dropdownOpen ? dropdownSide === 'right' ? '-rotate-90' : 'rotate-180' : ''
          )}
        />
      </button>
    {/snippet}

    <div class="p-2">
      {#if allAccounts.length > 0}
        <input
          class="w-full px-3 py-2 text-sm rounded-md bg-input border-input focus:outline-none focus:ring-2 focus:ring-ring"
          onkeydown={handleKeyPress}
          onkeyup={handleKeyPress}
          placeholder={$t('accountManager.searchAccounts')}
          tabindex="-1"
          type="text"
          bind:value={searchTerm}
        />
      {/if}

      {#if filteredAccounts.length > 0}
        <div class="py-2 max-h-64 overflow-y-auto">
          {#each filteredAccounts as account (account.accountId)}
            {@const fallbackAvatar = '/assets/misc/defaultOutfitIcon.png'}
            {@const avatar = avatarCache.get(account.accountId) || fallbackAvatar}

            <DropdownMenu.Item class="duration-0" onclick={() => changeAccounts(account)}>
              <Avatar
                alt={account.displayName}
                fallback={fallbackAvatar}
                imageClass="size-7"
                src={avatar}
              />

              <span class="truncate">{account.displayName}</span>

              {#if activeAccount?.accountId === account.accountId}
                <CheckIcon class="size-5 ml-auto"/>
              {/if}
            </DropdownMenu.Item>
          {/each}
        </div>
      {/if}

      <div
        class={[
          'space-y-1',
          { 'pt-2': !!allAccounts.length },
          { 'border-t border-border': !!filteredAccounts.length }
        ]}
      >
        <DropdownMenu.Item onclick={addNewAccount}>
          <PlusIcon class="size-4 shrink-0"/>
          <span class="truncate">{$t('accountManager.login')}</span>
        </DropdownMenu.Item>

        {#if activeAccount}
          <DropdownMenu.Item
            class="hover:bg-destructive hover:text-destructive-foreground"
            onclick={logout}
          >
            <LogOutIcon class="size-4 shrink-0"/>
            <span class="truncate">{$t('accountManager.logout')}</span>
          </DropdownMenu.Item>
        {/if}
      </div>
    </div>
  </DropdownMenu.Root>
</div>

<LoginModal bind:open={showLoginModal}/>
