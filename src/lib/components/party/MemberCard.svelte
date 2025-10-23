<script lang="ts" module>
  export type PartyMember = {
    accountId: string;
    displayName: string;
    platformSpecificName?: string;
    avatarUrl: string;
    platform: string;
    ownsSaveTheWorld: boolean;
    isReady: boolean;
    isLeader: boolean;
    battlePassLevel: number;
    crownedWins: number;
    loadout: Array<{
      type: string;
      icon: string;
    }>;
  };
</script>

<script lang="ts">
  import { DropdownMenu } from '$components/ui/DropdownMenu';
  import ExternalLink from '$components/ui/ExternalLink.svelte';
  import { activeAccountStore } from '$lib/core/data-storage';
  import { accountPartiesStore } from '$lib/stores';
  import { nonNull, t } from '$lib/utils/util';
  import CrownIcon from '@lucide/svelte/icons/crown';
  import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
  import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
  import LogOutIcon from '@lucide/svelte/icons/log-out';
  import UserMinusIcon from '@lucide/svelte/icons/user-minus';
  import UserPlusIcon from '@lucide/svelte/icons/user-plus';
  import UserXIcon from '@lucide/svelte/icons/user-x';
  import type { SvelteSet } from 'svelte/reactivity';

  const activeAccount = $derived(nonNull($activeAccountStore));
  const currentAccountParty = $derived(accountPartiesStore.get(activeAccount.accountId));

  type Props = {
    member: PartyMember;
    canLeave: boolean;
    canKick: boolean;
    canBePromoted: boolean;
    canAddFriend: boolean;
    isAddingFriend: boolean;
    isRemovingFriend: boolean;
    isLeaving: boolean;
    kickingMemberIds: SvelteSet<string>;
    kickMember: (partyId: string, memberId: string) => void;
    leaveParty: (claimOnly?: boolean, accountId?: string) => void;
    sendFriendRequest: (memberId: string) => void;
    removeFriend: (memberId: string) => void;
    promotingMemberId?: string;
    promote: (memberId: string) => void;
  };

  const {
    member,
    canLeave,
    canKick,
    canBePromoted,
    canAddFriend,
    isAddingFriend,
    isRemovingFriend,
    isLeaving,
    kickingMemberIds,
    kickMember,
    leaveParty,
    sendFriendRequest,
    removeFriend,
    promotingMemberId,
    promote
  }: Props = $props();

  function hideImageOnError(event: Event) {
    const target = event.currentTarget as HTMLImageElement;
    target.style.display = 'none';
  }
</script>

<div class="flex flex-col gap-3 p-4 border rounded-md w-60 relative bg-surface-alt">
  {#if canLeave || canKick || canBePromoted}
    <div class="absolute top-3 right-3">
      <DropdownMenu.Root contentProps={{ class: 'min-w-48' }}>
        {#snippet trigger()}
          <EllipsisIcon class="size-6"/>
        {/snippet}

        {#if canLeave || canKick}
          <DropdownMenu.Item
            disabled={isLeaving || kickingMemberIds.has(member.accountId)}
            onclick={() => canKick
              ? kickMember(currentAccountParty?.id || '', member.accountId)
              : leaveParty(false, member.accountId)
            }
          >
            {#if canKick}
              {#if kickingMemberIds.has(member.accountId)}
                <LoaderCircleIcon class="size-5 animate-spin"/>
                {$t('partyManagement.partyMembers.kicking')}
              {:else}
                <UserXIcon class="size-5"/>
                {$t('partyManagement.partyMembers.kick')}
              {/if}
            {:else if canLeave}
              {#if isLeaving}
                <LoaderCircleIcon class="size-5 animate-spin"/>
                {$t('partyManagement.partyMembers.leavingParty')}
              {:else}
                <LogOutIcon class="size-5"/>
                {$t('partyManagement.partyMembers.leaveParty')}
              {/if}
            {/if}
          </DropdownMenu.Item>
        {/if}

        {#if canBePromoted}
          <DropdownMenu.Item
            disabled={!!promotingMemberId}
            onclick={() => promote(member.accountId)}
          >
            {#if promotingMemberId === member.accountId}
              <LoaderCircleIcon class="size-5 animate-spin"/>
              {$t('partyManagement.partyMembers.promoting')}
            {:else}
              <CrownIcon class="size-5"/>
              {$t('partyManagement.partyMembers.promote')}
            {/if}
          </DropdownMenu.Item>
        {/if}

        {#if member.accountId !== activeAccount.accountId}
          <DropdownMenu.Item
            disabled={isAddingFriend || isRemovingFriend}
            onclick={() => canAddFriend ? sendFriendRequest(member.accountId) : removeFriend(member.accountId)}
          >
            {#if canAddFriend}
              {#if isAddingFriend}
                <LoaderCircleIcon class="size-5 animate-spin"/>
                {$t('partyManagement.partyMembers.sendingFriendRequest')}
              {:else}
                <UserPlusIcon class="size-5"/>
                {$t('partyManagement.partyMembers.sendFriendRequest')}
              {/if}
            {:else if !canAddFriend}
              {#if isRemovingFriend}
                <LoaderCircleIcon class="size-5 animate-spin"/>
                {$t('partyManagement.partyMembers.removingFriend')}
              {:else}
                <UserMinusIcon class="size-5"/>
                {$t('partyManagement.partyMembers.removeFriend')}
              {/if}
            {/if}
          </DropdownMenu.Item>
        {/if}
      </DropdownMenu.Root>
    </div>
  {/if}

  <div class="flex items-center gap-2">
    <div class="size-10 relative">
      {#if member.avatarUrl}
        <img
          class="rounded-md"
          alt={member.displayName}
          onerror={hideImageOnError}
          src={member.avatarUrl}
        />
      {/if}

      {#if member.isLeader}
        <div class="absolute -bottom-2 -right-2 select-none" title="Leader">
          👑
        </div>
      {/if}
    </div>

    <ExternalLink
      class="flex items-center gap-2 font-medium hover:underline"
      href="https://fortnitedb.com/profile/{member.accountId}"
    >
      {#if member.platformSpecificName}
        <div class="flex flex-col">
          <div class="flex items-center gap-2">
            <span class="text-sm">{member.platformSpecificName}</span>
            <ExternalLinkIcon class="size-4 text-muted-foreground"/>
          </div>

          <span class="text-xs text-muted-foreground">
            ({member.displayName})
          </span>
        </div>
      {:else}
        <span class="text-sm">{member.displayName}</span>
        <ExternalLinkIcon class="size-4 text-muted-foreground"/>
      {/if}
    </ExternalLink>

  </div>

  <div class="flex-1 flex flex-col gap-4 text-sm">
    <div class="flex flex-col">
      <div class="flex items-center gap-1">
        <span class="text-muted-foreground">{$t('partyManagement.partyMembers.platform')}:</span>
        <span>{member.platform}</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="text-muted-foreground">{$t('partyManagement.partyMembers.ownsSTW')}:</span>
        <span>{member.ownsSaveTheWorld ? $t('common.yes') : $t('common.no')}</span>
      </div>
    </div>

    {#if member.loadout.length}
      <div class="flex flex-col gap-1">
        <span class="text-muted-foreground">{$t('partyManagement.partyMembers.loadout')}:</span>
        <div class="flex gap-1">
          {#each member.loadout as item (item.type)}
            <img
              class="size-8 rounded-md"
              alt={item.type}
              onerror={hideImageOnError}
              src={item.icon}
            />
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <div class="flex items-center justify-between">
    <div class="flex gap-2 text-sm font-medium">
      <div class="flex items-center gap-1">
        <img
          class="size-5"
          alt="Battle Pass Icon"
          src="/assets/misc/battle-pass-upgraded.png"
        />
        <span>{member.battlePassLevel}</span>
      </div>

      <div class="flex items-center gap-1">
        <img
          class="size-5"
          alt="Crown Icon"
          src="/assets/misc/crown.png"
        />
        <span>{member.crownedWins}</span>
      </div>
    </div>

    <div
      class={[
        'rounded-full px-3 py-1 text-sm font-medium',
        member.isReady ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
      ]}
    >
      {member.isReady
        ? $t('partyManagement.partyMembers.ready')
        : $t('partyManagement.partyMembers.notReady')
      }
    </div>
  </div>
</div>
