<script lang="ts">
  import SettingItem from '$components/settings/SettingItem.svelte';
  import Input from '$components/ui/Input.svelte';
  import Select from '$components/ui/Select.svelte';
  import Switch from '$components/ui/Switch.svelte';
  import { SidebarCategories } from '$lib/constants/sidebar';
  import DataStorage, { SETTINGS_FILE_PATH, SETTINGS_INITIAL_DATA } from '$lib/core/dataStorage';
  import SystemTray from '$lib/core/system/systemTray';
  import { t } from '$lib/utils/util';
  import { allSettingsSchema, appSettingsSchema } from '$lib/validations/settings';
  import type { AllSettings } from '$types/settings';
  import { platform } from '@tauri-apps/plugin-os';
  import ChevronsUpAndDownIcon from 'lucide-svelte/icons/chevrons-up-down';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  const currentPlatform = platform();

  let allSettings = $state<AllSettings>(SETTINGS_INITIAL_DATA);

  type Settings = NonNullable<AllSettings['app']>;
  type SelectOption<T extends string> = {
    label: string;
    value: T;
  };

  const startingPageValues = Object.values<string>(appSettingsSchema.shape.startingPage.def.innerType.def.entries);
  const startingPageOptions = $SidebarCategories
    .map((category) => category.items)
    .flat()
    .filter((item) => startingPageValues.includes(item.key))
    .map((item) => ({
      label: item.name,
      value: item.key
    }));

  const startingAccountOptions: SelectOption<NonNullable<Settings['startingAccount']>>[] = [
    {
      label: $t('settings.appSettings.startingAccount.values.firstInList'),
      value: 'firstInTheList'
    },
    {
      label: $t('settings.appSettings.startingAccount.values.lastUsed'),
      value: 'lastUsed'
    }
  ];

  type SettingKey = keyof Settings;
  type SettingValue = string | number | boolean;

  function handleSettingChange<K extends SettingKey, V extends SettingValue = SettingValue>(
    eventOrValue: Event | V,
    key: K
  ) {
    const value = typeof eventOrValue === 'object'
      ? (eventOrValue.target as HTMLInputElement).value
      : eventOrValue;

    const newSettings: AllSettings = {
      ...allSettings,
      app: {
        ...allSettings.app,
        [key]: value
      }
    };

    if (!allSettingsSchema.safeParse(newSettings).success) {
      return toast.error($t('settings.invalidValue'));
    }

    allSettings = newSettings;
    SystemTray.setVisibility(allSettings.app?.hideToTray || false);
    DataStorage.writeConfigFile<AllSettings>(SETTINGS_FILE_PATH, allSettings);
  }

  function convertToNumber(event: Event) {
    return Number.parseFloat((event.target as HTMLInputElement).value);
  }

  onMount(async function () {
    allSettings = await DataStorage.getSettingsFile(true);
  });
</script>

<div class="space-y-6">
  {#if currentPlatform === 'windows'}
    <SettingItem
      labelFor="gamePath"
      orientation="vertical"
      title={$t('settings.appSettings.gamePath')}
    >
      <Input
        id="gamePath"
        onConfirm={(e) => handleSettingChange(e, 'gamePath')}
        placeholder="C:/Program Files/.../FortniteGame/Binaries/Win64"
        value={allSettings?.app?.gamePath}
        variant="outline"
      />
    </SettingItem>
  {/if}

  <SettingItem
    description={$t('settings.appSettings.missionCheckInterval.description')}
    labelFor="missionCheckInterval"
    orientation="vertical"
    title={$t('settings.appSettings.missionCheckInterval.title')}
  >
    <Input
      id="missionCheckInterval"
      max={10}
      min={1}
      onConfirm={(e) => handleSettingChange(convertToNumber(e), 'missionCheckInterval')}
      type="number"
      value={allSettings?.app?.missionCheckInterval}
      variant="outline"
    />
  </SettingItem>

  <SettingItem
    description={$t('settings.appSettings.claimRewardsDelay.description')}
    labelFor="claimRewardsDelay"
    orientation="vertical"
    title={$t('settings.appSettings.claimRewardsDelay.title')}
  >
    <Input
      id="claimRewardsDelay"
      max={10}
      min={1}
      onConfirm={(e) => handleSettingChange(convertToNumber(e), 'claimRewardsDelay')}
      type="number"
      value={allSettings?.app?.claimRewardsDelay}
      variant="outline"
    />
  </SettingItem>

  <SettingItem
    description={$t('settings.appSettings.startingPage.description')}
    labelFor="startingPage"
    orientation="vertical"
    title={$t('settings.appSettings.startingPage.title')}
  >
    <Select
      id="startingPage"
      items={startingPageOptions}
      triggerClass="w-full"
      type="single"
      bind:value={
        () => allSettings?.app?.startingPage,
        (value) => value && handleSettingChange(value, 'startingPage')
      }
    >
      {#snippet trigger(label)}
        <p>{label}</p>
        <ChevronsUpAndDownIcon class="text-muted-foreground size-5 ml-auto"/>
      {/snippet}
    </Select>
  </SettingItem>

  <SettingItem
    description={$t('settings.appSettings.startingAccount.description')}
    labelFor="startingAccount"
    orientation="vertical"
    title={$t('settings.appSettings.startingAccount.title')}
  >
    <Select
      id="startingAccount"
      items={startingAccountOptions}
      triggerClass="w-full"
      type="single"
      bind:value={
        () => allSettings?.app?.startingAccount,
        (value) => value && handleSettingChange(value, 'startingAccount')
      }
    >
      {#snippet trigger(label)}
        <p>{label}</p>
        <ChevronsUpAndDownIcon class="text-muted-foreground size-5 ml-auto"/>
      {/snippet}
    </Select>
  </SettingItem>

  {#if currentPlatform === 'windows' || currentPlatform === 'macos' || currentPlatform === 'linux'}
    <SettingItem
      labelFor="hideToTray"
      orientation="horizontal"
      title={$t('settings.appSettings.hideToTray')}
    >
      <Switch
        id="hideToTray"
        checked={allSettings?.app?.hideToTray}
        onCheckedChange={(checked) => handleSettingChange(checked, 'hideToTray')}
      />
    </SettingItem>
  {/if}

  <SettingItem
    labelFor="checkForUpdates"
    orientation="horizontal"
    title={$t('settings.appSettings.checkForUpdates')}
  >
    <Switch
      id="checkForUpdates"
      checked={allSettings?.app?.checkForUpdates}
      onCheckedChange={(checked) => handleSettingChange(checked, 'checkForUpdates')}
    />
  </SettingItem>
</div>
