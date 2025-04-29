<script lang="ts" module>
  import type { DailyQuestData } from '$types/game/stw/resources';

  export type DailyQuest = DailyQuestData & {
    id: string;
    completionProgress: number;
    hasFounder: boolean;
  };
</script>

<script lang="ts">
  import Accordion from '$components/ui/Accordion/Accordion.svelte';
  import { language } from '$lib/stores';
  import { t } from '$lib/utils/util';
  import ChevronDownIcon from 'lucide-svelte/icons/chevron-down';

  type Props = {
    dailyQuests: Array<DailyQuest>;
  };

  const { dailyQuests }: Props = $props();
</script>

<Accordion class="mt-1" items={dailyQuests} type="multiple">
  {#snippet trigger(quest)}
    <div class="flex items-center justify-between px-2 h-10 bg-muted-foreground/5 rounded-sm">
      <span class="text-start font-medium break-after-all">{quest.names[$language]} - {quest.completionProgress}/{quest.limit}</span>

      <span class="inline-flex items-center justify-center">
        <ChevronDownIcon class="size-5 transition-transform duration-200"/>
      </span>
    </div>
  {/snippet}

  {#snippet content(quest)}
    {@const rewards = [
      {
        id: 'gold',
        name: $t('common.stw.gold'),
        icon: '/assets/resources/eventcurrency_scaling.png',
        amount: quest.rewards.gold
      },
      {
        id: 'mtx',
        name: quest.hasFounder ? $t('common.vbucks') : $t('common.stw.xrayTickets'),
        icon: quest.hasFounder ? '/assets/resources/currency_mtxswap.png' : '/assets/resources/currency_xrayllama.png',
        amount: quest.rewards.mtx
      },
      {
        id: 'xp',
        name: $t('common.xp'),
        icon: '/assets/misc/battle-royale-xp.png',
        amount: quest.rewards.xp
      }
    ]}

    <div class="overflow-hidden text-sm mt-1 bg-muted-foreground/5 rounded-sm">
      <div class="flex flex-col gap-y-1 px-4 py-2">
        <h2 class="font-medium">{$t('lookupPlayers.dailyQuests.rewards')}</h2>
        <div class="flex flex-col gap-x-1">
          {#each rewards as reward (reward.id)}
            <div class="flex gap-1">
              <img class="size-6" alt="Reward icon" src={reward.icon}/>

              {#if reward.amount > 1}
                <span class="font-medium">
                  × {reward.amount.toLocaleString($language)}
                </span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/snippet}
</Accordion>