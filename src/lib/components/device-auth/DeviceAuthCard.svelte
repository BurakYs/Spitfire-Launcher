<script lang="ts">
  import { goto } from '$app/navigation';
  import Button from '$components/ui/Button.svelte';
  import Tooltip from '$components/ui/Tooltip.svelte';
  import Account from '$lib/core/account';
  import { activeAccountStore, deviceAuthsStorage, language } from '$lib/core/data-storage';
  import DeviceAuthManager from '$lib/core/managers/device-auth';
  import { getStartingPage, handleError, nonNull, t } from '$lib/utils/util';
  import type { EpicDeviceAuthData } from '$types/game/authorizations';
  import Trash2Icon from 'lucide-svelte/icons/trash-2';
  import { toast } from 'svelte-sonner';

  type Props = {
    auth: EpicDeviceAuthData;
    allDeviceAuths: Record<string, EpicDeviceAuthData[]>;
  };

  const { auth, allDeviceAuths }: Props = $props();

  const activeAccount = $derived(nonNull($activeAccountStore));
  let isDeleting = $state(false);

  async function saveDeviceName(event: FocusEvent & { currentTarget: HTMLSpanElement }, deviceId: string) {
    if (!deviceId) return;

    const newName = event.currentTarget.textContent?.trim();
    if (!newName) {
      event.currentTarget.textContent = $t('deviceAuth.authInfo.noName');

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

  async function deleteDeviceAuth(deviceId: string) {
    isDeleting = true;

    const toastId = toast.loading($t('deviceAuth.deleting'));
    const isCurrentDevice = deviceId === activeAccount.deviceId;

    try {
      await DeviceAuthManager.delete(activeAccount, deviceId);
      allDeviceAuths[activeAccount.accountId] = allDeviceAuths[activeAccount.accountId].filter((auth) => auth.deviceId !== deviceId);
      toast.success(isCurrentDevice ? $t('deviceAuth.deletedAndLoggedOut') : $t('deviceAuth.deleted'), { id: toastId });

      if (isCurrentDevice) {
        allDeviceAuths[activeAccount.accountId] = [];
        await Account.logout(activeAccount.accountId, false);

        if (!activeAccount) {
          await goto(await getStartingPage());
        }
      }
    } catch (error) {
      handleError(error, $t('deviceAuth.failedToDelete'), toastId);
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
</script>

<div class="border rounded-md p-4 relative size-full bg-surface-alt">
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
          {$deviceAuthsStorage.find(x => x.deviceId === auth.deviceId)?.customName || $t('deviceAuth.authInfo.noName')}
        </span>

        {#if auth.deviceId === activeAccount.deviceId}
          <Tooltip message={$t('deviceAuth.authInfo.activeAuth')}>
            <div class="size-2 bg-green-500 rounded-full shrink-0"></div>
          </Tooltip>
        {/if}
      </div>

      <div class="flex flex-col gap-y-2">
        {#each [
          { title: $t('deviceAuth.authInfo.id'), value: auth.deviceId },
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
          { title: $t('deviceAuth.authInfo.created'), data: auth.created },
          { title: $t('deviceAuth.authInfo.lastAccess'), data: auth.lastAccess }
        ] as { title, data } (title)}
          {#if data}
            <div>
              <span class="font-semibold">{title}</span>
              <div>
                <span class="text-sm font-semibold">{$t('deviceAuth.authInfo.location')}:</span>
                <span class="text-sm text-muted-foreground">{data.location}</span>
              </div>
              <div>
                <span class="text-sm font-semibold">{$t('deviceAuth.authInfo.ip')}:</span>
                <span class="text-sm text-muted-foreground">{data.ipAddress}</span>
              </div>
              <div>
                <span class="text-sm font-semibold">{$t('deviceAuth.authInfo.date')}:</span>
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