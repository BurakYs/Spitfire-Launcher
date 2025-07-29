<script lang="ts" module>
  import { SvelteSet } from 'svelte/reactivity';

  const accountsAdding = new SvelteSet<string>();
  const accountsRemoving = new SvelteSet<string>();
  const accountsBlocking = new SvelteSet<string>();
  const accountsUnblocking = new SvelteSet<string>();
</script>

<script lang="ts">
  import { activeAccountStore } from '$lib/core/data-storage';
  import FriendManager from '$lib/core/managers/friend';
  import { DropdownMenu } from '$components/ui/DropdownMenu';
  import { writeText } from '@tauri-apps/plugin-clipboard-manager';
  import CopyIcon from 'lucide-svelte/icons/copy';
  import EllipsisIcon from 'lucide-svelte/icons/ellipsis';
  import LoaderCircleIcon from 'lucide-svelte/icons/loader-circle';
  import UserPlusIcon from 'lucide-svelte/icons/user-plus';
  import UserMinusIcon from 'lucide-svelte/icons/user-minus';
  import BanIcon from 'lucide-svelte/icons/ban';
  import ShieldMinus from 'lucide-svelte/icons/shield-minus';
  import { avatarCache, displayNamesCache, friendsStore } from '$lib/stores';
  import { handleError, nonNull, t } from '$lib/utils/util';
  import type { BlockedAccountData, FriendData, IncomingFriendRequestData, OutgoingFriendRequestData } from '$types/game/friends';

  type Props = {
    listType: 'friends' | 'incoming' | 'outgoing' | 'blocklist';
    searchQuery?: string;
  };

  const {
    listType,
    searchQuery = $bindable()
  }: Props = $props();

  const activeAccount = $derived(nonNull($activeAccountStore));

  const list = $derived(Array.from($friendsStore[activeAccount.accountId]?.[listType]?.values() || [])
    .map((data: FriendData | IncomingFriendRequestData | OutgoingFriendRequestData | BlockedAccountData) => ({
      accountId: data.accountId,
      displayName: displayNamesCache.get(data.accountId) || data.accountId,
      nickname: 'alias' in data && data.alias,
      avatarUrl: avatarCache.get(data.accountId) || '/assets/misc/defaultOutfitIcon.png',
      createdAt: new Date(data.created)
    }))
    .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .filter((friend) => {
      if (!searchQuery) return true;

      const search = searchQuery.toLowerCase();
      return friend.displayName.toLowerCase().includes(search) || friend.accountId.toLowerCase().includes(search);
    })
  );

  async function acceptOrAddFriend(id: string) {
    accountsAdding.add(id);

    try {
      await FriendManager.addFriend(activeAccount, id);
    } catch (error) {
      handleError(error, $t('friendsManagement.failedToAdd'));
    } finally {
      accountsAdding.delete(id);
    }
  }

  async function denyOrRemoveFriend(id: string) {
    accountsRemoving.add(id);

    try {
      await FriendManager.removeFriend(activeAccount, id);
    } catch (error) {
      handleError(error, $t('friendsManagement.failedToRemove'));
    } finally {
      accountsRemoving.delete(id);
    }
  }

  async function blockUser(id: string) {
    accountsBlocking.add(id);

    try {
      await FriendManager.block(activeAccount, id);
    } catch (error) {
      handleError(error, $t('friendsManagement.failedToBlock'));
    } finally {
      accountsBlocking.delete(id);
    }
  }

  async function unblockUser(id: string) {
    accountsUnblocking.add(id);

    try {
      await FriendManager.unblock(activeAccount, id);
    } catch (error) {
      handleError(error, $t('friendsManagement.failedToUnblock'));
    } finally {
      accountsUnblocking.delete(id);
    }
  }
</script>

<div class="space-y-4">
  {#if list?.length}
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {#each list as friend (friend.accountId)}
        <div class="flex items-center justify-between p-4 rounded-md bg-accent text-accent-foreground">
          <div class="flex items-center gap-4">
            <img
              class="size-10 rounded-full"
              alt={friend.displayName}
              loading="lazy"
              src={friend.avatarUrl}
            />

            <div class="flex flex-col">
              <span class="font-medium break-all">{friend.displayName}</span>
              {#if friend.nickname}
                <span class="text-sm text-muted-foreground break-all">{friend.nickname}</span>
              {/if}
            </div>
          </div>

          <DropdownMenu.Root>
            {#snippet trigger()}
              <EllipsisIcon class="size-6 cursor-pointer"/>
            {/snippet}

            {@render CopyIdDropdownItem(friend.accountId)}

            {#if listType === 'friends'}
              {@render RemoveFriendDropdownItem(friend.accountId, 'friend')}
              {@render BlockDropdownItem(friend.accountId)}
            {:else if listType === 'incoming'}
              {@render AddFriendDropdownItem(friend.accountId)}
              {@render RemoveFriendDropdownItem(friend.accountId, 'incoming')}
              {@render BlockDropdownItem(friend.accountId)}
            {:else if listType === 'outgoing'}
              {@render RemoveFriendDropdownItem(friend.accountId, 'outgoing')}
              {@render BlockDropdownItem(friend.accountId)}
            {:else if listType === 'blocklist'}
              {@render UnblockDropdownItem(friend.accountId)}
            {/if}
          </DropdownMenu.Root>
        </div>
      {/each}
    </div>
  {:else}
    <div class="flex flex-col items-center justify-center p-4 gap-1">
      <div class="rounded-full bg-muted p-4 mb-2">
        <BanIcon class="size-10 text-muted-foreground"/>
      </div>

      <h3 class="text-xl font-medium">
        {#if listType === 'friends'}
          {$t('friendsManagement.noFriends')}
        {:else if listType === 'incoming'}
          {$t('friendsManagement.noIncomingRequests')}
        {:else if listType === 'outgoing'}
          {$t('friendsManagement.noOutgoingRequests')}
        {:else if listType === 'blocklist'}
          {$t('friendsManagement.noBlockedUsers')}
        {/if}
      </h3>
    </div>
  {/if}
</div>

{#snippet CopyIdDropdownItem(friendId: string)}
  <DropdownMenu.Item onclick={() => writeText(friendId)}>
    <CopyIcon class="size-5"/>
    {$t('friendsManagement.copyId')}
  </DropdownMenu.Item>
{/snippet}

{#snippet AddFriendDropdownItem(friendId: string)}
  <DropdownMenu.Item
    disabled={accountsAdding.has(friendId)}
    onclick={() => acceptOrAddFriend(friendId)}
  >
    {#if accountsAdding.has(friendId)}
      <LoaderCircleIcon class="size-5 animate-spin"/>
    {:else}
      <UserPlusIcon class="size-5"/>
    {/if}
    {$t('friendsManagement.acceptRequest')}
  </DropdownMenu.Item>
{/snippet}

{#snippet RemoveFriendDropdownItem(friendId: string, type: 'friend' | 'outgoing' | 'incoming')}
  <DropdownMenu.Item
    disabled={accountsRemoving.has(friendId)}
    onclick={() => denyOrRemoveFriend(friendId)}
  >
    {#if accountsRemoving.has(friendId)}
      <LoaderCircleIcon class="size-5 animate-spin"/>
    {:else}
      <UserMinusIcon class="size-5"/>
    {/if}
    {type === 'friend' ? $t('friendsManagement.removeFriend') : type === 'outgoing' ? $t('friendsManagement.cancelRequest') : $t('friendsManagement.denyRequest')}
  </DropdownMenu.Item>
{/snippet}

{#snippet BlockDropdownItem(accountId: string)}
  <DropdownMenu.Item
    disabled={accountsBlocking.has(accountId)}
    onclick={() => blockUser(accountId)}
  >
    {#if accountsBlocking.has(accountId)}
      <LoaderCircleIcon class="size-5 animate-spin"/>
    {:else}
      <BanIcon class="size-5"/>
    {/if}
    {$t('friendsManagement.blockUser')}
  </DropdownMenu.Item>
{/snippet}

{#snippet UnblockDropdownItem(accountId: string)}
  <DropdownMenu.Item
    disabled={accountsUnblocking.has(accountId)}
    onclick={() => unblockUser(accountId)}
  >
    {#if accountsUnblocking.has(accountId)}
      <LoaderCircleIcon class="size-5 animate-spin"/>
    {:else}
      <ShieldMinus class="size-5"/>
    {/if}
    {$t('friendsManagement.unblockUser')}
  </DropdownMenu.Item>
{/snippet}