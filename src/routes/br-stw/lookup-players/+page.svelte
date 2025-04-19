<script lang="ts" module>
  import { FounderEditions, gadgets, heroes, teamPerks } from '$lib/constants/stw/resources';
  import { Theaters, ZoneNames } from '$lib/constants/stw/worldInfo';
  import type { RarityType, ZoneThemeData } from '$types/game/stw/resources';

  type FounderEdition = typeof FounderEditions[keyof typeof FounderEditions];
  type Theater = typeof Theaters[keyof typeof Theaters];

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

  type MissionPlayers = Array<{
    accountId: string;
    name: string;
  }>;

  type MissionData = {
    nameId?: string;
    icon?: string;
    powerLevel?: number;
    zone?: ZoneThemeData;
    theaterId: Theater;
  };

  type LoadoutData = {
    guid: string;
    selected?: boolean;
    index: number;
    commander?: {
      name: string;
      icon: string;
      rarity: RarityType;
    };
    teamPerk?: {
      name: string;
      icon: string;
    };
    supportTeam?: Array<{
      name: string;
      icon: string;
      rarity: RarityType;
    }>;
    gadgets?: Array<{
      name: string;
      icon: string;
    }>;
  };

  let isLoading = $state(false);
  let heroLoadoutPage = $state(1);
  let lookupData = $state<{ accountId: string; displayName: string; avatarUrl?: string }>();
  let stwData = $state<STWData>();
  let missionPlayers = $state<MissionPlayers>();
  let mission = $state<MissionData>();
  let loadoutData = $state<LoadoutData[]>();
</script>

<script lang="ts">
  import CenteredPageContent from '$components/CenteredPageContent.svelte';
  import WorldInfoSectionAccordion from '$components/stw/worldInfo/WorldInfoSectionAccordion.svelte';
  import Pagination from '$components/ui/Pagination.svelte';
  import { TheaterNames } from '$lib/constants/stw/worldInfo';
  import MatchmakingManager from '$lib/core/managers/matchmaking';
  import { accountsStore, language, worldInfoCache } from '$lib/stores';
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import { Separator } from 'bits-ui';
  import ExternalLinkIcon from 'lucide-svelte/icons/external-link';
  import SearchIcon from 'lucide-svelte/icons/search';
  import LoaderCircleIcon from 'lucide-svelte/icons/loader-circle';
  import LookupManager from '$lib/core/managers/lookup';
  import { toast } from 'svelte-sonner';
  import { nonNull, shouldErrorBeIgnored, t } from '$lib/utils/util';
  import type { ProfileItem } from '$types/game/mcp';
  import MCPManager from '$lib/core/managers/mcp';
  import { FounderEditionNames, RarityColors, RarityTypes, zoneThemes } from '$lib/constants/stw/resources';

  const activeAccount = $derived(nonNull($accountsStore.activeAccount));
  const selectedHeroLoadout = $derived(loadoutData?.[heroLoadoutPage - 1]);

  const claimedMisssionAlerts = $derived($worldInfoCache && stwData?.claimedMissionAlertIds.size &&
    Array.from($worldInfoCache.values())
      .flatMap((worldMissions) => Array.from(worldMissions.values()))
      .filter((mission) => mission.alert && stwData?.claimedMissionAlertIds.has(mission.alert.guid))
  );

  let searchQuery = $state<string>();

  async function lookupPlayer(event: SubmitEvent) {
    event.preventDefault();

    if (!searchQuery?.trim()) return;

    isLoading = true;
    resetData();

    try {
      const internalLookupData = await LookupManager.fetchByNameOrId(activeAccount, searchQuery);
      if (!internalLookupData?.accountId) return;

      try {
        await getSTWData(internalLookupData.accountId);
      } catch (error) {
        console.error(error);
        toast.error($t('lookupPlayers.stwStatsPrivate'));
      }

      try {
        await getMatchmakingData(internalLookupData.accountId);
      } catch (error) {
        console.error(error);
      }

      lookupData = internalLookupData;
    } catch (error) {
      if (shouldErrorBeIgnored(error)) return;

      console.error(error);
      toast.error($t('lookupPlayers.notFound'));
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
      if (itemData.attributes.loadout_index == null) continue;

      const isSelectedLoadout = attributes.selected_hero_loadout === itemGuid;
      const selectedCommander = profile.items[itemData.attributes.crew_members.commanderslot];
      const heroId = selectedCommander?.templateId.replace('Hero:', '').split('_').slice(0, -2).join('_').toLowerCase();
      const teamPerkId = profile.items[itemData.attributes.team_perk]?.templateId.split('_')[1];

      const supportTeam = Object.entries(itemData.attributes.crew_members)
        .filter(([key]) => key.startsWith('followerslot'))
        .map(([, value]) => profile.items[value as string]?.templateId)
        .filter(x => !!x);

      if (isSelectedLoadout) heroLoadoutPage = itemData.attributes.loadout_index + 1;

      loadoutData.push({
        guid: itemGuid,
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
        gadgets: itemData.attributes.gadgets
          ?.sort((a: any, b: any) => a.slot_index - b.slot_index)
          .filter((gadget: any) => gadgets[gadget.gadget.split('_').at(-1)])
          .map((data: any) => {
            const id = data.gadget.split('_').at(-1);

            return {
              name: gadgets[id].name,
              icon: `/assets/gadgets/${gadgets[id].icon}`
            };
          })
      });
    }

    loadoutData = loadoutData.sort((a, b) => a.index - b.index);
  }

  async function getMatchmakingData(accountId: string) {
    const [matchmakingData] = await MatchmakingManager.findPlayer(activeAccount, accountId);
    if (!matchmakingData) return;

    const zoneData = matchmakingData.attributes.ZONEINSTANCEID_s && JSON.parse(matchmakingData.attributes.ZONEINSTANCEID_s);
    if (zoneData) {
      const theaterData = $worldInfoCache?.get(zoneData?.theaterId);
      const missionData = theaterData?.get(zoneData?.theaterMissionId);

      mission = {
        nameId: missionData?.zone.type.id,
        icon: missionData?.zone.type.imageUrl,
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
    missionPlayers = undefined;
    mission = undefined;
    loadoutData = undefined;
    heroLoadoutPage = 1;
  }
</script>

<div class="flex flex-col items-center justify-center min-h-full space-y-4">
  <CenteredPageContent>
    <form class="flex items-center gap-2 w-full" onsubmit={lookupPlayer}>
      <Input
        class="grow"
        disabled={isLoading}
        placeholder={$t('lookupPlayers.search')}
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
  </CenteredPageContent>

  {#if lookupData}
    {@const kv = [
      { name: $t('lookupPlayers.playerInfo.id'), value: lookupData.accountId },
      { name: $t('lookupPlayers.playerInfo.name'), value: lookupData.displayName, href: `https://fortnitedb.com/profile/${lookupData.accountId}` },
      {
        name: $t('lookupPlayers.playerInfo.commanderLevel'),
        value: stwData && `${stwData.commanderLevel.current} ${stwData.commanderLevel.pastMaximum ? `(+${stwData.commanderLevel.pastMaximum})` : ''}`
      },
      {
        name: $t('lookupPlayers.playerInfo.boostedXp', { count: stwData?.xpBoosts.boostedXp }),
        value: stwData && `${stwData.xpBoosts.boostedXp.toLocaleString()} ${stwData.xpBoosts.boostAmount ? `(${$t('lookupPlayers.playerInfo.boostCount', { count: stwData.xpBoosts.boostAmount })})` : ''}`
      },
      {
        name: $t('lookupPlayers.playerInfo.founderEdition'),
        value: stwData?.founderEdition
          ? $FounderEditionNames[stwData.founderEdition]
          : $t('common.stw.founderEditions.none')
      }
    ]}

    <div class="space-y-4 text-sm relative border p-5 rounded-md min-w-80 xs:min-w-96">
      <div class="flex gap-4 items-start">
        {#if lookupData?.avatarUrl}
          <img class="hidden xs:block size-20 rounded-md self-center" alt={lookupData.displayName} src={lookupData.avatarUrl}/>
        {/if}

        <div class="flex-1">
          {#each kv as { name, value, href } (name)}
            {#if value != null}
              <div class="flex items-center gap-1">
                {#if href}
                  <a class="flex items-center gap-1" href={href} target="_blank">
                    <span class="text-muted-foreground">{name}:</span>
                    <span>{value}</span>
                    <ExternalLinkIcon class="size-4 text-muted-foreground"/>
                  </a>
                {:else}
                  <span class="text-muted-foreground">{name}:</span>
                  <span>{value}</span>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      </div>

      <Button
        class="absolute top-0 right-0 m-2 p-2 hidden xs:block"
        href="https://fortnitedb.com/profile/{lookupData.accountId}"
        title="View on FortniteDB"
        variant="ghost"
      >
        <img class="size-12" alt="FortniteDB" src="/assets/logos/fortnitedb.png"/>
      </Button>

      {#if missionPlayers?.length || mission || loadoutData}
        <Separator.Root class="bg-border h-px"/>

        <h3 class="text-lg font-semibold text-center">{$t('lookupPlayers.stwDetails.title')}</h3>

        {#if missionPlayers?.length || mission}
          <div class="grid grid-cols-1 xs:grid-cols-2 gap-4">
            {#if missionPlayers?.length}
              <div>
                <h4 class="text-lg font-semibold">{$t('lookupPlayers.stwDetails.players')}</h4>
                {#each missionPlayers as member (member.accountId)}
                  <div class="flex items-center gap-1">
                    <span>{member.name}</span>
                    <a class="text-muted-foreground" href="https://fortnitedb.com/profile/{member.accountId}" target="_blank">
                      <ExternalLinkIcon class="size-4"/>
                    </a>
                  </div>
                {/each}
              </div>
            {/if}

            {#if mission}
              <div>
                <h4 class="text-lg font-semibold">{$t('lookupPlayers.stwDetails.missionInformation.title')}</h4>

                {#if mission.nameId}
                  <div class="flex items-center gap-1">
                    <span class="text-muted-foreground">{$t('lookupPlayers.stwDetails.missionInformation.name')}:</span>
                    <img class="size-5" alt={$ZoneNames[mission.nameId]} src={mission.icon}/>
                    <span>{$ZoneNames[mission.nameId]} ⚡{mission.powerLevel}</span>
                  </div>
                {/if}

                <div class="flex items-center gap-1">
                  <span class="text-muted-foreground">{$t('lookupPlayers.stwDetails.missionInformation.world')}:</span>
                  <span>{$TheaterNames[mission.theaterId]}</span>
                </div>

                {#if mission.zone}
                  <div class="flex items-center gap-1">
                    <span class="text-muted-foreground">{$t('lookupPlayers.stwDetails.missionInformation.zone')}:</span>
                    <span>{mission.zone?.names[$language]}</span>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/if}

        {#if selectedHeroLoadout && loadoutData?.length}
          {#if missionPlayers?.length || mission}
            <Separator.Root class="bg-border h-px"/>
          {/if}

          <div class="flex flex-col items-center gap-4">
            {#if selectedHeroLoadout}
              <div class="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 place-items-center not-md:gap-4">
                {#if selectedHeroLoadout.commander}
                  <div class="flex flex-col items-center gap-y-1">
                    <span class="text-lg font-semibold">{$t('lookupPlayers.stwDetails.heroLoadout.commander')}</span>
                    <img
                      style="background-color: {RarityColors[selectedHeroLoadout.commander.rarity]}"
                      class="size-12 rounded-sm"
                      alt={selectedHeroLoadout.commander.name}
                      src={selectedHeroLoadout.commander.icon}
                      title={selectedHeroLoadout.commander.name}
                    />
                  </div>
                {/if}

                {#if selectedHeroLoadout.teamPerk}
                  <div class="flex flex-col items-center gap-y-1">
                    <span class="text-lg font-semibold">{$t('lookupPlayers.stwDetails.heroLoadout.teamPerk')}</span>
                    <img
                      class="size-12 rounded-sm"
                      alt={selectedHeroLoadout.teamPerk.name}
                      src={selectedHeroLoadout.teamPerk.icon}
                      title={selectedHeroLoadout.teamPerk.name}
                    />
                  </div>
                {/if}

                {#if selectedHeroLoadout.supportTeam?.length}
                  <div class="flex flex-col items-center gap-y-1">
                    <span class="text-lg font-semibold md:hidden">{$t('lookupPlayers.stwDetails.heroLoadout.supportTeam')}</span>
                    <div class="grid grid-cols-3 gap-2">
                      {#each selectedHeroLoadout.supportTeam as support (support.name)}
                        <div class="flex justify-center items-center size-10" title={support.name}>
                          <img
                            style="background-color: {RarityColors[support.rarity]}"
                            class="rounded-md"
                            alt={support.name}
                            src={support.icon}
                          />
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}

                {#if selectedHeroLoadout.gadgets?.length}
                  <div class="flex flex-col items-center gap-y-1">
                    <span class="text-lg font-semibold md:hidden">{$t('lookupPlayers.stwDetails.heroLoadout.gadgets')}</span>
                    {#each selectedHeroLoadout.gadgets as gadget (gadget.name)}
                      <img class="size-10" alt={gadget.name} src={gadget.icon} title={gadget.name}/>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}

            <Pagination count={loadoutData.length} perPage={1} bind:page={heroLoadoutPage}/>
          </div>
        {/if}
      {/if}

      {#if stwData && stwData?.claimedMissionAlertIds.size > 0 && claimedMisssionAlerts && claimedMisssionAlerts.length > 0}
        <Separator.Root class="bg-border h-px"/>

        <h3 class="text-lg font-semibold text-center">{$t('lookupPlayers.claimedAlerts.title')}</h3>

        <WorldInfoSectionAccordion
          claimedMissionAlerts={stwData?.claimedMissionAlertIds}
          missions={claimedMisssionAlerts}
          showAlertClaimedBorder={false}
        />
      {/if}
    </div>
  {/if}
</div>