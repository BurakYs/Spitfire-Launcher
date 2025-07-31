<script lang="ts" module>
  export type Friend = {
    accountId: string;
    displayName: string;
    nickname?: string;
    avatarUrl: string;
    createdAt: Date;
  };

  export type ListType = 'friends' | 'incoming' | 'outgoing' | 'blocklist';
</script>

<script lang="ts">
  import { activeAccountStore } from '$lib/core/data-storage';
  import BanIcon from 'lucide-svelte/icons/ban';
  import { avatarCache, displayNamesCache, friendsStore } from '$lib/stores';
  import { nonNull, t } from '$lib/utils/util';
  import type { BlockedAccountData, FriendData, IncomingFriendRequestData, OutgoingFriendRequestData } from '$types/game/friends';
  import FriendCard from '$components/friends/FriendCard.svelte';

  type Props = {
    listType: ListType;
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
      nickname: 'alias' in data ? data.alias : undefined,
      avatarUrl: avatarCache.get(data.accountId) || '/assets/misc/defaultOutfitIcon.png',
      createdAt: new Date(data.created)
    }))
    .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .filter((friend) => {
      if (!searchQuery) return true;

      const search = searchQuery.toLowerCase();
      return friend.displayName.toLowerCase().includes(search) || friend.accountId.toLowerCase().includes(search);
    }) satisfies Friend[]
  );
</script>

{#if list?.length}
  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
    {#each list as friend (friend.accountId)}
      <FriendCard {friend} {listType}/>
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
