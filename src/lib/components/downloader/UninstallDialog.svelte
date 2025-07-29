<script lang="ts">
  import { Dialog } from '$components/ui/Dialog';
  import { ownedApps } from '$lib/stores';
  import Legendary from '$lib/core/legendary';
  import { handleError, t } from '$lib/utils/util';
  import LoaderCircleIcon from 'lucide-svelte/icons/loader-circle';
  import { toast } from 'svelte-sonner';

  type Props = {
    id: string;
  };

  let { id = $bindable() }: Props = $props();

  const app = $ownedApps.find(x => x.id === id)!;

  let isOpen = $state(true);
  let isDeleting = $state(false);

  async function uninstallApp() {
    isDeleting = true;

    try {
      await Legendary.uninstall(app.id);
      toast.success($t('library.uninstallConfirmation.uninstalled', { name: app.title }));
    } catch (error) {
      handleError(error, $t('library.uninstallConfirmation.failedToUninstall', { name: app.title }));
    } finally {
      isDeleting = false;
      isOpen = false;
    }
  }
</script>

<Dialog.Root
  description={$t('library.uninstallConfirmation.description', { name: app.title })}
  onOpenChangeComplete={(open) => !open && (id = '')}
  title={$t('library.uninstallConfirmation.title')}
  bind:open={isOpen}
>
  <div class="flex w-full items-center justify-center gap-2">
    <Dialog.Button buttonType="cancel">
      {$t('common.cancel')}
    </Dialog.Button>

    <Dialog.Button
      class="flex items-center gap-2"
      buttonType="action"
      color="epic"
      disabled={isDeleting}
      onclick={uninstallApp}
    >
      {#if isDeleting}
        <LoaderCircleIcon class="size-5 animate-spin"/>
      {/if}

      {$t('common.confirm')}
    </Dialog.Button>
  </div>
</Dialog.Root>