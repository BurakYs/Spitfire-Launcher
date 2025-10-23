<script lang="ts" module>
  import { SvelteSet } from 'svelte/reactivity';

  let statusSetAccounts = new SvelteSet<string>();
  let isSettingStatus = $state(false);
  let isResettingStatus = $state(false);

  let customStatus = $state<string>();
  let onlineType = $state<'online' | 'away'>('online');
</script>

<script lang="ts">
  import PageContent from '$components/PageContent.svelte';
  import CustomStatusTutorial from '$components/docs/tutorials/CustomStatus.svelte';
  import { activeAccountStore } from '$lib/core/data-storage';
  import TaxiManager from '$lib/core/managers/taxi.svelte.js';
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input/Input.svelte';
  import { toast } from 'svelte-sonner';
  import { handleError, nonNull, t } from '$lib/utils/util';
  import XMPPManager from '$lib/core/managers/xmpp';
  import MoonIcon from '@lucide/svelte/icons/moon';
  import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
  import XIcon from '@lucide/svelte/icons/x';

  const activeAccount = $derived(nonNull($activeAccountStore));
  const isCustomStatusInUse = $derived(TaxiManager.taxiAccountIds.has(activeAccount.accountId));

  async function setCustomStatus(event: SubmitEvent) {
    event.preventDefault();

    if (!customStatus?.trim()) return;

    isSettingStatus = true;

    try {
      const connection = await XMPPManager.create(activeAccount, 'customStatus');
      await connection.connect();

      connection.setStatus(customStatus, onlineType);
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
    <div class="relative">
      <Input
        class="pr-18"
        disabled={isCustomStatusInUse}
        placeholder={$t('customStatus.statusPlaceholder')}
        bind:value={customStatus}
      />

      <button
        class="absolute top-1/2 right-10 -translate-y-1/2 p-1.25 {onlineType === 'online' && 'bg-accent'} rounded-sm"
        aria-label={$t('customStatus.onlineTypes.online')}
        onclick={() => onlineType = 'online'}
        title={$t('customStatus.onlineTypes.online')}
        type="button"
      >
        <span class="block size-4 bg-[#43a25a] rounded-full p-2"></span>
      </button>

      <button
        class="absolute top-1/2 right-2 -translate-y-1/2 p-1 {onlineType === 'away' && 'bg-accent'} rounded-sm"
        aria-label={$t('customStatus.onlineTypes.away')}
        onclick={() => onlineType = 'away'}
        title={$t('customStatus.onlineTypes.away')}
        type="button"
      >
        <MoonIcon class="size-4.5 text-orange-400 fill-orange-400 fill-orange-40"/>
      </button>
    </div>

    <div class="flex items-center gap-2">
      <Button
        class="w-full"
        disabled={isSettingStatus || !customStatus?.trim() || isCustomStatusInUse}
        loading={isSettingStatus}
        loadingText={$t('customStatus.settingStatus')}
        type="submit"
        variant="epic"
      >
        {$t('customStatus.setStatus')}
      </Button>

      <Button
        disabled={isResettingStatus || !statusSetAccounts.has(activeAccount.accountId)}
        onclick={resetStatus}
        title={$t('customStatus.resetStatus')}
        type="button"
        variant="accent"
      >
        {#if isResettingStatus}
          <LoaderCircleIcon class="size-5 animate-spin my-1"/>
        {:else}
          <XIcon class="size-5 my-1"/>
        {/if}
      </Button>
    </div>
  </form>
</PageContent>
