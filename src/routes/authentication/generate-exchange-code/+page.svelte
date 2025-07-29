<script lang="ts" module>
  let generatingExchangeCode = $state(false);
</script>

<script lang="ts">
  import PageContent from '$components/PageContent.svelte';
  import Button from '$components/ui/Button.svelte';
  import Authentication from '$lib/core/authentication';
  import { activeAccountStore } from '$lib/core/data-storage';
  import { toast } from 'svelte-sonner';
  import { handleError, nonNull, t } from '$lib/utils/util';
  import { writeText } from '@tauri-apps/plugin-clipboard-manager';

  const activeAccount = $derived(nonNull($activeAccountStore));

  async function openEpicGamesWebsite() {
    generatingExchangeCode = true;

    try {
      const accessToken = await Authentication.verifyOrRefreshAccessToken(activeAccount);
      const { code } = await Authentication.getExchangeCodeUsingAccessToken(accessToken);

      await writeText(code);
      toast.success($t('exchangeCodeManagement.generated'));
    } catch (error) {
      handleError(error, $t('exchangeCodeManagement.failedToGenerate'));
    } finally {
      generatingExchangeCode = false;
    }
  }
</script>

<PageContent
  description={$t('exchangeCodeManagement.page.description')}
  small={true}
  title={$t('exchangeCodeManagement.page.title')}
>
  <Button
    disabled={generatingExchangeCode}
    loading={generatingExchangeCode}
    loadingText={$t('exchangeCodeManagement.generating')}
    onclick={openEpicGamesWebsite}
    variant="epic"
  >
    {$t('exchangeCodeManagement.generate')}
  </Button>
</PageContent>
