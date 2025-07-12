<script lang="ts" module>
  let generatingAccessToken = $state(false);
</script>

<script lang="ts">
  import PageContent from '$components/PageContent.svelte';
  import { accountsStore } from '$lib/stores';
  import Button from '$components/ui/Button.svelte';
  import Authentication from '$lib/core/authentication';
  import { toast } from 'svelte-sonner';
  import { nonNull, shouldErrorBeIgnored, t } from '$lib/utils/util';
  import { writeText } from '@tauri-apps/plugin-clipboard-manager';
  import Select from '$components/ui/Select.svelte';
  import KeyRound from 'lucide-svelte/icons/key-round';
  import ChevronsUpAndDownIcon from 'lucide-svelte/icons/chevrons-up-down';
  import { defaultClient, fortniteAndroidGameClient, fortnitePCGameClient, launcherAppClient2 } from '$lib/constants/clients';

  const activeAccount = $derived(nonNull($accountsStore.activeAccount));

  let selectedTokenType = $state<'eg1' | 'bearer'>();
  const tokenTypeOptions = [
    { value: 'eg1', label: 'EG1' },
    { value: 'bearer', label: 'Bearer' }
  ];

  let selectedClient = $state<string>();
  const allClients = [fortniteAndroidGameClient, fortnitePCGameClient, launcherAppClient2];
  const clientOptions = allClients.map(client => ({ value: client.clientId, label: client.name }));

  async function generateAccessToken(event: SubmitEvent) {
    event.preventDefault();

    generatingAccessToken = true;

    try {
      let accessTokenData = await Authentication.getAccessTokenUsingDeviceAuth(activeAccount, false, selectedTokenType);

      if (selectedClient !== defaultClient.clientId) {
        const { code } = await Authentication.getExchangeCodeUsingAccessToken(accessTokenData.access_token);

        const client = allClients.find(client => client.clientId === selectedClient);
        accessTokenData = await Authentication.getAccessTokenUsingExchangeCode(code, client, selectedTokenType);
      }

      await writeText(accessTokenData.access_token);
      toast.success($t('accessTokenManagement.generated'));
    } catch (error) {
      if (shouldErrorBeIgnored(error)) return;

      console.error(error);
      toast.error($t('accessTokenManagement.failedToGenerate'));
    } finally {
      generatingAccessToken = false;
    }
  }
</script>

<PageContent small={true} title={$t('accessTokenManagement.page.title')}>
  <form class="flex flex-col gap-y-2" onsubmit={generateAccessToken}>
    <Select
      items={tokenTypeOptions}
      triggerClass="bg-surface-alt"
      type="single"
      bind:value={selectedTokenType}
    >
      {#snippet trigger(label)}
        <KeyRound class="text-muted-foreground size-5 mr-2"/>
        <span class="text-muted-foreground">{label || $t('accessTokenManagement.selectTokenType')}</span>
        <ChevronsUpAndDownIcon class="text-muted-foreground size-5 ml-auto"/>
      {/snippet}
    </Select>

    <Select
      items={clientOptions}
      triggerClass="bg-surface-alt"
      type="single"
      bind:value={selectedClient}
    >
      {#snippet trigger(label)}
        <KeyRound class="text-muted-foreground size-5 mr-2"/>
        <span class="text-muted-foreground">{label || $t('accessTokenManagement.selectClient')}</span>
        <ChevronsUpAndDownIcon class="text-muted-foreground size-5 ml-auto"/>
      {/snippet}
    </Select>

    <Button
      class="mt-2"
      disabled={generatingAccessToken || !selectedTokenType || !selectedClient}
      loading={generatingAccessToken}
      loadingText={$t('accessTokenManagement.generating')}
      type="submit"
      variant="epic"
    >
      {$t('accessTokenManagement.generate')}
    </Button>
  </form>
</PageContent>
