<script lang="ts" module>
  import type { DailyQuest } from '$components/lookup-players/DailyQuestAccordion.svelte';
  import type { LoadoutData, MissionData, MissionPlayers } from '$components/lookup-players/STWDetails.svelte';
  import { FounderEditions, gadgets, heroes, teamPerks } from '$lib/constants/stw/resources';

  type FounderEdition = typeof FounderEditions[keyof typeof FounderEditions];

  type STWData = {
    commanderLevel: {
      current: number;
      pastMaximum: number;
    };
    founderEdition: FounderEdition | null;
    xpBoosts: {
      boostedXp: number;
      boostAmount: number;
    };
    claimedMissionAlertIds: Set<string>;
  };

  let isLoading = $state(false);
  let heroLoadoutPage = $state(1);
  let lookupData = $state<{ accountId: string; displayName: string; }>();
  let stwData = $state<STWData>();
  let missionPlayers = $state<MissionPlayers>([]);
  let mission = $state<MissionData>();
  let loadoutData = $state<LoadoutData[]>([]);
  let dailyQuests = $state<DailyQuest[]>([]);
</script>

<script lang="ts">
  import DailyQuestAccordion from '$components/lookup-players/DailyQuestAccordion.svelte';
  import STWDetails from '$components/lookup-players/STWDetails.svelte';
  import ExternalLink from '$components/ui/ExternalLink.svelte';
  import WorldInfoSectionAccordion from '$components/ui/Accordion/WorldInfoSectionAccordion.svelte';
  import { activeAccountStore, language } from '$lib/core/data-storage';
  import MatchmakingManager from '$lib/core/managers/matchmaking';
  import { avatarCache, worldInfoCache } from '$lib/stores';
  import { dailyQuests as dailyQuestsResource } from '$lib/constants/stw/resources';
  import Button from '$components/ui/Button.svelte';
  import InputWithAutocomplete from '$components/ui/Input/InputWithAutocomplete.svelte';
  import { Separator } from 'bits-ui';
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
  import SearchIcon from '@lucide/svelte/icons/search';
  import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
  import LookupManager from '$lib/core/managers/lookup';
  import { toast } from 'svelte-sonner';
  import { handleError, nonNull, t } from '$lib/utils/util';
  import type { CampaignProfile, ProfileItem } from '$types/game/mcp';
  import MCPManager from '$lib/core/managers/mcp';
  import { FounderEditionNames, RarityTypes, zoneThemes } from '$lib/constants/stw/resources';

  const activeAccount = $derived(nonNull($activeAccountStore));
  const claimedMissionAlerts = $derived.by(() => {
    if (!$worldInfoCache.size || !stwData?.claimedMissionAlertIds?.size) {
      return [];
    }

    const result = [];

    for (const worldMissions of $worldInfoCache.values()) {
      for (const mission of worldMissions.values()) {
        if (mission.alert && stwData.claimedMissionAlertIds.has(mission.alert.guid)) {
          result.push(mission);
        }
      }
    }

    return result;
  });

  let searchQuery = $state<string>();

  async function lookupPlayer(event: SubmitEvent) {
    event.preventDefault();

    if (!searchQuery?.trim()) return;

    isLoading = true;
    resetData();

    try {
      const internalLookupData = await LookupManager.fetchByNameOrId(activeAccount, searchQuery);

      const [stwDataResult, matchmakingDataResult] = await Promise.allSettled([
        getSTWData(internalLookupData.accountId),
        getMatchmakingData(internalLookupData.accountId)
      ]);

      if (stwDataResult.status === 'rejected') {
        console.error(stwDataResult.reason);
        toast.error($t('lookupPlayers.stwStatsPrivate'));
      }

      if (matchmakingDataResult.status === 'rejected') {
        console.error(matchmakingDataResult.reason);
      }

      lookupData = internalLookupData;
    } catch (error) {
      handleError(error, $t('lookupPlayers.notFound'));
    } finally {
      isLoading = false;
    }
  }

  async function getSTWData(accountId: string) {
    const queryPublicProfile = await MCPManager.queryPublicProfile(activeAccount, accountId, 'campaign');
    const profile = queryPublicProfile.profileChanges[0].profile;
    const items = Object.entries(profile.items);
    const attributes = profile.stats.attributes;

    const claimedMissionAlerts = attributes.mission_alert_redemption_record?.claimData
      ?.sort((a, b) => new Date(b.redemptionDateUtc).getTime() - new Date(a.redemptionDateUtc).getTime())
      .map((claimData) => claimData.missionAlertId) || [];

    stwData = {
      commanderLevel: {
        current: attributes.level,
        pastMaximum: attributes.rewards_claimed_post_max_level || 0
      },
      founderEdition: getFounderEdition(Object.values(profile.items)),
      xpBoosts: getXPBoosts(Object.values(profile.items)),
      claimedMissionAlertIds: new Set(claimedMissionAlerts)
    };

    loadoutData = [];

    for (const [itemGuid, itemData] of items) {
      if (itemData.attributes.loadout_index != null) {
        handleLoadoutItem(profile, itemGuid, itemData);
      }

      if (itemData.templateId.startsWith('Quest:') && itemData.attributes.quest_state === 'Active') {
        handleQuestItem(profile, itemGuid, itemData);
      }
    }
  }

  function handleLoadoutItem(profile: CampaignProfile, itemId: string, itemData: ProfileItem) {
    const profileAttributes = profile.stats.attributes;
    const isSelectedLoadout = profileAttributes.selected_hero_loadout === itemId;
    if (isSelectedLoadout) {
      heroLoadoutPage = itemData.attributes.loadout_index + 1;
    }

    const selectedCommander = profile.items[itemData.attributes.crew_members.commanderslot];
    const heroId = selectedCommander?.templateId.replace('Hero:', '').split('_').slice(0, -2).join('_').toLowerCase();
    const teamPerkId = profile.items[itemData.attributes.team_perk]?.templateId.split('_')[1];

    const supportTeam = Object.entries(itemData.attributes.crew_members)
      .filter(([key]) => key.startsWith('followerslot'))
      .map(([, value]) => profile.items[value as string]?.templateId)
      .filter(x => !!x);

    loadoutData.push({
      guid: itemId,
      selected: isSelectedLoadout,
      index: itemData.attributes.loadout_index,
      commander: heroes[heroId] ? {
        name: heroes[heroId].name,
        icon: `/assets/heroes/${heroId}.png`,
        rarity: Object.values(RarityTypes).find((rarity) => selectedCommander.templateId.toLowerCase().includes(`_${rarity}_`))!
      } : undefined,
      teamPerk: teamPerkId && teamPerks[teamPerkId] ? {
        name: teamPerks[teamPerkId].name,
        icon: `/assets/perks/${teamPerks[teamPerkId].icon}`
      } : undefined,
      supportTeam: supportTeam.map((id) => {
        const heroId = id.replace('Hero:', '').split('_').slice(0, -2).join('_').toLowerCase();
        const rarity = Object.values(RarityTypes).find((rarity) => id.toLowerCase().includes(`_${rarity}_`))!;

        return {
          name: heroes[heroId].name,
          icon: `/assets/heroes/${heroId}.png`,
          rarity
        };
      }),
      gadgets: (itemData.attributes.gadgets as any[])
        ?.sort((a, b) => a.slot_index - b.slot_index)
        .filter((gadget) => gadgets[gadget.gadget.split('_').at(-1)])
        .map((data) => {
          const id = data.gadget.split('_').at(-1);

          return {
            name: gadgets[id].name,
            icon: `/assets/gadgets/${gadgets[id].icon}`
          };
        })
    });

    loadoutData = loadoutData.sort((a, b) => a.index - b.index);
  }

  function handleQuestItem(profile: CampaignProfile, itemId: string, itemData: ProfileItem) {
    const quest = dailyQuestsResource[itemData.templateId.split(':')[1].toLowerCase()];
    if (!quest) return;

    const hasFounder = Object.values(profile.items).some((item) => item.templateId === 'Token:receivemtxcurrency');

    const completionKey = Object.keys(itemData.attributes).find((attr) => attr.includes('completion'))!;
    const completionProgress = itemData.attributes[completionKey] || 0;

    dailyQuests.push({
      ...quest,
      id: itemId,
      completionProgress,
      hasFounder
    });
  }

  async function getMatchmakingData(accountId: string) {
    const [matchmakingData] = await MatchmakingManager.findPlayer(activeAccount, accountId);
    if (!matchmakingData) return;

    const zoneData = matchmakingData.attributes.ZONEINSTANCEID_s && JSON.parse(matchmakingData.attributes.ZONEINSTANCEID_s);
    if (zoneData) {
      const theaterData = $worldInfoCache?.get(zoneData.theaterId);
      const missionData = theaterData?.get(zoneData.theaterMissionId);
      const isStormShield = zoneData.zoneThemeClass.includes('TheOutpost');

      mission = {
        nameId: isStormShield ? 'storm-shield' : missionData?.zone.type.id,
        icon: isStormShield ? '/assets/world/storm-shield.png' : missionData?.zone.type.imageUrl,
        powerLevel: missionData?.powerLevel,
        zone: zoneThemes[missionData?.zone.theme?.split('.')[1].toLowerCase() as never],
        theaterId: zoneData.theaterId
      };
    }

    const playerNames = await LookupManager.fetchByIds(activeAccount, matchmakingData.publicPlayers);
    missionPlayers = playerNames.map((player) => ({
      accountId: player.id,
      name: player.displayName
    }));
  }

  function getFounderEdition(items: ProfileItem[]): FounderEdition | null {
    const editions = Object.entries(FounderEditions).toReversed();

    for (const [, templateId] of editions) {
      const edition = items.find((item) => item.templateId === templateId);
      if (edition) return templateId;
    }

    return items.find((item) => item.templateId === 'Token:receivemtxcurrency')
      ? FounderEditions.Standard
      : null;
  }

  function getXPBoosts(items: ProfileItem[]) {
    const boostedXp = items.find((item) => item.templateId === 'Token:xpboost')?.quantity || 0;
    const boostAmount = Math.round(boostedXp / 864191);
    return { boostedXp, boostAmount };
  }

  function resetData() {
    lookupData = undefined;
    stwData = undefined;
    missionPlayers = [];
    mission = undefined;
    loadoutData = [];
    dailyQuests = [];
    heroLoadoutPage = 1;
  }
</script>

<div class="flex flex-col items-center justify-center min-w-full min-h-full space-y-4">
  <form class="flex items-center gap-2 w-80" onsubmit={lookupPlayer}>
    <InputWithAutocomplete
      autofocus={true}
      disabled={isLoading}
      placeholder={$t('lookupPlayers.search')}
      type="search"
      bind:value={searchQuery}
    />

    <Button
      class="flex items-center justify-center size-9"
      disabled={isLoading || !searchQuery || searchQuery.length < 3}
      size="sm"
      type="submit"
      variant="epic"
    >
      {#if isLoading}
        <LoaderCircleIcon class="size-5 animate-spin"/>
      {:else}
        <SearchIcon class="size-5"/>
      {/if}
    </Button>
  </form>

  {#if lookupData}
    {@const kv = [
      {
        name: $t('lookupPlayers.playerInfo.id'),
        value: lookupData.accountId
      },
      {
        name: $t('lookupPlayers.playerInfo.name'),
        value: lookupData.displayName,
        href: `https://fortnitedb.com/profile/${lookupData.accountId}`
      },
      {
        name: $t('lookupPlayers.playerInfo.commanderLevel'),
        value: stwData && `${stwData.commanderLevel.current} ${stwData.commanderLevel.pastMaximum ? `(+${stwData.commanderLevel.pastMaximum})` : ''}`
      },
      {
        name: $t('lookupPlayers.playerInfo.boostedXp', { count: stwData?.xpBoosts.boostedXp }),
        value: stwData &&
          `${stwData.xpBoosts.boostedXp.toLocaleString($language)} ${stwData.xpBoosts.boostAmount ? `(${$t('lookupPlayers.playerInfo.boostCount', { count: stwData.xpBoosts.boostAmount })})` : ''}`
      },
      {
        name: $t('lookupPlayers.playerInfo.founderEdition'),
        value: !stwData ? null : stwData.founderEdition
          ? $FounderEditionNames[stwData.founderEdition]
          : $t('common.stw.founderEditions.none')
      }
    ]}

    <div class="space-y-4 text-sm relative border p-5 rounded-md min-w-72 sm:min-w-80 xs:min-w-96 bg-surface-alt">
      <div class="flex gap-4 items-start">
        {#if avatarCache.has(lookupData.accountId)}
          <img class="hidden xs:block size-20 rounded-md self-center" alt={lookupData.displayName} src={avatarCache.get(lookupData.accountId)}/>
        {/if}

        <div class="flex-1">
          {#each kv as { name, value, href } (name)}
            {#if value != null}
              <div class="flex items-center gap-1">
                {#if href}
                  <ExternalLink class="flex items-center gap-1" href={href}>
                    <span class="text-muted-foreground">{name}:</span>
                    <span>{value}</span>
                    <ExternalLinkIcon class="size-4 text-muted-foreground"/>
                  </ExternalLink>
                {:else}
                  <span class="text-muted-foreground">{name}:</span>
                  <span>{value}</span>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      </div>

      <STWDetails {heroLoadoutPage} {loadoutData} {mission} {missionPlayers}/>

      {#if stwData && stwData?.claimedMissionAlertIds.size > 0 && claimedMissionAlerts && claimedMissionAlerts.length > 0}
        <Separator.Root class="bg-border h-px"/>

        <h3 class="text-lg font-semibold text-center">{$t('lookupPlayers.claimedAlerts.title')}</h3>

        <WorldInfoSectionAccordion
          claimedMissionAlerts={stwData?.claimedMissionAlertIds}
          missions={claimedMissionAlerts}
          showAlertClaimedBorder={false}
        />
      {/if}

      {#if stwData && dailyQuests.length > 0}
        <Separator.Root class="bg-border h-px"/>

        <h3 class="text-lg font-semibold text-center">{$t('lookupPlayers.dailyQuests.title')}</h3>

        <DailyQuestAccordion {dailyQuests}/>
      {/if}
    </div>
  {/if}
</div>