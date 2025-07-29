<script lang="ts">
  import SettingItem from '$components/settings/SettingItem.svelte';
  import AccountCombobox from '$components/ui/Combobox/AccountCombobox.svelte';
  import Input from '$components/ui/Input.svelte';
  import Switch from '$components/ui/Switch.svelte';
  import DownloadManager from '$lib/core/managers/download.svelte';
  import { accountsStorage, downloaderStorage } from '$lib/core/data-storage';
  import Legendary from '$lib/core/legendary';
  import { handleError, nonNull, t } from '$lib/utils/util';
  import { downloaderSettingsSchema } from '$lib/validations/settings';
  import type { DownloaderSettings } from '$types/settings';
  import { onMount, untrack } from 'svelte';
  import { toast } from 'svelte-sonner';

  const allAccounts = $derived(nonNull($accountsStorage.accounts));

  let loadingAccount = $state(true);
  let downloaderAccountId = $state<string>();
  let switchingDownloaderAccount = $state(false);
  let mounted = false;

  $effect(() => {
    const accountId = downloaderAccountId;
    if (mounted) {
      untrack(() => {
        switchDownloaderAccount(accountId);
      });
    }
  });

  type SettingKey = keyof NonNullable<DownloaderSettings>;
  type SettingValue = string | number | boolean;

  async function handleSettingChange<K extends SettingKey, V extends SettingValue = SettingValue>(
    eventOrValue: Event | V,
    key: K
  ) {
    const value = typeof eventOrValue === 'object' && eventOrValue
      ? (eventOrValue.target as HTMLInputElement).value
      : eventOrValue;

    const newSettings: DownloaderSettings = {
      ...$downloaderStorage,
      [key]: value
    };

    if (!downloaderSettingsSchema.safeParse(newSettings).success) {
      return toast.error($t('settings.invalidValue'));
    }

    downloaderStorage.set(newSettings);
  }

  async function switchDownloaderAccount(accountId?: string) {
    switchingDownloaderAccount = true;

    try {
      const { account: currentAccount } = await Legendary.getStatus();
      if (currentAccount) {
        await Legendary.logout();
      }

      if (accountId) {
        const account = allAccounts.find(acc => acc.accountId === accountId)!;
        await Legendary.login(account);
      }

      toast.success(accountId
        ? $t('settings.downloaderSettings.account.switched')
        : $t('settings.downloaderSettings.account.loggedOut')
      );
    } catch (error) {
      handleError(error, accountId
        ? $t('settings.downloaderSettings.account.failedToSwitch')
        : $t('settings.downloaderSettings.account.failedToLogout')
      );
    } finally {
      switchingDownloaderAccount = false;
    }
  }

  onMount(async function () {
    downloaderAccountId = await Legendary.getAccount() || undefined;
    loadingAccount = false;

    setTimeout(() => {
      mounted = true;
    });
  });
</script>

<div class="space-y-6">
  <SettingItem
    description={$t('settings.downloaderSettings.downloadPath.description')}
    labelFor="downloadPath"
    orientation="vertical"
    title={$t('settings.downloaderSettings.downloadPath.title')}
  >
    <Input
      id="downloadPath"
      onConfirm={(e) => handleSettingChange(e, 'downloadPath')}
      placeholder={$downloaderStorage.downloadPath}
      value={$downloaderStorage?.downloadPath}
      variant="outline"
    />
  </SettingItem>

  <SettingItem
    description={$t('settings.downloaderSettings.account.description')}
    labelFor="account"
    orientation="vertical"
    title={$t('settings.downloaderSettings.account.title')}
  >
    <AccountCombobox
      disabled={switchingDownloaderAccount || loadingAccount || !!DownloadManager.downloadingAppId}
      triggerClass="bg-transparent"
      type="single"
      bind:selected={downloaderAccountId}
    />
  </SettingItem>

  <SettingItem
    description={$t('settings.downloaderSettings.autoUpdate.description')}
    labelFor="autoUpdate"
    orientation="horizontal"
    title={$t('settings.downloaderSettings.autoUpdate.title')}
  >
    <Switch
      id="autoUpdate"
      checked={$downloaderStorage.autoUpdate}
      onCheckedChange={(checked) => handleSettingChange(checked, 'autoUpdate')}
    />
  </SettingItem>

  <SettingItem
    description={$t('settings.downloaderSettings.sendNotifications.description')}
    labelFor="sendNotifications"
    orientation="horizontal"
    title={$t('settings.downloaderSettings.sendNotifications.title')}
  >
    <Switch
      id="sendNotifications"
      checked={$downloaderStorage.sendNotifications}
      onCheckedChange={(checked) => handleSettingChange(checked, 'sendNotifications')}
    />
  </SettingItem>
</div>
