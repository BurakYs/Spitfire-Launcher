<script lang="ts" module>
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- This is not a reactive store
  const claimedMissionAlerts = new Map<string, Set<string>>();
</script>

<script lang="ts">
  import PageContent from '$components/PageContent.svelte';
  import AlertsOverviewItem from '$components/mission-alerts/AlertsOverviewItem.svelte';
  import AlertsSection from '$components/mission-alerts/AlertsSection.svelte';
  import { activeAccountStore } from '$lib/core/data-storage';
  import MCPManager from '$lib/core/managers/mcp';
  import type { WorldParsedMission } from '$types/game/stw/world-info';
  import { worldInfoCache } from '$lib/stores';
  import { WorldPowerLevels, Theaters } from '$lib/constants/stw/world-info';
  import { isLegendaryOrMythicSurvivor, nonNull, t } from '$lib/utils/util';
  import WorldInfoManager from '$lib/core/managers/world-info';
  import { onMount } from 'svelte';

  const activeAccount = $derived(nonNull($activeAccountStore));

  const filteredMissions = $derived.by(() => {
    if (!$worldInfoCache) return null;

    const vbucks: WorldParsedMission[] = [];
    const survivors: WorldParsedMission[] = [];
    const twinePeaks: WorldParsedMission[] = [];
    const ventures: WorldParsedMission[] = [];
    const upgradeLlamaTokens: WorldParsedMission[] = [];
    const perkUp: WorldParsedMission[] = [];

    for (const [theaterId, worldMissions] of $worldInfoCache.entries()) {
      for (const mission of worldMissions.values()) {
        for (const id of mission.filters) {
          if (id.includes('currency_mtxswap')) {
            vbucks.push(mission);
          }

          if (isLegendaryOrMythicSurvivor(id)) {
            survivors.push(mission);
          }

          if (id.includes('voucher_cardpack_bronze')) {
            upgradeLlamaTokens.push(mission);
          }

          if (id.includes('alteration_upgrade_sr')) {
            perkUp.push(mission);
          }
        }

        if (theaterId === Theaters.TwinePeaks && mission.powerLevel === WorldPowerLevels[Theaters.TwinePeaks].Endgame_Zone6) {
          twinePeaks.push(mission);
        }

        if (
          theaterId !== Theaters.Stonewood &&
          theaterId !== Theaters.Plankerton &&
          theaterId !== Theaters.CannyValley &&
          theaterId !== Theaters.TwinePeaks &&
          mission.powerLevel === WorldPowerLevels.ventures.Phoenix_Zone25
        ) {
          ventures.push(mission);
        }
      }
    }

    return {
      vbucks,
      survivors,
      twinePeaks,
      ventures,
      upgradeLlamaTokens,
      perkUp
    };
  });

  const sections = $derived([
    {
      id: 'vbucks',
      title: $t('vbucks'),
      missions: filteredMissions?.vbucks || []
    },
    {
      id: 'survivors',
      title: $t('stwMissionAlerts.sections.survivors'),
      missions: filteredMissions?.survivors || []
    },
    {
      id: 'twinePeaks',
      title: $t('stwMissionAlerts.sections.twinePeaks'),
      missions: filteredMissions?.twinePeaks || []
    },
    {
      id: 'ventures',
      title: $t('stwMissionAlerts.sections.ventures'),
      missions: filteredMissions?.ventures || []
    },
    {
      id: 'upgradeLlamaTokens',
      title: $t('stwMissionAlerts.sections.upgradeLlamaTokens'),
      missions: filteredMissions?.upgradeLlamaTokens || []
    },
    {
      id: 'perkUp',
      title: $t('stwMissionAlerts.sections.perkup'),
      missions: filteredMissions?.perkUp || []
    }
  ]);

  function refreshWorldInfo() {
    worldInfoCache.set(new Map());
    WorldInfoManager.setCache();
  }

  function countMissionReward(missions: WorldParsedMission[] | undefined, idOrValidator: string | ((id: string) => boolean)) {
    return (missions || []).reduce((acc, crr) => {
      const alertReward = crr.alert?.rewards.find((reward) =>
        typeof idOrValidator === 'function' ? idOrValidator(reward.itemId) : reward.itemId.includes(idOrValidator)
      );

      const missionReward = crr.rewards.find((reward) =>
        typeof idOrValidator === 'function' ? idOrValidator(reward.itemId) : reward.itemId.includes(idOrValidator)
      );

      acc += (alertReward?.quantity || 0) + (missionReward?.quantity || 0);

      return acc;
    }, 0);
  }

  function getResetDate() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const day = now.getUTCDate();

    return new Date(Date.UTC(year, month, day + 1));
  }

  $effect(() => {
    if (!activeAccount || claimedMissionAlerts.has(activeAccount.accountId)) return;

    MCPManager.queryProfile(activeAccount, 'campaign').then((queryProfile) => {
      const attributes = queryProfile.profileChanges[0].profile.stats.attributes;
      const doneMissionAlerts = attributes.mission_alert_redemption_record?.claimData?.map((claimData) => claimData.missionAlertId) || [];

      claimedMissionAlerts.set(activeAccount.accountId, new Set(doneMissionAlerts));
    });
  });

  onMount(() => {
    const timeUntilReset = getResetDate().getTime() - Date.now();
    const timeout = setTimeout(() => {
      refreshWorldInfo();
    }, timeUntilReset);

    return () => clearTimeout(timeout);
  });
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key === 'F5') {
      event.preventDefault();
      refreshWorldInfo();
    }
  }}
/>

<PageContent title={$t('stwMissionAlerts.page.title')}>
  <div class="flex flex-col">
    <div class="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-4 p-4 pt-0 bg-muted/5">
      <AlertsOverviewItem
        name={$t('vbucks')}
        amount={countMissionReward(filteredMissions?.vbucks, 'currency_mtxswap')}
        icon="/assets/resources/currency_mtxswap.png"
      />
      <AlertsOverviewItem
        name={$t('stwMissionAlerts.sections.survivors')}
        amount={countMissionReward(filteredMissions?.survivors, isLegendaryOrMythicSurvivor)}
        icon="/assets/resources/voucher_generic_worker_sr.png"
      />
      <AlertsOverviewItem
        name={$t('stwMissionAlerts.sections.upgradeLlamaTokens')}
        amount={countMissionReward(filteredMissions?.upgradeLlamaTokens, 'voucher_cardpack_bronze')}
        icon="/assets/resources/voucher_cardpack_bronze.png"
      />
      <AlertsOverviewItem
        name={$t('stwMissionAlerts.sections.perkup')}
        amount={countMissionReward(filteredMissions?.perkUp, 'alteration_upgrade_sr')}
        icon="/assets/resources/reagent_alteration_upgrade_sr.png"
      />
    </div>

    <div class="flex flex-col gap-y-5">
      {#each sections as { id, title, missions } (id)}
        <AlertsSection {claimedMissionAlerts} {missions} {title}/>
      {/each}
    </div>
  </div>
</PageContent>