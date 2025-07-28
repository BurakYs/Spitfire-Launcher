<script lang="ts" module>
  import { Theaters } from '$lib/constants/stw/world-info';
  import type { RarityType, ZoneThemeData } from '$types/game/stw/resources';

  type Theater = typeof Theaters[keyof typeof Theaters];

  export type MissionPlayers = Array<{
    accountId: string;
    name: string;
  }>;

  export type MissionData = {
    nameId?: string;
    icon?: string;
    powerLevel?: number;
    zone?: ZoneThemeData;
    theaterId: Theater;
  };

  export type LoadoutData = {
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
</script>

<script lang="ts">
  import ExternalLink from '$components/ui/ExternalLink.svelte';
  import Pagination from '$components/ui/Pagination.svelte';
  import { RarityColors } from '$lib/constants/stw/resources';
  import { TheaterNames, ZoneNames } from '$lib/constants/stw/world-info';
  import { language } from '$lib/stores';
  import { Separator } from 'bits-ui';
  import { t } from '$lib/utils/util';
  import ExternalLinkIcon from 'lucide-svelte/icons/external-link';

  type Props = {
    missionPlayers?: MissionPlayers;
    mission?: MissionData;
    loadoutData?: LoadoutData[];
    heroLoadoutPage: number;
  };

  let { missionPlayers, mission, loadoutData, heroLoadoutPage }: Props = $props();
  const selectedHeroLoadout = $derived(loadoutData?.[heroLoadoutPage - 1]);
</script>

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
              <ExternalLink class="text-muted-foreground" href="https://fortnitedb.com/profile/{member.accountId}">
                <ExternalLinkIcon class="size-4"/>
              </ExternalLink>
            </div>
          {/each}
        </div>
      {/if}

      {#if mission}
        <div>
          <h4 class="text-lg font-semibold">{$t('lookupPlayers.stwDetails.missionInformation.title')}</h4>

          {#if mission.nameId && $ZoneNames[mission.nameId]}
            <div class="flex items-center gap-1">
              <span class="text-muted-foreground">{$t('lookupPlayers.stwDetails.missionInformation.name')}:</span>
              <img class="size-5" alt={$ZoneNames[mission.nameId]} src={mission.icon}/>
              <span>{$ZoneNames[mission.nameId]}{mission.powerLevel != null ? ` ⚡ ${mission.powerLevel}` : ''}</span>
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
        <div class="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 place-items-center max-md:gap-4">
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