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
      toast.success($t('exchangeCode.generated'));
    } catch (error) {
      handleError(error, $t('exchangeCode.failedToGenerate'));
    } finally {
      generatingExchangeCode = false;
    }
  }
</script>

<PageContent
  description={$t('exchangeCode.page.description')}
  small={true}
  title={$t('exchangeCode.page.title')}
>
  <Button
    disabled={generatingExchangeCode}
    loading={generatingExchangeCode}
    loadingText={$t('exchangeCode.generating')}
    onclick={openEpicGamesWebsite}
    variant="epic"
  >
    {$t('exchangeCode.generate')}
  </Button>
</PageContent>
