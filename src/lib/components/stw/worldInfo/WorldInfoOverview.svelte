<script lang="ts" module>
  const claimedMissionAlerts: Map<string, Set<string>> = new Map();
</script>

<script lang="ts">
  import MCPManager from '$lib/core/managers/mcp';
  import type { WorldParsedMission } from '$types/game/stw/worldInfo';
  import WorldInfoSectionAccordion from '$components/stw/worldInfo/WorldInfoSectionAccordion.svelte';
  import { accountsStore, worldInfoCache } from '$lib/stores';
  import { WorldPowerLevels, Theaters } from '$lib/constants/stw/worldInfo';
  import { isLegendaryOrMythicSurvivor, t } from '$lib/utils/util';

  const activeAccount = $derived($accountsStore.activeAccount);

  $effect(() => {
    if (!activeAccount || claimedMissionAlerts.has(activeAccount.accountId)) return;

    MCPManager.queryProfile(activeAccount, 'campaign').then((queryProfile) => {
      const attributes = queryProfile.profileChanges[0].profile.stats.attributes;
      const doneMissionAlerts = attributes.mission_alert_redemption_record?.claimData?.map((claimData) => claimData.missionAlertId) || [];

      claimedMissionAlerts.set(activeAccount.accountId, new Set(doneMissionAlerts));
    });
  });

  const parsedWorldInfo = $derived($worldInfoCache);
  const parsedWorldInfoArray = $derived(parsedWorldInfo &&
    Array.from(parsedWorldInfo.values()).flatMap((worldMissions) => Array.from(worldMissions.values()))
  );

  const isLoading = $derived(!$worldInfoCache || !parsedWorldInfo || !parsedWorldInfoArray);

  const sections = $derived<{ id: string; title: string; missions: WorldParsedMission[] }[]>([
    {
      id: 'vbucks',
      title: $t('common.vbucks'),
      missions:
        !isLoading && parsedWorldInfoArray
          .filter((mission) => mission.filters.some((id) => id.includes('currency_mtxswap')))
    },
    {
      id: 'survivors',
      title: $t('stwMissionAlerts.sections.survivors'),
      missions:
        !isLoading && parsedWorldInfoArray
          .filter((mission) => mission.filters.some((id) => isLegendaryOrMythicSurvivor(id)))
    },
    {
      id: 'twinePeaks',
      title: $t('stwMissionAlerts.sections.twinePeaks'),
      missions:
        !isLoading && Array.from(parsedWorldInfo.get(Theaters.TwinePeaks)!.values())
          .filter((mission) => mission.powerLevel === WorldPowerLevels[Theaters.TwinePeaks].Endgame_Zone6)
    },
    {
      id: 'ventures',
      title: $t('stwMissionAlerts.sections.ventures'),
      missions:
        !isLoading &&
          Array.from(parsedWorldInfo.entries())
            .filter(([theaterId]) =>
              ![Theaters.Stonewood, Theaters.Plankerton, Theaters.CannyValley, Theaters.TwinePeaks].includes(theaterId)
            )
            .flatMap(([, worldMissions]) => Array.from(worldMissions.values()))
            .filter((missions) => missions.powerLevel === WorldPowerLevels.ventures.Phoenix_Zone25)
    },
    {
      id: 'upgradeLlamaTokens',
      title: $t('stwMissionAlerts.sections.upgradeLlamaTokens'),
      missions:
        !isLoading && parsedWorldInfoArray
          .filter((mission) => mission.filters.some((id) => id.includes('voucher_cardpack_bronze')))
    },
    {
      id: 'perkUp',
      title: $t('stwMissionAlerts.sections.perkup'),
      missions:
        !isLoading && parsedWorldInfoArray
          .filter((mission) => mission.filters.some((id) => id.includes('alteration_upgrade_sr')))
    }
  ]);

  const overview = $derived([
    {
      id: 'vbucks',
      name: $t('common.vbucks'),
      icon: '/assets/resources/currency_mtxswap.png',
      amount: countMissionReward(sections.find(({ id }) => id === 'vbucks')?.missions, 'currency_mtxswap')
    },
    {
      id: 'upgradeLlamaTokens',
      name: $t('stwMissionAlerts.sections.survivors'),
      icon: '/assets/resources/voucher_generic_worker_sr.png',
      amount: countMissionReward(sections.find(({ id }) => id === 'survivors')?.missions, isLegendaryOrMythicSurvivor)
    },
    {
      id: 'perkUp',
      name: $t('stwMissionAlerts.sections.twinePeaks'),
      icon: '/assets/resources/voucher_cardpack_bronze.png',
      amount: countMissionReward(sections.find(({ id }) => id === 'upgradeLlamaTokens')?.missions, 'voucher_cardpack_bronze')
    },
    {
      id: 'twinePeaks',
      name: $t('stwMissionAlerts.sections.ventures'),
      icon: '/assets/resources/reagent_alteration_upgrade_sr.png',
      amount: countMissionReward(sections.find(({ id }) => id === 'perkUp')?.missions, 'alteration_upgrade_sr')
    }
  ]);

  function countMissionReward(missions: WorldParsedMission[] | undefined, idOrValidator: string | ((id: string) => boolean)) {
    return (missions || []).reduce((acc, crr) => {
      const alertReward = crr.alert?.rewards.find(reward =>
        typeof idOrValidator === 'function' ? idOrValidator(reward.itemId) : reward.itemId.includes(idOrValidator)
      );

      const missionReward = crr.rewards.find(reward =>
        typeof idOrValidator === 'function' ? idOrValidator(reward.itemId) : reward.itemId.includes(idOrValidator)
      );

      acc += (alertReward?.quantity || 0) + (missionReward?.quantity || 0);

      return acc;
    }, 0);
  }
</script>

<div class="flex flex-col">
  <div class="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-4 p-4 pt-0 bg-muted/5">
    {#each overview as { id, name, icon, amount } (id)}
      <div class="flex items-center border rounded-md">
        <div class="flex items-center justify-center size-10 bg-muted-foreground/10 shrink-0">
          <img class="size-7" alt={name} src={icon}/>
        </div>
        <div class="grow px-2 font-medium text-center">
          {amount.toLocaleString()}
        </div>
      </div>
    {/each}
  </div>

  <div class="flex flex-col gap-y-5">
    {#each sections as { id, title, missions } (id)}
      <div class="flex flex-col gap-y-1">
        <h1 class="font-bold">{title}</h1>

        {#if missions.length}
          <WorldInfoSectionAccordion claimedMissionAlerts={!activeAccount ? undefined : claimedMissionAlerts.get(activeAccount.accountId)} {missions}/>
        {:else if isLoading}
          {#each Array(Math.max(1, Math.floor(Math.random() * 3) + 1)) as _, index (index)}
            <div class="flex items-center justify-between px-2 h-8 bg-muted-foreground/5 rounded-sm skeleton-loader"
            ></div>
          {/each}
        {:else}
          <div class="flex items-center justify-center px-2 h-10 bg-muted-foreground/5 rounded-sm"
          >
            <span class="text-muted-foreground">
              {$t('stwMissionAlerts.noMissions')}
            </span>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
