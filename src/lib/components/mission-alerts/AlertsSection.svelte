<script lang="ts">
  import type { WorldParsedMission } from '$types/game/stw/world-info';
  import { activeAccountStore } from '$lib/core/data-storage';
  import AlertsSectionAccordion from '$components/mission-alerts/AlertsSectionAccordion.svelte';
  import { worldInfoCache } from '$lib/stores';
  import { t } from '$lib/utils/util';

  type Props = {
    title: string;
    missions: WorldParsedMission[];
    claimedMissionAlerts: Map<string, Set<string>>;
  };

  const { title, missions, claimedMissionAlerts }: Props = $props();
</script>
<div class="flex flex-col gap-y-1">
  <h1 class="font-bold">{title}</h1>

  {#if missions.length}
    <AlertsSectionAccordion claimedMissionAlerts={claimedMissionAlerts.get($activeAccountStore?.accountId || '') || new Set()} {missions}/>
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