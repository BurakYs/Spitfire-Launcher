<script lang="ts">
  import AlertDialogButton from '$components/ui/AlertDialog/AlertDialogButton.svelte';
  import Dialog from '$components/ui/Dialog.svelte';
  import { t } from '$lib/utils/util';
  import LoaderCircleIcon from 'lucide-svelte/icons/loader-circle';

  type Props = {
    open: boolean;
    onConfirm: () => void;
  };

  let {
    open = $bindable(),
    onConfirm
  }: Props = $props();

  let isCancelling = $state(false);
</script>

<Dialog
  description={$t('downloads.cancelDownloadConfirmation.description')}
  title={$t('downloads.cancelDownloadConfirmation.title')}
  bind:open
>
  <div class="flex w-full items-center justify-center gap-2">
    <AlertDialogButton buttonType="cancel">
      {$t('common.cancel')}
    </AlertDialogButton>

    <AlertDialogButton
      buttonColor="epic"
      buttonType="action"
      disabled={isCancelling}
      onclick={() => {
        onConfirm();
        open = false;
      }}
    >
      {#if isCancelling}
        <LoaderCircleIcon class="size-5 animate-spin mr-2"/>
      {/if}
      {$t('common.confirm')}
    </AlertDialogButton>
  </div>
</Dialog>