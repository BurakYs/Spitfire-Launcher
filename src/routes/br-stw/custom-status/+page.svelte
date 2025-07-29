<script lang="ts" module>
  import { SvelteSet } from 'svelte/reactivity';

  let statusSetAccounts = new SvelteSet<string>();
  let isSettingStatus = $state(false);
  let isResettingStatus = $state(false);
</script>

<script lang="ts">
  import PageContent from '$components/PageContent.svelte';
  import CustomStatusTutorial from '$components/docs/tutorials/CustomStatus.svelte';
  import { activeAccountStore } from '$lib/core/data-storage';
  import TaxiManager from '$lib/core/managers/automation/taxi-manager.svelte.js';
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import { toast } from 'svelte-sonner';
  import { handleError, nonNull, t } from '$lib/utils/util';
  import XMPPManager from '$lib/core/managers/xmpp';

  const activeAccount = $derived(nonNull($activeAccountStore));
  const isCustomStatusInUse = $derived(TaxiManager.taxiAccountIds.has(activeAccount.accountId));
  let customStatus = $state<string>();

  async function setCustomStatus(event: SubmitEvent) {
    event.preventDefault();

    if (!customStatus?.trim()) return;

    isSettingStatus = true;

    try {
      const connection = await XMPPManager.create(activeAccount, 'customStatus');
      await connection.connect();

      connection.setStatus(customStatus);
      statusSetAccounts.add(activeAccount.accountId);

      toast.success($t('customStatus.statusSet'));
    } catch (error) {
      handleError(error, $t('customStatus.failedToSetStatus'));
    } finally {
      isSettingStatus = false;
    }
  }

  async function resetStatus() {
    isResettingStatus = true;

    try {
      const connection = await XMPPManager.create(activeAccount, 'customStatus');

      connection.resetStatus();
      connection.removePurpose('customStatus');
      statusSetAccounts.delete(activeAccount.accountId);

      toast.success($t('customStatus.statusReset'));
    } catch (error) {
      handleError(error, $t('customStatus.failedToResetStatus'));
    } finally {
      isResettingStatus = false;
    }
  }
</script>

<PageContent
  description={$t('customStatus.page.description')}
  docsComponent={CustomStatusTutorial}
  small={true}
  title={$t('customStatus.page.title')}
>
  <form class="flex flex-col gap-y-4" onsubmit={setCustomStatus}>
    <Input
      disabled={isCustomStatusInUse}
      placeholder={$t('customStatus.statusPlaceholder')}
      bind:value={customStatus}
    />

    <Button
      disabled={isSettingStatus || !customStatus?.trim() || isCustomStatusInUse}
      loading={isSettingStatus}
      loadingText={$t('customStatus.settingStatus')}
      type="submit"
      variant="epic"
    >
      {$t('customStatus.setStatus')}
    </Button>

    {#if statusSetAccounts.has(activeAccount.accountId)}
      <Button
        disabled={isResettingStatus}
        loading={isResettingStatus}
        loadingText={$t('customStatus.resettingStatus')}
        onclick={resetStatus}
        type="button"
        variant="epic"
      >
        {$t('customStatus.resetStatus')}
      </Button>
    {/if}
  </form>
</PageContent>
