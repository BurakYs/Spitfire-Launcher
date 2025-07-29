<script lang="ts" module>
  import type { BulkActionStatus } from '$types/accounts';

  type XPStatus = BulkActionStatus<{
    battleRoyale: number;
    creative: number;
    saveTheWorld: number;
  }>;

  let selectedAccounts = $state<string[]>([]);
  let isFetching = $state(false);
  let xpStatuses = $state<XPStatus[]>([]);
</script>

<script lang="ts">
  import PageContent from '$components/PageContent.svelte';
  import { language } from '$lib/core/data-storage';
  import { doingBulkOperations } from '$lib/stores';
  import Button from '$components/ui/Button.svelte';
  import AccountCombobox from '$components/ui/Combobox/AccountCombobox.svelte';
  import { getAccountsFromSelection, getResolvedResults, t } from '$lib/utils/util';
  import MCPManager from '$lib/core/managers/mcp';
  import BulkResultAccordion from '$components/ui/Accordion/BulkResultAccordion.svelte';

  async function fetchXPData() {
    isFetching = true;
    doingBulkOperations.set(true);
    xpStatuses = [];

    const accounts = getAccountsFromSelection(selectedAccounts);
    await Promise.allSettled(accounts.map(async (account) => {
      const status: XPStatus = { accountId: account.accountId, displayName: account.displayName, data: { battleRoyale: 0, saveTheWorld: 0, creative: 0 } };
      xpStatuses.push(status);

      const [athenaProfile, campaignProfile] = await getResolvedResults([
        MCPManager.queryProfile(account, 'athena'),
        MCPManager.queryProfile(account, 'campaign')
      ]);

      if (athenaProfile) {
        const attributes = athenaProfile.profileChanges[0].profile.stats.attributes;
        status.data.creative = attributes.creative_dynamic_xp?.currentWeekXp || 0;
        status.data.battleRoyale = attributes.playtime_xp?.currentWeekXp || 0;
      }

      if (campaignProfile) {
        const items = Object.values(campaignProfile.profileChanges[0].profile.items);
        const xpItem = items.find((item) => item.templateId === 'Token:stw_accolade_tracker');
        if (xpItem) {
          status.data.saveTheWorld = xpItem.attributes?.weekly_xp || 0;
        }
      }
    }));

    doingBulkOperations.set(false);
    isFetching = false;
  }

  function getNextDayOfWeek(dayIndex: number, hours = 0) {
    const now = new Date();
    const currentDay = now.getDay();
    const daysUntilTarget = (7 + dayIndex - currentDay) % 7;

    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- This is not a reactive store
    const nextDay = new Date();
    nextDay.setUTCDate(now.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
    nextDay.setUTCHours(hours, 0, 0, 0);

    return nextDay;
  }
</script>

<PageContent
  description={$t('earnedXP.page.description')}
  small={true}
  title={$t('earnedXP.page.title')}
>
  <form class="flex flex-col gap-y-4" onsubmit={fetchXPData}>
    <AccountCombobox
      disabled={isFetching}
      type="multiple"
      bind:selected={selectedAccounts}
    />

    <Button
      disabled={!selectedAccounts?.length || isFetching}
      loading={isFetching}
      loadingText={$t('earnedXP.loading')}
      onclick={fetchXPData}
      variant="epic"
    >
      {$t('earnedXP.check')}
    </Button>
  </form>

  {#if !isFetching && xpStatuses.length}
    <BulkResultAccordion statuses={xpStatuses}>
      {#snippet content(status)}
        {@const gamemodes = [
          {
            id: 'battleRoyale',
            name: $t('common.gameModes.battleRoyale'),
            value: status.data.battleRoyale || 0,
            limit: 4_000_000
          },
          {
            id: 'creative',
            name: $t('common.gameModes.creative'),
            value: status.data.creative || 0,
            limit: 4_000_000
          },
          {
            id: 'saveTheWorld',
            name: $t('common.gameModes.saveTheWorld'),
            value: status.data.saveTheWorld || 0,
            limit: 3_400_000
          }
        ]}

        <div class="bg-muted/30 p-3 space-y-6">
          {#each gamemodes as gamemode (gamemode.id)}
            {@const resetDate = gamemode.id === 'saveTheWorld' ? getNextDayOfWeek(4, 0) : getNextDayOfWeek(0, 13)}

            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <img
                    class="size-4"
                    alt="XP Icon"
                    src="/assets/misc/battle-royale-xp.png"
                  />
                  <span class="font-medium">{gamemode.name}</span>
                </div>

                <div class="text-sm">
                  <span class="font-medium">{gamemode.value.toLocaleString($language)}</span>
                  <span class="text-muted-foreground">/ {new Intl.NumberFormat($language, {
                    notation: 'compact',
                    compactDisplay: 'short'
                  }).format(gamemode.limit)}</span>
                </div>
              </div>

              <div class="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  style="width: {Math.min(100, (gamemode.value / gamemode.limit) * 100)}%"
                  class="h-full bg-epic"
                ></div>
              </div>

              <div class="text-sm text-muted-foreground mt-1">
                {$t('earnedXP.resetsAt', { time: resetDate.toLocaleString($language) })}
              </div>
            </div>
          {/each}
        </div>
      {/snippet}
    </BulkResultAccordion>
  {/if}
</PageContent>
