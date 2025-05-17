<script lang="ts">
  import { page } from '$app/state';
  import Avatar from '$components/ui/Avatar.svelte';
  import ChevronDownIcon from 'lucide-svelte/icons/chevron-down';
  import PlusIcon from 'lucide-svelte/icons/plus';
  import LogOutIcon from 'lucide-svelte/icons/log-out';
  import CheckIcon from 'lucide-svelte/icons/check';
  import Button from '$components/ui/Button.svelte';
  import { DropdownMenu } from '$components/ui/DropdownMenu';
  import Account from '$lib/core/account';
  import type { AccountData } from '$types/accounts';
  import { accountsStore, avatarCache } from '$lib/stores';
  import { toast } from 'svelte-sonner';
  import LoginModal from '$components/login/LoginModal.svelte';
  import { t } from '$lib/utils/util';

  type PageState = {
    showLoginModal?: boolean;
  };

  const { allAccounts, activeAccount } = $derived($accountsStore);

  let dropdownOpen = $state(false);
  let searchTerm = $state<string>();
  let showLoginModal = $state(false);

  $effect(() => {
    showLoginModal = (page.state as PageState).showLoginModal || false;
  });

  const filteredAccounts = $derived(searchTerm
    ? allAccounts.filter(account => account.displayName.toLowerCase().includes(searchTerm!.toLowerCase()))
    : allAccounts);

  function toggleDropdown() {
    dropdownOpen = !dropdownOpen;
  }

  async function changeAccounts(account: AccountData) {
    dropdownOpen = false;

    try {
      await Account.changeActiveAccount(account.accountId);
    } catch (error) {
      console.error(error);
      toast.error($t('accountManager.failedToSwitch', { name: account.displayName }));
    }
  }

  function addNewAccount() {
    showLoginModal = true;
  }

  async function logout() {
    const accountName = activeAccount!.displayName || activeAccount!.accountId;

    toast.promise(Account.logout(), {
      loading: $t('accountManager.loggingOut', { name: accountName }),
      success: $t('accountManager.loggedOut', { name: accountName }),
      error: (error) => {
        console.error(error);
        return $t('accountManager.failedToLogout', { name: accountName });
      }
    });
  }

  function handleKeyPress(event: KeyboardEvent) {
    event.stopPropagation();

    if (event.key === 'Escape') {
      dropdownOpen = false;
    }
  }
</script>

<div class="relative">
  <DropdownMenu.Root bind:open={dropdownOpen}>
    {#snippet trigger()}
      <Button
        class="flex justify-center items-center gap-x-2 border-input h-10 border max-w-48 truncate"
        onclick={toggleDropdown}
        variant="accent"
      >
        <span class="truncate">{activeAccount?.displayName || $t('accountManager.noAccount')}</span>
        <ChevronDownIcon class="size-5 transition-transform duration-200 {dropdownOpen ? 'rotate-180' : ''}"/>
      </Button>
    {/snippet}

    <div class="p-2">
      {#if allAccounts.length > 0}
        <input
          class="w-full px-3 py-2 text-sm rounded-md bg-input border-input focus:outline-none focus:ring-2 focus:ring-ring"
          onkeydown={handleKeyPress}
          onkeyup={handleKeyPress}
          placeholder={$t('accountManager.searchAccounts')}
          type="text"
          bind:value={searchTerm}
        />
      {/if}

      {#if filteredAccounts.length > 0}
        <div class="py-2 max-h-64 overflow-y-auto">
          {#each filteredAccounts as account (account.accountId)}
            {@const fallbackAvatar = '/assets/misc/defaultOutfitIcon.png'}
            {@const avatar = avatarCache.get(account.accountId) || fallbackAvatar}

            <DropdownMenu.Item onclick={() => changeAccounts(account)}>
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
          { 'pt-2': allAccounts.length },
          { 'border-t border-border': filteredAccounts.length }
        ]}
      >
        <DropdownMenu.Item onclick={addNewAccount}>
          <PlusIcon class="size-4"/>
          {$t('accountManager.login')}
        </DropdownMenu.Item>

        {#if activeAccount}
          <DropdownMenu.Item
            class="hover:bg-destructive hover:text-destructive-foreground"
            onclick={logout}
          >
            <LogOutIcon class="size-4"/>
            {$t('accountManager.logout')}
          </DropdownMenu.Item>
        {/if}
      </div>
    </div>
  </DropdownMenu.Root>
</div>

<LoginModal bind:open={showLoginModal}/>
