<script lang="ts" module>
  import type { EpicDeviceAuthData } from '$types/game/authorizations';

  let allDeviceAuths = $state<Record<string, EpicDeviceAuthData[]>>({});
  let isFetching = $state(false);
  let isGenerating = $state(false);
</script>

<script lang="ts">
  import DeviceAuthCard from '$components/device-auth/DeviceAuthCard.svelte';
  import SkeletonDeviceAuthCard from '$components/device-auth/SkeletonDeviceAuthCard.svelte';
  import PageContent from '$components/PageContent.svelte';
  import { Separator } from 'bits-ui';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import { untrack } from 'svelte';
  import { toast } from 'svelte-sonner';
  import DeviceAuthManager from '$lib/core/managers/device-auth';
  import { activeAccountStore, deviceAuthsStorage } from '$lib/core/data-storage';
  import { handleError, nonNull, t } from '$lib/utils/util';
  import type { AccountData } from '$types/accounts';

  const activeAccount = $derived(nonNull($activeAccountStore));
  const deviceAuths = $derived(allDeviceAuths[activeAccount?.accountId] || []);

  let errorOccurred = $state(false);

  async function fetchDeviceAuths(account: AccountData, forceRefresh = false) {
    if (isFetching || (!forceRefresh && deviceAuths?.length)) return;

    isFetching = true;
    errorOccurred = false;

    try {
      const data = await DeviceAuthManager.getAll(account);
      allDeviceAuths[account.accountId] = data.sort((a, b) => {
        const aHasCustomName = $deviceAuthsStorage.some((x) => x.deviceId === a.deviceId) ? 1 : 0;
        const bHasCustomName = $deviceAuthsStorage.some((x) => x.deviceId === b.deviceId) ? 1 : 0;
        const hasCustomName = bHasCustomName - aHasCustomName;

        const aDate = a.lastAccess?.dateTime || a.created?.dateTime;
        const bDate = b.lastAccess?.dateTime || b.created?.dateTime;
        const dateDifference = aDate && bDate && new Date(bDate).getTime() - new Date(aDate).getTime();

        return hasCustomName || dateDifference || 0;
      });
    } catch (error) {
      errorOccurred = true;
      console.error(error);
    } finally {
      isFetching = false;
    }
  }

  async function generateDeviceAuth() {
    if (isGenerating) return;

    isGenerating = true;

    const toastId = toast.loading($t('deviceAuth.generating'));
    try {
      const deviceAuth = await DeviceAuthManager.create(activeAccount);
      allDeviceAuths[activeAccount.accountId] = [deviceAuth, ...deviceAuths];
      toast.success($t('deviceAuth.generated'), { id: toastId });
    } catch (error) {
      handleError(error, $t('deviceAuth.failedToGenerate'), toastId);
    } finally {
      isGenerating = false;
    }
  }

  $effect(() => {
    if (!activeAccount) return;
    untrack(() => fetchDeviceAuths(activeAccount));
  });
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key === 'F5') {
      event.preventDefault();
      fetchDeviceAuths(activeAccount, true);
    }
  }}
/>

<PageContent>
  {#snippet title()}
    <h2 class="max-xs:text-3xl text-4xl font-bold max-xs:max-w-64">
      {$t('deviceAuth.page.title')}
    </h2>

    <PlusIcon
      class="ml-1 size-10 cursor-pointer {isGenerating || isFetching ? 'opacity-50 !cursor-not-allowed' : ''}"
      onclick={generateDeviceAuth}
    />

    <Separator.Root class="bg-border h-10 w-px"/>

    <RefreshCwIcon
      class="ml-1.5 size-8 cursor-pointer {isFetching ? 'animate-spin opacity-50 !cursor-not-allowed' : ''}"
      onclick={() => fetchDeviceAuths(activeAccount, true)}
    />
  {/snippet}

  {#if errorOccurred}
    <p class="text-red-500">
      {$t('deviceAuth.failedToFetch')}
    </p>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 place-items-center gap-4">
      {#if !isFetching}
        {#each deviceAuths as auth (auth.deviceId)}
          <DeviceAuthCard {allDeviceAuths} {auth}/>
        {/each}
      {:else}
        <SkeletonDeviceAuthCard/>
        <SkeletonDeviceAuthCard/>
      {/if}
    </div>
  {/if}
</PageContent>
