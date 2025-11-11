<script lang="ts">
  import { Dialog } from '$components/ui/Dialog';
  import { t } from '$lib/utils/util';
  import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

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

<Dialog.Root
  description={$t('downloads.cancelDownloadConfirmation.description')}
  title={$t('downloads.cancelDownloadConfirmation.title')}
  bind:open
>
  <div class="flex w-full items-center justify-center gap-2">
    <Dialog.Button buttonType="cancel">
      {$t('cancel')}
    </Dialog.Button>

    <Dialog.Button
      class="flex items-center gap-2"
      buttonType="action"
      color="epic"
      disabled={isCancelling}
      onclick={() => {
        onConfirm();
        open = false;
      }}
    >
      {#if isCancelling}
        <LoaderCircleIcon class="size-5 animate-spin"/>
      {/if}

      {$t('confirm')}
    </Dialog.Button>
  </div>
</Dialog.Root>