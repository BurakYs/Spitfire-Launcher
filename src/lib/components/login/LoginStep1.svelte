<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input/Input.svelte';
  import { defaultClient, fortniteNewSwitchGameClient } from '$lib/constants/clients';
  import Account from '$lib/core/account';
  import Authentication from '$lib/core/authentication';
  import { accountsStorage } from '$lib/core/data-storage';
  import DeviceAuthManager from '$lib/core/managers/device-auth';
  import { oauthService } from '$lib/core/services';
  import { handleError, nonNull, t } from '$lib/utils/util';
  import type { DeviceCodeLoginData, EpicOAuthData } from '$types/game/authorizations';
  import { readText } from '@tauri-apps/plugin-clipboard-manager';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
  import type { LoginMethod } from '$lib/components/login/LoginStep0.svelte';
  import { toast } from 'svelte-sonner';
  import { fade } from 'svelte/transition';

  type Props = {
    selectedMethod: LoginMethod;
    goToPreviousStep: () => void;
    goToNextStep: () => void;
  };

  const {
    selectedMethod,
    goToPreviousStep,
    goToNextStep
  }: Props = $props();

  const allAccounts = $derived(nonNull($accountsStorage.accounts));

  let exchangeCode = $state<string>();
  let exchangeForm = $state<HTMLFormElement>();
  let isLoggingIn = $state(false);
  let deviceCodeVerifyButtonDisabled = $state(true);
  let deviceCodeData = $state<{ code: string; verificationUrl: string }>();

  $effect(() => {
    if (selectedMethod === 'webConfirmation') {
      generateDeviceCodeLink();

      setTimeout(() => {
        deviceCodeVerifyButtonDisabled = false;
      }, 5000);
    }

    if (selectedMethod === 'exchangeCode') {
      exchangeCodeFromClipboard();
    }
  });

  async function exchangeCodeFromClipboard() {
    const clipboardText = (await readText()).replace(/["'`|]/g, '').trim();
    const matchesExchange = /^[a-z0-9]{32}$/.test(clipboardText);
    if (!matchesExchange) return;

    exchangeCode = clipboardText;

    setTimeout(() => {
      exchangeForm?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  }

  async function handleExchangeCodeSubmit(event: SubmitEvent) {
    event.preventDefault();

    if (!exchangeCode?.trim()) return;

    isLoggingIn = true;

    try {
      const accessTokenData = await Authentication.getAccessTokenUsingExchangeCode(exchangeCode);
      await handleLogin(accessTokenData);
    } catch (error) {
      handleError(error, $t('accountManager.failedToLogin'));
    } finally {
      isLoggingIn = false;
    }
  }

  async function generateDeviceCodeLink() {
    const clientToken = await Authentication.getAccessTokenUsingClientCredentials(fortniteNewSwitchGameClient);
    const deviceCodeResponse = await oauthService.post<DeviceCodeLoginData>('deviceAuthorization', {
      body: new URLSearchParams({ prompt: 'login' }).toString(),
      headers: {
        Authorization: `Bearer ${clientToken.access_token}`
      }
    }).json();

    deviceCodeData = {
      code: deviceCodeResponse.device_code,
      verificationUrl: deviceCodeResponse.verification_uri_complete
    };
  }

  async function handleWebConfirmation() {
    isLoggingIn = true;

    try {
      const newSwitchAccessTokenData = await Authentication.getAccessTokenUsingDeviceCode(
        deviceCodeData!.code,
        fortniteNewSwitchGameClient
      );

      const newSwitchExchangeCode = await Authentication.getExchangeCodeUsingAccessToken(newSwitchAccessTokenData.access_token);
      const androidAccessTokenData = await Authentication.getAccessTokenUsingExchangeCode(newSwitchExchangeCode.code);

      await handleLogin(androidAccessTokenData);
    } catch (error) {
      handleError(error, $t('accountManager.confirmRequest'));
    } finally {
      isLoggingIn = false;
    }
  }

  async function handleLogin(accessTokenData: EpicOAuthData) {
    if (accessTokenData.client_id !== defaultClient.clientId) {
      toast.error('Invalid client ID');
      return;
    }

    if (allAccounts.some((account) => account.accountId === accessTokenData.account_id)) {
      toast.error($t('accountManager.alreadyLoggedIn', { name: accessTokenData.displayName }));
      return;
    }

    const deviceAuthData = await DeviceAuthManager.create({
      accountId: accessTokenData.account_id,
      accessToken: accessTokenData.access_token
    });

    await Account.addAccount({
      displayName: accessTokenData.displayName,
      accountId: accessTokenData.account_id,
      deviceId: deviceAuthData.deviceId,
      secret: deviceAuthData.secret
    });

    goToNextStep();
  }

  function openDeviceCodeLink() {
    openUrl(deviceCodeData!.verificationUrl);
  }
</script>

<div class="flex flex-col" in:fade={{ duration: 200 }}>
  <button
    class="mb-4 flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    onclick={goToPreviousStep}
  >
    <ArrowLeftIcon class="size-4"/>
    {$t('accountManager.back')}
  </button>

  {#if selectedMethod === 'webConfirmation'}
    <h3 class="text-lg font-medium">
      {$t('accountManager.loginMethods.webConfirmation.title')}
    </h3>
    <p class="mb-4 text-sm text-muted-foreground">
      {$t('accountManager.loginMethods.webConfirmation.instructions')}
    </p>

    <div class="mb-6 rounded-lg">
      <Button
        class="flex justify-center items-center gap-x-2 w-full"
        disabled={!deviceCodeData?.verificationUrl}
        loading={!deviceCodeData?.verificationUrl}
        loadingText={$t('accountManager.loginMethods.webConfirmation.generatingURL')}
        onclick={openDeviceCodeLink}
        variant="outline"
      >
        <ExternalLinkIcon class="size-4"/>
        {$t('accountManager.loginMethods.webConfirmation.openWebsite')}
      </Button>
    </div>

    {#if !deviceCodeVerifyButtonDisabled}
      <Button
        class="w-full"
        disabled={isLoggingIn ||
          deviceCodeVerifyButtonDisabled ||
          !deviceCodeData?.verificationUrl}
        loading={isLoggingIn}
        loadingText={$t('accountManager.verifying')}
        onclick={handleWebConfirmation}
        variant="epic"
      >
        {$t('accountManager.continue')}
      </Button>
    {/if}
  {:else if selectedMethod === 'exchangeCode'}
    <h3 class="text-lg font-medium">
      {$t('accountManager.loginMethods.exchangeCode.title')}
    </h3>
    <p class="mb-4 text-sm text-muted-foreground">
      {$t('accountManager.loginMethods.exchangeCode.instructions')}
    </p>

    <form bind:this={exchangeForm} class="flex flex-col gap-y-4 flex-1 justify-between h-full" onsubmit={handleExchangeCodeSubmit}>
      <Input
        autofocus={true}
        disabled={isLoggingIn}
        placeholder={$t('accountManager.loginMethods.exchangeCode.inputPlaceholder')}
        type="text"
        bind:value={exchangeCode}
      />

      <div class="flex-1"></div>

      <Button
        class="w-full flex items-center justify-center gap-2 mt-auto"
        disabled={!exchangeCode?.trim() ||
          exchangeCode?.trim().length !== 32 ||
          isLoggingIn}
        loading={isLoggingIn}
        loadingText={$t('accountManager.verifying')}
        type="submit"
        variant="epic"
      >
        {$t('accountManager.continue')}
      </Button>
    </form>
  {/if}
</div>
