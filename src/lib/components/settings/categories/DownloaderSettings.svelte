<script lang="ts">
  import SettingItem from '$components/settings/SettingItem.svelte';
  import AccountCombobox from '$components/ui/Combobox/AccountCombobox.svelte';
  import Input from '$components/ui/Input.svelte';
  import Switch from '$components/ui/Switch.svelte';
  import DataStorage, { DOWNLOADER_FILE_PATH, DOWNLOADER_INITIAL_DATA } from '$lib/core/dataStorage';
  import { accountsStore } from '$lib/stores';
  import Legendary from '$lib/utils/legendary';
  import { nonNull, t } from '$lib/utils/util';
  import { downloaderSettingsSchema } from '$lib/validations/settings';
  import type { DownloaderSettings } from '$types/settings';
  import { onMount, untrack } from 'svelte';
  import { toast } from 'svelte-sonner';

  const allAccounts = $derived(nonNull($accountsStore.allAccounts));

  let loadingSettings = $state(true);
  let downloaderSettings = $state<DownloaderSettings>(DOWNLOADER_INITIAL_DATA);
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
      ...downloaderSettings,
      [key]: value
    };

    if (!downloaderSettingsSchema.safeParse(newSettings).success) {
      return toast.error($t('settings.invalidValue'));
    }

    downloaderSettings = newSettings;
    await DataStorage.writeConfigFile<DownloaderSettings>(DOWNLOADER_FILE_PATH, downloaderSettings);
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
        ? 'Switched downloader account successfully'
        : 'Logged out of downloader account'
      );
    } catch (error) {
      console.error(error);
      toast.error(accountId
        ? 'Failed to switch downloader account'
        : 'Failed to log out of downloader account'
      );
    } finally {
      switchingDownloaderAccount = false;
    }
  }

  onMount(async function () {
    loadingSettings = true;

    downloaderSettings = await DataStorage.getDownloaderFile(true);
    downloaderAccountId = await Legendary.getAccount() || undefined;

    loadingSettings = false;

    setTimeout(() => {
      mounted = true;
    }, 0);
  });
</script>

<div class="space-y-6">
  <SettingItem
    labelFor="downloadPath"
    orientation="vertical"
    title={$t('settings.downloaderSettings.downloadPath.title')}
  >
    <Input
      id="downloadPath"
      onConfirm={(e) => handleSettingChange(e, 'downloadPath')}
      placeholder={DOWNLOADER_INITIAL_DATA.downloadPath}
      value={downloaderSettings?.downloadPath}
      variant="outline"
    />
  </SettingItem>

  <SettingItem
    labelFor="account"
    orientation="vertical"
    title={$t('settings.downloaderSettings.account.title')}
  >
    <AccountCombobox
      disabled={switchingDownloaderAccount || loadingSettings}
      triggerClass="bg-transparent"
      type="single"
      bind:selected={downloaderAccountId}
    />
  </SettingItem>

  <SettingItem
    labelFor="autoUpdate"
    orientation="horizontal"
    title={$t('settings.downloaderSettings.autoUpdate.title')}
  >
    <Switch
      id="autoUpdate"
      checked={downloaderSettings.autoUpdate}
      onCheckedChange={(checked) => handleSettingChange(checked, 'autoUpdate')}
    />
  </SettingItem>

  <SettingItem
    labelFor="sendNotifications"
    orientation="horizontal"
    title={$t('settings.downloaderSettings.sendNotifications.title')}
  >
    <Switch
      id="sendNotifications"
      checked={downloaderSettings.sendNotifications}
      onCheckedChange={(checked) => handleSettingChange(checked, 'sendNotifications')}
    />
  </SettingItem>
</div>
