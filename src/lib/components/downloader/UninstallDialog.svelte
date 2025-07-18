<script lang="ts">
  import AlertDialogButton from '$components/ui/AlertDialog/AlertDialogButton.svelte';
  import Dialog from '$components/ui/Dialog.svelte';
  import { ownedApps } from '$lib/stores';
  import Legendary from '$lib/utils/legendary';
  import { bytesToSize, t } from '$lib/utils/util';
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
      console.error(error);
      toast.error($t('library.uninstallConfirmation.failedToUninstall', { name: app.title }));
    } finally {
      isDeleting = false;
      isOpen = false;
    }
  }
</script>

<Dialog
  description={$t('library.uninstallConfirmation.description', { name: app.title })}
  onOpenChangeComplete={(open) => !open && (id = '')}
  title={$t('library.uninstallConfirmation.title')}
  bind:open={isOpen}
>
  <div class="flex w-full items-center justify-center gap-2">
    <AlertDialogButton buttonType="cancel">
      {$t('common.cancel')}
    </AlertDialogButton>

    <AlertDialogButton
      buttonColor="epic"
      buttonType="action"
      disabled={isDeleting}
      onclick={uninstallApp}
    >
      {#if isDeleting}
        <LoaderCircleIcon class="size-5 animate-spin mr-2"/>
      {/if}
      {$t('common.confirm')}
    </AlertDialogButton>
  </div>
</Dialog>