<script lang="ts" module>
  import { SvelteSet } from 'svelte/reactivity';

  let isKicking = $state(false);
  let isLeaving = $state(false);
  let isClaiming = $state(false);
  let isAddingFriend = $state(false);
  let isRemovingFriend = $state(false);

  let shouldClaimRewards = $state(false);
  let shouldTransferMaterials = $state(false);
  let shouldInvite = $state(false);

  let kickAllSelectedAccount = $state<string>('');
  let leavePartySelectedAccounts = $state<string[]>([]);
  let claimRewardsPartySelectedAccounts = $state<string[]>([]);

  let kickingMemberIds = new SvelteSet<string>();
  let promotingMemberId = $state<string>();
</script>

<script lang="ts">
  import PageContent from '$components/PageContent.svelte';
  import MemberCard, { type PartyMember } from '$components/party/MemberCard.svelte';
  import PartyAccountSelection from '$components/party/PartyAccountSelection.svelte';
  import Label from '$components/ui/Label.svelte';
  import Switch from '$components/ui/Switch.svelte';
  import Tabs from '$components/ui/Tabs.svelte';
  import { accountsStorage, activeAccountStore, language } from '$lib/core/data-storage';
  import { Separator } from 'bits-ui';
  import FriendsManager from '$lib/core/managers/friends';
  import XMPPManager from '$lib/core/managers/xmpp';
  import PartyManager from '$lib/core/managers/party';
  import AutoKickBase from '$lib/core/managers/autokick/base';
  import { accountPartiesStore, friendsStore } from '$lib/stores';
  import transferBuildingMaterials from '$lib/core/managers/autokick/transfer-building-materials';
  import claimRewards from '$lib/core/managers/autokick/claim-rewards';
  import { getResolvedResults, handleError, nonNull, sleep, t } from '$lib/utils/util';
  import { toast } from 'svelte-sonner';
  import type { AccountData } from '$types/accounts';
  import type { PartyData } from '$types/game/party';
  import { EpicEvents } from '$lib/constants/events';

  type Party = {
    maxSize: number;
    region: string;
    createdAt: Date;
  };

  const allAccounts = $derived(nonNull($accountsStorage.accounts));
  const activeAccount = $derived(nonNull($activeAccountStore));
  const currentAccountParty = $derived(accountPartiesStore.get(activeAccount.accountId));
  const isDoingSomething = $derived(isKicking || isLeaving || isClaiming);

  const partyData = $derived<Party | undefined>(currentAccountParty && {
    maxSize: currentAccountParty.config.max_size,
    region: currentAccountParty.meta['Default:RegionId_s'],
    createdAt: new Date(currentAccountParty.created_at)
  });

  const partyMembers = $derived<PartyMember[] | undefined>(currentAccountParty && currentAccountParty.members
    .map((member) => {
      const athenaCosmeticLoadout = parseJson(member.meta['Default:AthenaCosmeticLoadout_j'])?.AthenaCosmeticLoadout;
      const getSmallIcon = (id?: string, splitWith = '.') => id ? `https://fortnite-api.com/images/cosmetics/br/${id.split(splitWith)[1]}/smallicon.png` : '';

      return {
        accountId: member.account_id,
        displayName: member.meta['urn:epic:member:dn_s'] || '???',
        platformSpecificName: member.connections[0].meta['account_pl_dn'],
        avatarUrl: getSmallIcon(athenaCosmeticLoadout?.characterPrimaryAssetId, ':'),
        platform: member.connections[0].meta['urn:epic:conn:platform_s'],
        ownsSaveTheWorld: parseJson(member.meta['Default:PackedState_j']?.replaceAll('True', 'true'))?.PackedState?.hasPurchasedSTW || false,
        isReady: parseJson(member.meta['Default:LobbyState_j'])?.LobbyState?.gameReadiness === 'Ready',
        isLeader: member.role === 'CAPTAIN',
        battlePassLevel: parseJson(member.meta['Default:BattlePassInfo_j'])?.BattlePassInfo?.passLevel || 1,
        crownedWins: athenaCosmeticLoadout?.cosmeticStats?.find((x: any) => x.statName === 'TotalRoyalRoyales')?.value || 0,
        joinedAt: new Date(member.joined_at),
        loadout: [
          { type: 'outfit', icon: getSmallIcon(athenaCosmeticLoadout?.characterPrimaryAssetId, ':') },
          { type: 'backpack', icon: getSmallIcon(athenaCosmeticLoadout?.backpackDef) },
          { type: 'pickaxe', icon: getSmallIcon(athenaCosmeticLoadout?.pickaxeDef) },
          { type: 'contrail', icon: getSmallIcon(athenaCosmeticLoadout?.contrailDef) }
        ].filter((x) => !!x.icon)
      };
    })
    .sort((a, b) => {
      if (a.isLeader && !b.isLeader) return -1;
      if (!a.isLeader && b.isLeader) return 1;
      return b.joinedAt.getTime() - a.joinedAt.getTime();
    }));

  const partyLeaderAccount = $derived(allAccounts.find((account) => partyMembers?.some((member) => member.accountId === account.accountId && member.isLeader)));

  const tabs = $derived([
    { id: 'stwActions', name: $t('partyManagement.tabs.stwActions'), component: STWActions },
    { id: 'partyMembers', name: $t('partyManagement.tabs.partyMembers'), component: PartyMembers, disabled: !partyData && !partyMembers?.length }
  ]);

  function parseJson(string?: string) {
    try {
      return string ? JSON.parse(string) : {};
    } catch {
      return {};
    }
  }

  async function fetchPartyData(account: AccountData) {
    const cache = accountPartiesStore.get(account.accountId);
    if (cache) return cache;

    const partyResponse = await PartyManager.get(account);
    return partyResponse?.current[0];
  }

  async function kickAll() {
    if (!kickAllSelectedAccount) return;

    isKicking = true;

    try {
      const kickerAccount = allAccounts.find((account) => account.accountId === kickAllSelectedAccount);
      if (!kickerAccount) return;

      const partyData = await fetchPartyData(kickerAccount);
      if (!partyData) {
        toast.error($t('partyManagement.stwActions.notInParty'));
        return;
      }

      const partyMemberIds = partyData.members.map((x) => x.account_id).filter((id) => id !== kickAllSelectedAccount);
      const partyLeaderId = partyData.members.find((x) => x.role === 'CAPTAIN')!.account_id;
      if (partyLeaderId !== kickerAccount.accountId) {
        toast.error($t('partyManagement.stwActions.notLeader'));
        return;
      }

      await Promise.allSettled(partyMemberIds.map((id) => kickMember(partyData.id, id, kickerAccount)));

      await PartyManager.leave(kickerAccount, partyData.id);
      afterKickActions(kickerAccount.accountId).catch(() => null);

      toast.success($t('partyManagement.stwActions.kickedAll'));

      const members = partyData.members.filter((x) => x.account_id !== kickerAccount.accountId);
      if (shouldInvite) {
        inviteMembers(kickerAccount, members).catch(console.error);
      }
    } catch (error) {
      handleError(error, $t('partyManagement.stwActions.failedToKickAll'));
    } finally {
      isKicking = false;
    }
  }

  async function kickMember(partyId: string, memberId: string, kicker = partyLeaderAccount) {
    if (!kicker) return;

    kickingMemberIds.add(memberId);

    try {
      await PartyManager.kick(kicker, partyId, memberId);
      afterKickActions(memberId).catch(() => null);
    } catch (error) {
      handleError(error, $t('partyManagement.stwActions.failedToKickMember'));
    } finally {
      kickingMemberIds.delete(memberId);
    }
  }

  async function leaveParty(claimOnly = false, accountId?: string) {
    const selectedAccounts = accountId ? [accountId] : claimOnly ? claimRewardsPartySelectedAccounts : leavePartySelectedAccounts;
    if (!selectedAccounts?.length) return;

    if (claimOnly) {
      isClaiming = true;
    } else {
      isLeaving = true;
    }

    try {
      // eslint-disable-next-line svelte/prefer-svelte-reactivity -- This is not a reactive store
      const accountParties = new Map<string, string>();
      const accounts = allAccounts.filter((account) => selectedAccounts.includes(account.accountId));
      const registeredAccounts = allAccounts.map((account) => account.accountId);

      for (const account of accounts) {
        if (accountParties.has(account.accountId)) continue;

        const party = await fetchPartyData(account);
        if (!party) continue;

        for (const member of party.members) {
          if (registeredAccounts.includes(member.account_id)) {
            accountParties.set(member.account_id, party.id);
            accountPartiesStore.set(member.account_id, party);
          }
        }
      }

      await Promise.allSettled(Array.from(accountParties).map(async ([accountId, partyId]) => {
        const account = allAccounts.find((account) => account.accountId === accountId)!;

        if (!claimOnly) {
          const oldParty = accountPartiesStore.get(account.accountId);
          const oldMembers = oldParty?.members.filter((x) => x.account_id !== account.accountId) || [];
          await PartyManager.leave(account, partyId);

          if (shouldInvite && !claimOnly) {
            fetchPartyData(account).then((partyData) => {
              if (partyData) {
                inviteMembers(account, oldMembers).catch(console.error);
              }
            });
          }
        }

        afterKickActions(accountId, claimOnly).catch(() => null);
      }));

      toast.success(accountId
        ? $t('partyManagement.stwActions.leftParty')
        : claimOnly ? $t('partyManagement.stwActions.claimedRewards') : $t('partyManagement.stwActions.leftParties')
      );
    } catch (error) {
      handleError(error, claimOnly
        ? $t('partyManagement.stwActions.failedToClaimRewards')
        : $t('partyManagement.stwActions.failedToLeaveParties'));
    } finally {
      if (claimOnly) {
        isClaiming = false;
      } else {
        isLeaving = false;
      }
    }
  }

  async function inviteMembers(account: AccountData, members: PartyData['members']) {
    if (!members?.length) return;

    const xmpp = await XMPPManager.create(account, 'partyManagement');

    await xmpp.waitForEvent(EpicEvents.MemberJoined, (data) => data.account_id === account.accountId, 20000);
    await sleep(1000);

    const [partyData, friends] = await getResolvedResults([
      PartyManager.get(account),
      FriendsManager.getFriends(account)
    ]);

    const party = partyData?.current[0];

    if (!party || !friends?.length) return;

    const partyMemberIds = members.map((x) => x.account_id).filter((x) => x !== account.accountId);
    const friendsInParty = friends.filter((friend) => partyMemberIds.includes(friend.accountId));

    await Promise.allSettled(friendsInParty.map(async (friend) => {
      await PartyManager.invite(account, party.id, friend.accountId);
    }));
  }

  async function afterKickActions(memberId: string, claim = false) {
    const account = allAccounts.find((account) => account.accountId === memberId);
    if (!account) return;

    const settings = AutoKickBase.accounts.get(memberId)?.settings || {};
    const promises: Promise<unknown>[] = [];

    if (!settings.autoClaim && (claim || shouldClaimRewards)) {
      promises.push(claimRewards(account, true));
    }

    if (!settings.autoTransferMaterials && shouldTransferMaterials) {
      promises.push(transferBuildingMaterials(account, true));
    }

    return Promise.allSettled(promises).then((results) => {
      const rejected = results.filter((p) => p.status === 'rejected');
      for (const result of rejected) {
        console.error(result.reason);
      }
    });
  }

  async function promote(memberId: string) {
    promotingMemberId = memberId;

    try {
      const member = partyMembers?.find((m) => m.accountId === memberId);
      if (!member) return;

      await PartyManager.promote(partyLeaderAccount!, currentAccountParty!.id, memberId);
      toast.success($t('partyManagement.stwActions.promotedMember', { name: member.displayName }));
    } catch (error) {
      handleError(error, $t('partyManagement.stwActions.failedToPromoteMember'));
    } finally {
      promotingMemberId = undefined;
    }
  }

  async function sendFriendRequest(memberId: string) {
    isAddingFriend = true;

    try {
      await FriendsManager.addFriend(activeAccount, memberId);
    } catch (error) {
      handleError(error, $t('partyManagement.partyMembers.failedToSendFriendRequest'));
    } finally {
      isAddingFriend = false;
    }
  }

  async function removeFriend(memberId: string) {
    isRemovingFriend = true;

    try {
      await FriendsManager.removeFriend(activeAccount, memberId);
    } catch (error) {
      handleError(error, $t('partyManagement.partyMembers.failedToRemoveFriend'));
    } finally {
      isRemovingFriend = false;
    }
  }

  $effect(() => {
    fetchPartyData(activeAccount);
    XMPPManager.create(activeAccount, 'partyManagement').then((xmpp) => {
      xmpp.connect();
    });

    if (!$friendsStore[activeAccount.accountId]) {
      FriendsManager.getSummary(activeAccount);
    }
  });
</script>

<PageContent class="mt-2" title={$t('partyManagement.page.title')}>
  <Tabs {tabs}/>
</PageContent>

{#snippet STWActions()}
  <div class="flex flex-col gap-3">
    <div class="flex not-sm:flex-col justify-between sm:items-center gap-2">
      <div class="flex items-center justify-between gap-x-2">
        <Label for="shouldClaimRewards">{$t('partyManagement.stwActions.claimRewardsAfterLeaving')}</Label>
        <Switch id="shouldClaimRewards" bind:checked={shouldClaimRewards}/>
      </div>

      <Separator.Root class="bg-border h-6 w-px not-sm:hidden"/>

      <div class="flex items-center justify-between gap-x-2">
        <Label for="shouldTransferMaterials">{$t('partyManagement.stwActions.transferMaterialsAfterLeaving')}</Label>
        <Switch id="shouldTransferMaterials" bind:checked={shouldTransferMaterials}/>
      </div>

      <Separator.Root class="bg-border h-6 w-px not-sm:hidden"/>

      <div class="flex items-center justify-between gap-x-2">
        <Label for="inviteAfterLeaving">{$t('partyManagement.stwActions.inviteAfterLeaving')}</Label>
        <Switch id="inviteAfterLeaving" bind:checked={shouldInvite}/>
      </div>
    </div>

    <PartyAccountSelection
      disabled={isDoingSomething || !kickAllSelectedAccount}
      loading={isKicking}
      onclick={kickAll}
      type="single"
      bind:selected={kickAllSelectedAccount}
    >
      {$t('partyManagement.stwActions.kickAll')}
    </PartyAccountSelection>

    <Separator.Root class="bg-border h-px"/>

    <PartyAccountSelection
      disabled={isDoingSomething || !leavePartySelectedAccounts.length}
      loading={isLeaving}
      onclick={() => leaveParty()}
      type="multiple"
      bind:selected={leavePartySelectedAccounts}
    >
      {$t('partyManagement.stwActions.leaveParty')}
    </PartyAccountSelection>

    <Separator.Root class="bg-border h-px"/>

    <PartyAccountSelection
      disabled={isDoingSomething || !claimRewardsPartySelectedAccounts.length}
      loading={isClaiming}
      onclick={() => leaveParty(true)}
      type="multiple"
      bind:selected={claimRewardsPartySelectedAccounts}
    >
      {$t('partyManagement.stwActions.claimRewards')}
    </PartyAccountSelection>
  </div>
{/snippet}

{#snippet PartyMembers()}
  <div class="space-y-4">
    {#if partyData}
      <div>
        <div class="flex items-center gap-1">
          <span class="text-muted-foreground">{$t('partyManagement.partyMembers.size')}:</span>
          <span>{partyMembers?.length || 0}/{partyData.maxSize}</span>
        </div>

        <div class="flex items-center gap-1">
          <span class="text-muted-foreground">{$t('partyManagement.partyMembers.region')}:</span>
          <span>{partyData.region}</span>
        </div>

        <div class="flex items-center gap-1">
          <span class="text-muted-foreground">{$t('partyManagement.partyMembers.createdAt')}:</span>
          <span>{partyData.createdAt.toLocaleString($language)}</span>
        </div>
      </div>
    {/if}

    {#if partyMembers}
      <div class="grid gap-4 max-[40rem]:place-items-center min-[40rem]:grid-cols-2 min-[75rem]:grid-cols-3">
        {#each partyMembers as member (member.accountId)}
          {@const isRegisteredAccount = allAccounts.some((account) => account.accountId === member.accountId)}
          {@const canLeave = isRegisteredAccount && !member.isLeader}
          {@const canKick = partyLeaderAccount ? partyLeaderAccount.accountId !== member.accountId : false}
          {@const canBePromoted = partyLeaderAccount ? !member.isLeader : false}
          {@const accountFriends = $friendsStore[activeAccount.accountId]}
          {@const canAddFriend = !accountFriends?.friends?.has(member.accountId) && !accountFriends?.outgoing?.has(member.accountId)}

          <!-- Maybe this wasn't a good idea -->
          <MemberCard
            {canAddFriend}
            {canBePromoted}
            {canKick}
            {canLeave}
            {isAddingFriend}
            {isLeaving}
            {isRemovingFriend}
            {kickMember}
            {kickingMemberIds}
            {leaveParty}
            {member}
            {promote}
            {promotingMemberId}
            {removeFriend}
            {sendFriendRequest}
          />
        {/each}
      </div>
    {/if}
  </div>
{/snippet}