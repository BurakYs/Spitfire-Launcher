<script lang="ts">
  import AutoKickTutorial from '$components/docs/tutorials/AutoKick.svelte';
  import PageContent from '$components/PageContent.svelte';
  import Alert from '$components/ui/Alert.svelte';
  import Button from '$components/ui/Button.svelte';
  import { accountsStorage } from '$lib/core/data-storage';
  import AutoKickBase from '$lib/core/managers/autokick/base';
  import { cn, nonNull, t } from '$lib/utils/util';
  import Switch from '$components/ui/Switch.svelte';
  import type { AutomationSetting as AutomationSettingWithId } from '$types/settings';
  import { platform } from '@tauri-apps/plugin-os';
  import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import AccountCombobox from '$components/ui/Combobox/AccountCombobox.svelte';

  type AutomationSetting = keyof Omit<AutomationSettingWithId, 'accountId'>;

  const allAccounts = $derived(nonNull($accountsStorage.accounts));
  const autoKickDisabledAccounts = $derived(allAccounts.filter((x) => !AutoKickBase.accounts.has(x.accountId)));
  const currentPlatform = platform();

  function handleAccountSelect(accountId: string) {
    if (!accountId) return;

    const isAlreadyAdded = AutoKickBase.accounts.has(accountId);
    if (isAlreadyAdded) return;

    const account = allAccounts.find((x) => x.accountId === accountId)!;
    AutoKickBase.addAccount(account, {
      autoKick: true
    });
  }

  const settings: { id: AutomationSetting; label: string; }[] = $derived([
    {
      id: 'autoKick',
      label: $t('autoKick.settings.kick')
    },
    {
      id: 'autoClaim',
      label: $t('autoKick.settings.claim')
    },
    {
      id: 'autoTransferMaterials',
      label: $t('autoKick.settings.transferMaterials')
    },
    {
      id: 'autoInvite',
      label: $t('autoKick.settings.invite')
    }
  ]);
</script>

<PageContent
  class="@container"
  description={$t('autoKick.page.description')}
  docsComponent={AutoKickTutorial}
  title={$t('autoKick.page.title')}
>
  {#if currentPlatform === 'android' || currentPlatform === 'ios'}
    <Alert
      color="yellow"
      icon={AlertTriangleIcon}
      message={$t('autoKick.mobileIncompatibilityWarning.description')}
      title={$t('autoKick.mobileIncompatibilityWarning.title')}
    />
  {/if}

  <div class="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-2 text-muted-foreground text-sm">
    <div class="flex items-center gap-x-2">
      <div class="size-2 rounded-full bg-green-500"></div>
      <span>{$t('autoKick.accountStatus.active')}</span>
    </div>

    <div class="flex items-center gap-x-2">
      <div class="size-2 rounded-full bg-red-500"></div>
      <span>{$t('autoKick.accountStatus.loginExpired')}</span>
    </div>

    <div class="flex items-center gap-x-2">
      <div class="size-2 rounded-full bg-gray-500"></div>
      <span>{$t('autoKick.accountStatus.disconnected')}</span>
    </div>
  </div>

  <AccountCombobox
    autoSelect={false}
    customList={autoKickDisabledAccounts}
    onValueChange={handleAccountSelect}
    type="single"
  />

  {#if AutoKickBase.accounts.size}
    <div class="grid grid-cols-1 place-items-center @md:grid-cols-2 @lg:grid-cols-3 gap-4">
      {#each AutoKickBase.accounts as [accountId, automationAccount] (accountId)}
        {@const isLoading = automationAccount.status === 'LOADING'}

        <div class="border rounded-lg shadow-sm overflow-hidden w-56">
          <div class="bg-muted p-4 flex items-center justify-between h-12">
            <div class="flex items-center gap-2">
              <div
                class={cn(
                  'size-2 rounded-full',
                  (automationAccount.status === 'DISCONNECTED' || isLoading) && 'bg-gray-500',
                  automationAccount.status === 'ACTIVE' && 'bg-green-500',
                  automationAccount.status === 'INVALID_CREDENTIALS' && 'bg-red-500'
                )}
              ></div>
              <span class="font-medium">{allAccounts.find((x) => x.accountId === accountId)?.displayName || accountId}</span>
            </div>

            <Button
              class="flex items-center justify-center hover:bg-muted-foreground/50 hover:text-destructive size-8"
              disabled={isLoading}
              onclick={() => AutoKickBase.removeAccount(accountId)}
              size="sm"
              variant="ghost"
            >
              {#if isLoading}
                <RefreshCwIcon class="size-6 animate-spin opacity-50 !cursor-not-allowe}"/>
              {:else}
                <Trash2Icon class="size-4"/>
              {/if}
            </Button>
          </div>

          <div class="px-4 py-2 space-y-1">
            {#each settings as setting (setting.id)}
              <div class="flex items-center justify-between py-1.5">
                <span class="text-sm mr-5">{setting.label}</span>
                <Switch
                  checked={automationAccount.settings[setting.id]}
                  disabled={isLoading || (setting.id === 'autoInvite' && !automationAccount.settings.autoKick)}
                  onCheckedChange={(checked) => AutoKickBase.updateSettings(accountId, { [setting.id]: checked })}
                />
              </div>

              {#if setting !== settings[settings.length - 1]}
                <div class="border-t"></div>
              {/if}
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</PageContent>
