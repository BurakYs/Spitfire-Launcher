<script lang="ts" module>
  import type { BulkActionStatus } from '$types/accounts';
  import type { DailyQuestData } from '$types/game/stw/resources';

  type DailyQuest = DailyQuestData & {
    id: string;
    completionProgress: number;
  };

  type QuestStatus = BulkActionStatus<{
    hasFounder: boolean;
    quests: DailyQuest[];
  }>;

  let selectedAccounts = $state<string[]>([]);
  let isFetching = $state(false);
  let canReroll = $state<Record<string, boolean>>({});
  let questStatuses = $state<QuestStatus[]>([]);
  let rerollingQuestId = $state<string | null>(null);
</script>

<script lang="ts">
  import PageContent from '$components/PageContent.svelte';
  import AccountCombobox from '$components/ui/Combobox/AccountCombobox.svelte';
  import { accountsStorage, language } from '$lib/core/data-storage';
  import { doingBulkOperations } from '$lib/stores';
  import Button from '$components/ui/Button.svelte';
  import RefreshCwIcon from 'lucide-svelte/icons/refresh-cw';
  import MCPManager from '$lib/core/managers/mcp';
  import { dailyQuests } from '$lib/constants/stw/resources';
  import type { FullQueryProfile } from '$types/game/mcp';
  import BulkResultAccordion from '$components/ui/Accordion/BulkResultAccordion.svelte';
  import { getAccountsFromSelection, t } from '$lib/utils/util';

  async function fetchDailyQuests() {
    isFetching = true;
    doingBulkOperations.set(true);
    questStatuses = [];

    const accounts = getAccountsFromSelection(selectedAccounts);
    await Promise.allSettled(accounts.map(async (account) => {
      const status: QuestStatus = { accountId: account.accountId, displayName: account.displayName, data: { hasFounder: false, quests: [] } };

      try {
        const campaignProfile = await MCPManager.clientQuestLogin(account, 'campaign');
        handleQueryProfile(campaignProfile, status);

        if (status.data.quests.length > 0) {
          questStatuses.push(status);
        }
      } catch (error) {
        console.error(error);
      }
    }));

    doingBulkOperations.set(false);
    isFetching = false;
  }

  function handleQueryProfile(queryProfile: FullQueryProfile<'campaign'>, status: QuestStatus) {
    const profile = queryProfile.profileChanges[0].profile;
    const items = profile.items;

    canReroll[profile.accountId] = (profile.stats.attributes.quest_manager?.dailyQuestRerolls || 0) > 0;
    status.data.quests = [];
    status.data.hasFounder = Object.values(items).some((item) => item.templateId === 'Token:receivemtxcurrency');

    const dailyQuestsItems = Object.entries(items)
      .filter(([, item]) => item.templateId.startsWith('Quest:') && item.attributes.quest_state === 'Active')
      .map(([id, item]) => ({ id, ...item }));

    for (const item of dailyQuestsItems) {
      const quest = dailyQuests[item.templateId.split(':')[1].toLowerCase()];
      if (!quest) continue;

      const completionKey = Object.keys(item.attributes).find((attr) => attr.includes('completion'))!;
      const completionProgress = item.attributes[completionKey] || 0;

      status.data.quests.push({
        id: item.id,
        names: quest.names,
        completionProgress,
        limit: quest.limit,
        rewards: quest.rewards
      });
    }
  }

  async function rerollQuest(accountId: string, questId: string) {
    rerollingQuestId = questId;

    const account = $accountsStorage.accounts.find((account) => account.accountId === accountId);
    if (!account) {
      rerollingQuestId = null;
      return;
    }

    try {
      const rerollResponse = await MCPManager.compose<FullQueryProfile<'campaign'>>(account, 'FortRerollDailyQuest', 'campaign', { questId });
      const status = questStatuses.find((status) => status.accountId === accountId);
      if (status) {
        handleQueryProfile(rerollResponse, status);
      }
    } catch (error) {
      console.error(error);
    } finally {
      rerollingQuestId = null;
    }
  }
</script>

<PageContent small={true} title={$t('dailyQuests.page.title')}>
  <AccountCombobox
    disabled={isFetching}
    type="multiple"
    bind:selected={selectedAccounts}
  />

  <Button
    class="w-full"
    disabled={!selectedAccounts?.length || isFetching}
    loading={isFetching}
    loadingText={$t('dailyQuests.loading')}
    onclick={fetchDailyQuests}
    type="submit"
    variant="epic"
  >
    {$t('dailyQuests.getQuests')}
  </Button>

  {#if !isFetching && questStatuses.length}
    <BulkResultAccordion statuses={questStatuses}>
      {#snippet content(status)}
        <div class="p-3 space-y-3">
          {#each status.data.quests as quest (quest.id)}
            {@const rewards = [
              {
                name: $t('common.stw.gold'),
                icon: '/assets/resources/eventcurrency_scaling.png',
                amount: quest.rewards.gold
              },
              {
                name: status.data.hasFounder ? $t('common.vbucks') : $t('common.stw.xrayTickets'),
                icon: status.data.hasFounder ? '/assets/resources/currency_mtxswap.png' : '/assets/resources/currency_xrayllama.png',
                amount: quest.rewards.mtx
              },
              {
                name: $t('common.xp'),
                icon: '/assets/misc/battle-royale-xp.png',
                amount: quest.rewards.xp
              }
            ]}

            <div class="bg-background border rounded-md p-4">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <h3 class="font-medium">{quest.names[$language]}</h3>

                <div class="flex items-center gap-2">
                  <span class="font-medium">{quest.completionProgress}/{quest.limit}</span>

                  {#if canReroll[status.accountId]}
                    <Button
                      class="flex items-center justify-center h-8 w-8"
                      disabled={!!rerollingQuestId}
                      onclick={() => rerollQuest(status.accountId, quest.id)}
                      size="sm"
                      variant="outline"
                    >
                      <RefreshCwIcon
                        class="size-4 {rerollingQuestId === quest.id
                          ? 'animate-spin'
                          : ''}"
                      />
                    </Button>
                  {/if}
                </div>
              </div>

              <div class="flex justify-around">
                {#each rewards as reward (reward.name)}
                  {#if reward.amount > 0}
                    <div class="flex items-center gap-2 bg-muted/50 p-2 rounded">
                      <img class="size-5" alt={reward.name} src={reward.icon}/>
                      <span class="font-medium">{reward.amount.toLocaleString($language)}</span>
                    </div>
                  {/if}
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/snippet}
    </BulkResultAccordion>
  {/if}
</PageContent>
