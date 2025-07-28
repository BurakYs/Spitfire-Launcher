<script lang="ts" module>
  import TaxiManager from '$lib/core/managers/automation/taxi-manager.svelte.js';
  import { SvelteMap } from 'svelte/reactivity';

  const taxiManagers = new SvelteMap<string, TaxiManager>();
</script>

<script lang="ts">
  import PageContent from '$components/PageContent.svelte';
  import Alert from '$components/ui/Alert.svelte';
  import Label from '$components/ui/Label.svelte';
  import DataStorage, { TAXI_FILE_PATH } from '$lib/core/data-storage';
  import { accountPartiesStore, accountsStore } from '$lib/stores';
  import { handleError, nonNull, t } from '$lib/utils/util';
  import type { TaxiSettings } from '$types/settings';
  import { onMount } from 'svelte';
  import Button from '$components/ui/Button.svelte';
  import { Separator } from 'bits-ui';
  import Switch from '$components/ui/Switch.svelte';
  import Input from '$components/ui/Input.svelte';
  import AlertTriangleIcon from 'lucide-svelte/icons/alert-triangle';
  import XIcon from 'lucide-svelte/icons/x';
  import CarTaxiFrontIcon from 'lucide-svelte/icons/car-taxi-front';
  import TaxiServiceTutorial from '$components/docs/tutorials/TaxiService.svelte';

  const MIN_POWER_LEVEL = 1;
  const MAX_POWER_LEVEL = 145;

  const activeAccount = $derived(nonNull($accountsStore.activeAccount));
  let customTaxiSettings = $state<TaxiSettings>([]);

  $effect(() => {
    if (!taxiManagers.has(activeAccount.accountId)) {
      taxiManagers.set(activeAccount.accountId, new TaxiManager(activeAccount));
    }

    const taxiManager = taxiManagers.get(activeAccount.accountId);
    const accountSettings = customTaxiSettings.find(settings => settings.accountId === activeAccount.accountId);
    if (!taxiManager || !accountSettings) return;

    taxiManager.availableStatus = accountSettings.availableStatus || taxiManager.availableStatus;
    taxiManager.busyStatus = accountSettings.busyStatus || taxiManager.busyStatus;
  });

  const taxiManager = $derived(taxiManagers.get(activeAccount.accountId) || new TaxiManager(activeAccount));

  async function startTaxiService() {
    try {
      await taxiManager.start();
    } catch (error) {
      handleError(error, $t('taxiService.failedToStart'));
    }
  }

  async function stopTaxiService() {
    try {
      await taxiManager.stop();
    } catch (error) {
      handleError(error, $t('taxiService.failedToStop'));
    }
  }

  function toggleAutoAccept() {
    taxiManager.handleFriendRequests();
  }

  function handleTaxiLevelChange(
    event: Event & { currentTarget: HTMLInputElement }
  ) {
    const value = event.currentTarget.value;
    if (!value) return;

    const oldLevel = taxiManager.level;
    const valueNumber = Number.parseInt(value);
    taxiManager.level = Number.isNaN(valueNumber) ? MAX_POWER_LEVEL : Math.min(Math.max(valueNumber, MIN_POWER_LEVEL), MAX_POWER_LEVEL);

    if (taxiManager.level === oldLevel) return;

    const party = accountPartiesStore.get(activeAccount.accountId);
    if (!party) return;

    taxiManager.setPowerLevel(party.id, party.revision);
  }

  function handleStatusChange(event: Event & { currentTarget: HTMLInputElement }, statusType: 'available' | 'busy') {
    const value = event.currentTarget.value;
    if (!value) return;

    const oldStatus = statusType === 'available' ? taxiManager.availableStatus : taxiManager.busyStatus;
    if (value === oldStatus) return;

    let settings = customTaxiSettings.find(settings => settings.accountId === activeAccount.accountId);

    if (!settings) {
      settings = { accountId: activeAccount.accountId };
      customTaxiSettings.push(settings);
    }

    if (statusType === 'available') {
      taxiManager.availableStatus = value;
      settings.availableStatus = value;
    } else {
      taxiManager.busyStatus = value;
      settings.busyStatus = value;
    }

    event.currentTarget.value = value;
    taxiManager.setIsAvailable(taxiManager.isAvailable);
    DataStorage.writeConfigFile<TaxiSettings>(TAXI_FILE_PATH, customTaxiSettings);
  }

  onMount(async () => {
    customTaxiSettings = await DataStorage.getTaxiFile();
  });
</script>

<PageContent
  description={$t('taxiService.page.description')}
  docsComponent={TaxiServiceTutorial}
  title={$t('taxiService.page.title')}
>
  <Alert
    color="yellow"
    icon={AlertTriangleIcon}
    message={$t('taxiService.alert.message')}
    title={$t('taxiService.alert.title')}
  />

  <div class="space-y-4">
    <div class="flex flex-col gap-2">
      <Label for="taxiLevel">{$t('taxiService.settings.powerLevel')}</Label>
      <Input
        id="taxiLevel"
        max={MAX_POWER_LEVEL}
        min={MIN_POWER_LEVEL}
        onConfirm={handleTaxiLevelChange}
        type="number"
        value={taxiManager.level}
      />
    </div>

    <div class="flex flex-col gap-2">
      <Label for="availableStatus">{$t('taxiService.settings.availableStatus.title')}</Label>
      <Input
        id="availableStatus"
        onConfirm={(event) => handleStatusChange(event, 'available')}
        placeholder={$t('taxiService.settings.availableStatus.placeholder')}
        value={taxiManager.availableStatus}
      />
    </div>

    <div class="flex flex-col gap-2">
      <Label for="busyStatus">{$t('taxiService.settings.busyStatus.title')}</Label>
      <Input
        id="busyStatus"
        onConfirm={(event) => handleStatusChange(event, 'busy')}
        placeholder={$t('taxiService.settings.busyStatus.placeholder')}
        value={taxiManager.busyStatus}
      />
    </div>

    <div class="flex items-center justify-between">
      <div class="font-medium">
        {$t('taxiService.settings.autoAcceptFriendRequests')}
      </div>
      <Switch
        onCheckedChange={toggleAutoAccept}
        bind:checked={taxiManager.autoAcceptFriendRequests}
      />
    </div>
  </div>

  <Separator.Root class="bg-border h-px"/>

  <div class="flex justify-end">
    <Button
      class="flex items-center gap-x-2"
      disabled={taxiManager.isStarting || taxiManager.isStopping}
      loading={taxiManager.isStarting || taxiManager.isStopping}
      loadingText={taxiManager.isStarting
        ? $t('taxiService.starting')
        : $t('taxiService.stopping')}
      onclick={() => taxiManager.active ? stopTaxiService() : startTaxiService()}
      variant={taxiManager.active ? 'danger' : 'epic'}
    >
      {#if taxiManager.active}
        <XIcon class="size-5"/>
        {$t('taxiService.stop')}
      {:else}
        <CarTaxiFrontIcon class="size-5"/>
        {$t('taxiService.start')}
      {/if}
    </Button>
  </div>
</PageContent>
