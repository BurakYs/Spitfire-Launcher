<script lang="ts" module>
  let isLoggingIn = $state(false);
</script>

<script lang="ts">
  import PageContent from '$components/PageContent.svelte';
  import Button from '$components/ui/Button.svelte';
  import Authentication from '$lib/core/authentication';
  import { activeAccountStore } from '$lib/core/data-storage';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { toast } from 'svelte-sonner';
  import { handleError, nonNull, t } from '$lib/utils/util';

  const activeAccount = $derived(nonNull($activeAccountStore));

  async function openEpicGamesWebsite() {
    isLoggingIn = true;

    try {
      const accessToken = await Authentication.verifyOrRefreshAccessToken(activeAccount);
      const { code: exchangeCode } = await Authentication.getExchangeCodeUsingAccessToken(accessToken);

      await openUrl(`https://www.epicgames.com/id/exchange?exchangeCode=${exchangeCode}`);
      toast.success($t('epicGamesWebsite.openedWebsite'));
    } catch (error) {
      handleError(error, $t('epicGamesWebsite.failedToOpenWebsite'));
    } finally {
      isLoggingIn = false;
    }
  }
</script>

<PageContent
  description={$t('epicGamesWebsite.page.description')}
  small={true}
  title={$t('epicGamesWebsite.page.title')}
>
  <Button
    disabled={isLoggingIn}
    loading={isLoggingIn}
    loadingText={$t('epicGamesWebsite.loggingIn')}
    onclick={openEpicGamesWebsite}
    variant="epic"
  >
    {$t('epicGamesWebsite.login')}
  </Button>
</PageContent>
