<script lang="ts" module>
  import type { BulkActionStatus } from '$types/accounts';

  type EULAStatus = BulkActionStatus<{
    acceptLink?: string;
  }>;

  // eslint-disable-next-line svelte/prefer-writable-derived -- We assign this state later
  let selectedAccounts = $state<string[]>([]);
  let isFetching = $state(false);
  let eulaStatuses = $state<EULAStatus[]>([]);
</script>

<script lang="ts">
  import { page } from '$app/state';
  import PageContent from '$components/PageContent.svelte';
  import AccountCombobox from '$components/ui/Combobox/AccountCombobox.svelte';
  import Button from '$components/ui/Button.svelte';
  import ExternalLink from '$components/ui/ExternalLink.svelte';
  import { launcherAppClient2 } from '$lib/constants/clients';
  import EULAManager from '$lib/core/managers/eula';
  import ExternalLinkIcon from 'lucide-svelte/icons/external-link';
  import { doingBulkOperations } from '$lib/stores';
  import { toast } from 'svelte-sonner';
  import Authentication from '$lib/core/authentication';
  import EpicAPIError from '$lib/exceptions/EpicAPIError';
  import { getAccountsFromSelection, t } from '$lib/utils/util';

  type PageState = {
    selectedAccounts?: string[];
  };

  $effect(() => {
    selectedAccounts = (page.state as PageState).selectedAccounts || [];
  });

  async function checkEULA(event: SubmitEvent) {
    event.preventDefault();

    isFetching = true;
    doingBulkOperations.set(true);
    eulaStatuses = [];

    const accounts = getAccountsFromSelection(selectedAccounts);
    await Promise.allSettled(accounts.map(async (account) => {
      const status: EULAStatus = { accountId: account.accountId, displayName: account.displayName, data: {} };
      eulaStatuses.push(status);

      try {
        // TODO:  Fastest way I could find. Might change later
        const accessToken = await Authentication.verifyOrRefreshAccessToken(account);
        const exchangeData = await Authentication.getExchangeCodeUsingAccessToken(accessToken);
        const launcherAccessTokenData = await Authentication.getAccessTokenUsingExchangeCode(exchangeData.code, launcherAppClient2);
        await Authentication.getExchangeCodeUsingAccessToken(launcherAccessTokenData.access_token);
      } catch (error) {
        if (!(error instanceof EpicAPIError)) return;

        if (error.errorCode === 'errors.com.epicgames.oauth.corrective_action_required' && error.continuationUrl) {
          status.data.acceptLink = error.continuationUrl;
        }
      } finally {
        const gameEULAData = await EULAManager.check(account).catch(() => null);
        if (gameEULAData) await EULAManager.accept(account, gameEULAData.version).catch(() => null);
      }
    }));

    eulaStatuses = eulaStatuses.filter((status) => status.data.acceptLink);

    if (!eulaStatuses.length) {
      toast.info($t('eula.allAccountsAlreadyAccepted'));
    }

    doingBulkOperations.set(false);
    isFetching = false;
  }
</script>

<PageContent small={true} title={$t('eula.page.title')}>
  <form class="flex flex-col gap-y-2" onsubmit={checkEULA}>
    <AccountCombobox
      disabled={isFetching}
      type="multiple"
      bind:selected={selectedAccounts}
    />

    <Button
      class="mt-2"
      disabled={!selectedAccounts?.length || isFetching}
      loading={isFetching}
      loadingText={$t('eula.checking')}
      type="submit"
      variant="epic"
    >
      {$t('eula.check')}
    </Button>
  </form>

  {#if !isFetching && eulaStatuses.length}
    <div class="mt-4 space-y-4">
      {#each eulaStatuses as status (status.accountId)}
        <div class="flex items-center justify-between px-3 py-2 bg-muted border rounded-lg">
          <span class="font-semibold truncate">{status.displayName}</span>

          <ExternalLink
            class="hover:bg-muted-foreground/10 flex size-8 items-center justify-center rounded-md"
            href={status.data.acceptLink!}
          >
            <ExternalLinkIcon class="size-5"/>
          </ExternalLink>
        </div>
      {/each}
    </div>
  {/if}
</PageContent>
