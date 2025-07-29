<script lang="ts" module>
  import type { EpicDeviceAuthData } from '$types/game/authorizations';

  let allDeviceAuths = $state<Record<string, EpicDeviceAuthData[]>>({});
  let isFetching = $state(false);
  let isGenerating = $state(false);
  let isDeleting = $state(false);
</script>

<script lang="ts">
  import PageContent from '$components/PageContent.svelte';
  import Button from '$components/ui/Button.svelte';
  import { Separator } from 'bits-ui';
  import RefreshCwIcon from 'lucide-svelte/icons/refresh-cw';
  import PlusIcon from 'lucide-svelte/icons/plus';
  import Trash2Icon from 'lucide-svelte/icons/trash-2';
  import { toast } from 'svelte-sonner';
  import DeviceAuthManager from '$lib/core/managers/device-auth';
  import { activeAccountStore, deviceAuthsStorage, language } from '$lib/core/data-storage';
  import { getStartingPage, handleError, nonNull, t } from '$lib/utils/util';
  import Account from '$lib/core/account';
  import Tooltip from '$components/ui/Tooltip.svelte';
  import { goto } from '$app/navigation';

  const activeAccount = $derived(nonNull($activeAccountStore));
  const deviceAuths = $derived(allDeviceAuths[activeAccount?.accountId] || []);

  async function saveDeviceName(event: FocusEvent & { currentTarget: HTMLSpanElement }, deviceId: string) {
    if (!deviceId) return;

    const newName = event.currentTarget.textContent?.trim();
    if (!newName) {
      event.currentTarget.textContent = $t('deviceAuthManagement.authInfo.noName');

      deviceAuthsStorage.update((settings) => {
        const index = settings.findIndex((x) => x.deviceId === deviceId);
        if (index !== -1) {
          settings.splice(index, 1);
        }

        return settings;
      });
    } else {
      deviceAuthsStorage.update((settings) => {
        const index = settings.findIndex((x) => x.deviceId === deviceId);
        if (index !== -1) {
          settings[index].customName = newName;
        } else {
          settings.push({
            deviceId,
            customName: newName
          });
        }

        return settings;
      });

    }
  }

  async function fetchDeviceAuths(force = false) {
    if (isFetching || !activeAccount || (!force && deviceAuths?.length)) return;

    isFetching = true;

    try {
      const data = await DeviceAuthManager.getAll(activeAccount);
      allDeviceAuths[activeAccount.accountId] = data.sort((a, b) => {
        const aHasCustomName = $deviceAuthsStorage.some(x => x.deviceId === a.deviceId) ? 1 : 0;
        const bHasCustomName = $deviceAuthsStorage.some(x => x.deviceId === b.deviceId) ? 1 : 0;
        const hasCustomName = bHasCustomName - aHasCustomName;

        const aDate = a.lastAccess?.dateTime || a.created?.dateTime;
        const bDate = b.lastAccess?.dateTime || b.created?.dateTime;
        const dateDifference = aDate && bDate && new Date(bDate).getTime() - new Date(aDate).getTime();

        return hasCustomName || dateDifference || 0;
      });
    } catch (error) {
      handleError(error, $t('deviceAuthManagement.failedToFetch'));
    } finally {
      isFetching = false;
    }
  }

  async function generateDeviceAuth() {
    if (isGenerating) return;

    isGenerating = true;

    const toastId = toast.loading($t('deviceAuthManagement.generating'));
    try {
      const deviceAuth = await DeviceAuthManager.create(activeAccount);
      allDeviceAuths[activeAccount.accountId] = [deviceAuth, ...deviceAuths];
      toast.success($t('deviceAuthManagement.generated'), { id: toastId });
    } catch (error) {
      handleError(error, $t('deviceAuthManagement.failedToGenerate'), toastId);
    } finally {
      isGenerating = false;
    }
  }

  async function deleteDeviceAuth(deviceId: string) {
    isDeleting = true;

    const toastId = toast.loading($t('deviceAuthManagement.deleting'));
    const isCurrentDevice = deviceId === activeAccount.deviceId;

    try {
      await DeviceAuthManager.delete(activeAccount, deviceId);
      allDeviceAuths[activeAccount.accountId] = deviceAuths.filter((auth) => auth.deviceId !== deviceId);
      toast.success(isCurrentDevice ? $t('deviceAuthManagement.deletedAndLoggedOut') : $t('deviceAuthManagement.deleted'), { id: toastId });

      if (isCurrentDevice) {
        allDeviceAuths[activeAccount.accountId] = [];
        await Account.logout(activeAccount.accountId, false);
        if (!activeAccount) {
          await goto(await getStartingPage());
        }
      }
    } catch (error) {
      handleError(error, $t('deviceAuthManagement.failedToDelete'), toastId);
    } finally {
      isDeleting = false;
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString($language, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true
    });
  }

  $effect(() => {
    fetchDeviceAuths();
  });
</script>

<PageContent>
  {#snippet title()}
    <h2 class="text-4xl font-bold">
      {$t('deviceAuthManagement.page.title')}
    </h2>

    <PlusIcon
      class="ml-1 size-10 cursor-pointer {isGenerating ? 'opacity-50 !cursor-not-allowed' : ''}"
      onclick={generateDeviceAuth}
    />

    <Separator.Root class="bg-border h-10 w-px"/>

    <RefreshCwIcon
      class="ml-1.5 size-8 cursor-pointer {isFetching ? 'animate-spin opacity-50 !cursor-not-allowed' : ''}"
      onclick={() => fetchDeviceAuths(true)}
    />
  {/snippet}

  {#if !isFetching}
    <div class="grid grid-cols-1 md:grid-cols-2 place-items-center gap-4">
      {#each deviceAuths as auth (auth.deviceId)}
        <div class="border border-input rounded-md p-4 relative size-full bg-surface-alt">
          <div class="flex justify-between items-start">
            <div class="flex flex-col gap-y-1">
              <div class="flex items-center gap-2 w-fit mb-1">
                <span
                  class="font-semibold outline-none hover:underline underline-offset-2"
                  contenteditable
                  onblur={(event) => saveDeviceName(event, auth.deviceId)}
                  onkeydown={(event) => event.key === 'Enter' && event.preventDefault()}
                  role="textbox"
                  spellcheck="false"
                  tabindex="0"
                >
                  {$deviceAuthsStorage.find(x => x.deviceId === auth.deviceId)?.customName || $t('deviceAuthManagement.authInfo.noName')}
                </span>

                {#if auth.deviceId === activeAccount.deviceId}
                  <Tooltip tooltip={$t('deviceAuthManagement.authInfo.activeAuth')}>
                    <div class="size-2 bg-green-500 rounded-full shrink-0"></div>
                  </Tooltip>
                {/if}
              </div>

              <div class="flex flex-col gap-y-2">
                {#each [
                  { title: $t('deviceAuthManagement.authInfo.id'), value: auth.deviceId },
                  { title: 'User-Agent', value: auth.userAgent },
                  { title: 'Secret', value: auth.secret }
                ] as { title, value } (title)}
                  {#if value}
                    <div class="text-sm flex flex-col">
                      <span class="font-semibold">{title}</span>
                      <span class="text-muted-foreground">{value}</span>
                    </div>
                  {/if}
                {/each}

                {#each [
                  { title: $t('deviceAuthManagement.authInfo.created'), data: auth.created },
                  { title: $t('deviceAuthManagement.authInfo.lastAccess'), data: auth.lastAccess }
                ] as { title, data } (title)}
                  {#if data}
                    <div>
                      <span class="font-semibold">{title}</span>
                      <div>
                        <span class="text-sm font-semibold">{$t('deviceAuthManagement.authInfo.location')}:</span>
                        <span class="text-sm text-muted-foreground">{data.location}</span>
                      </div>
                      <div>
                        <span class="text-sm font-semibold">{$t('deviceAuthManagement.authInfo.ip')}:</span>
                        <span class="text-sm text-muted-foreground">{data.ipAddress}</span>
                      </div>
                      <div>
                        <span class="text-sm font-semibold">{$t('deviceAuthManagement.authInfo.date')}:</span>
                        <span class="text-sm text-muted-foreground">{formatDate(data.dateTime)}</span>
                      </div>
                    </div>
                  {/if}
                {/each}
              </div>
            </div>

            <Button
              class="absolute top-4 right-4 p-2"
              disabled={isDeleting}
              onclick={() => deleteDeviceAuth(auth.deviceId)}
              size="sm"
              variant="danger"
            >
              <Trash2Icon class="size-5"/>
            </Button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</PageContent>
