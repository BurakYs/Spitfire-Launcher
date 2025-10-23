<script lang="ts" module>
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- This is not a reactive store
  const claimedMissionAlerts = new Map<string, Set<string>>();
</script>

<script lang="ts">
  import PageContent from '$components/PageContent.svelte';
  import { activeAccountStore, language } from '$lib/core/data-storage';
  import MCPManager from '$lib/core/managers/mcp';
  import type { WorldParsedMission } from '$types/game/stw/world-info';
  import WorldInfoSectionAccordion from '$components/world-info/WorldInfoSectionAccordion.svelte';
  import { worldInfoCache } from '$lib/stores';
  import { WorldPowerLevels, Theaters } from '$lib/constants/stw/world-info';
  import { isLegendaryOrMythicSurvivor, nonNull, t } from '$lib/utils/util';
  import WorldInfoManager from '$lib/core/managers/world-info';
  import { onMount } from 'svelte';

  const activeAccount = $derived(nonNull($activeAccountStore));
  const parsedWorldInfoArray = $derived($worldInfoCache && Array.from($worldInfoCache.values(), worldMissions => Array.from(worldMissions.values())).flat());

  const filteredMissions = $derived.by(() => {
    if (!parsedWorldInfoArray) return null;

    return {
      vbucks: parsedWorldInfoArray.filter(mission => mission.filters.some(id => id.includes('currency_mtxswap'))),
      survivors: parsedWorldInfoArray.filter(mission => mission.filters.some(id => isLegendaryOrMythicSurvivor(id))),
      twinePeaks: Array.from($worldInfoCache.get(Theaters.TwinePeaks)?.values() || [])
        .filter(mission => mission.powerLevel === WorldPowerLevels[Theaters.TwinePeaks].Endgame_Zone6),
      ventures: Array.from($worldInfoCache.entries())
        .filter(([theaterId]) => ![Theaters.Stonewood, Theaters.Plankerton, Theaters.CannyValley, Theaters.TwinePeaks].includes(theaterId))
        .flatMap(([, worldMissions]) => Array.from(worldMissions.values()))
        .filter(mission => mission.powerLevel === WorldPowerLevels.ventures.Phoenix_Zone25),
      upgradeLlamaTokens: parsedWorldInfoArray.filter(mission => mission.filters.some(id => id.includes('voucher_cardpack_bronze'))),
      perkUp: parsedWorldInfoArray.filter(mission => mission.filters.some(id => id.includes('alteration_upgrade_sr')))
    };
  });

  const sections = $derived([
    {
      id: 'vbucks',
      title: $t('common.vbucks'),
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

  const overview = $derived([
    {
      id: 'vbucks',
      name: $t('common.vbucks'),
      icon: '/assets/resources/currency_mtxswap.png',
      amount: countMissionReward(filteredMissions?.vbucks, 'currency_mtxswap')
    },
    {
      id: 'upgradeLlamaTokens',
      name: $t('stwMissionAlerts.sections.survivors'),
      icon: '/assets/resources/voucher_generic_worker_sr.png',
      amount: countMissionReward(filteredMissions?.survivors, isLegendaryOrMythicSurvivor)
    },
    {
      id: 'perkUp',
      name: $t('stwMissionAlerts.sections.twinePeaks'),
      icon: '/assets/resources/voucher_cardpack_bronze.png',
      amount: countMissionReward(filteredMissions?.upgradeLlamaTokens, 'voucher_cardpack_bronze')
    },
    {
      id: 'twinePeaks',
      name: $t('stwMissionAlerts.sections.ventures'),
      icon: '/assets/resources/reagent_alteration_upgrade_sr.png',
      amount: countMissionReward(filteredMissions?.perkUp, 'alteration_upgrade_sr')
    }
  ]);

  function refreshWorldInfo() {
    worldInfoCache.set(new Map());
    WorldInfoManager.setCache();
  }

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
      {#each overview as { id, name, icon, amount } (id)}
        <div class="flex items-center border rounded-md">
          <div class="flex items-center justify-center size-10 bg-muted-foreground/10 shrink-0">
            <img class="size-7" alt={name} src={icon}/>
          </div>
          <div class="grow px-2 font-medium text-center">
            {amount.toLocaleString($language)}
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
          {:else if !$worldInfoCache.size}
            <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
            {#each Array(Math.max(1, Math.floor(Math.random() * 3) + 1)) as _, index (index)}
              <div class="flex items-center justify-between px-2 h-8 bg-muted-foreground/5 rounded-sm skeleton-loader"></div>
            {/each}
          {:else}
            <div class="flex items-center justify-center px-2 h-10 bg-muted-foreground/5 rounded-sm">
              <span class="text-muted-foreground">
                {$t('stwMissionAlerts.noMissions')}
              </span>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</PageContent>