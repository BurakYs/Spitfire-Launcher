<script lang="ts">
  import SettingItem from '$components/settings/SettingItem.svelte';
  import Input from '$components/ui/Input.svelte';
  import Select from '$components/ui/Select.svelte';
  import Switch from '$components/ui/Switch.svelte';
  import { SidebarCategories } from '$lib/constants/sidebar';
  import { settingsStorage } from '$lib/core/data-storage';
  import { t } from '$lib/utils/util';
  import { allSettingsSchema, appSettingsSchema } from '$lib/validations/settings';
  import type { AllSettings } from '$types/settings';
  import { type } from '@tauri-apps/plugin-os';
  import ChevronsUpDownIcon from 'lucide-svelte/icons/chevrons-up-down';
  import { toast } from 'svelte-sonner';

  const currentPlatform = type();

  const startingPageValues = Object.values<string>(appSettingsSchema.shape.startingPage.def.innerType.def.entries);
  const startingPageOptions = $SidebarCategories
    .map((category) => category.items)
    .flat()
    .filter((item) => startingPageValues.includes(item.key))
    .map((item) => ({
      label: item.name,
      value: item.key
    }));

  type SettingKey = keyof NonNullable<AllSettings['app']>;
  type SettingValue = string | number | boolean;

  function handleSettingChange<K extends SettingKey, V extends SettingValue = SettingValue>(
    eventOrValue: Event | V,
    key: K
  ) {
    const value = typeof eventOrValue === 'object'
      ? (eventOrValue.target as HTMLInputElement).value
      : eventOrValue;

    const newSettings: AllSettings = {
      ...$settingsStorage,
      app: {
        ...$settingsStorage.app,
        [key]: value
      }
    };

    if (!allSettingsSchema.safeParse(newSettings).success) {
      return toast.error($t('settings.invalidValue'));
    }

    settingsStorage.set(newSettings);
  }

  function convertToNumber(event: Event) {
    return Number.parseFloat((event.target as HTMLInputElement).value);
  }
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
        value={$settingsStorage.app?.gamePath}
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
      value={$settingsStorage.app?.missionCheckInterval}
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
      value={$settingsStorage.app?.claimRewardsDelay}
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
        () => $settingsStorage.app?.startingPage,
        (value) => value && handleSettingChange(value, 'startingPage')
      }
    >
      {#snippet trigger(label)}
        <p>{label}</p>
        <ChevronsUpDownIcon class="text-muted-foreground size-5 ml-auto"/>
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
        checked={$settingsStorage.app?.hideToTray}
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
      checked={$settingsStorage.app?.checkForUpdates}
      onCheckedChange={(checked) => handleSettingChange(checked, 'checkForUpdates')}
    />
  </SettingItem>
</div>
