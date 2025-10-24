<script lang="ts">
  import XIcon from '@lucide/svelte/icons/x';
  import Input, { type InputProps } from '$components/ui/Input/Input.svelte';
  import { open } from '@tauri-apps/plugin-dialog';

  type Props = Omit<InputProps, 'onchange'> & {
    title?: string;
    value?: string | undefined;
    defaultPath?: string;
    onchange?: (path: string | undefined) => void;
    showClearButton?: boolean;
  };

  let { title, defaultPath, value, onchange, showClearButton = true, ...restProps }: Props = $props();

  async function handleClick() {
    const folderPath = await open({
      directory: true,
      multiple: false,
      title,
      defaultPath
    });

    if (!folderPath) return;

    value = folderPath;
    onchange?.(folderPath);
  }

  function handleClear() {
    value = undefined;
    onchange?.(undefined);
  }
</script>

<div class="relative">
  <Input
    class="pr-10 hover:cursor-pointer"
    onclick={handleClick}
    onkeydown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleClick();
      }
    }}
    readonly
    bind:value
    {...restProps}
  />

  {#if value && showClearButton}
    <button
      class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      onclick={handleClear}
      type="button"
    >
      <XIcon class="size-5"/>
    </button>
  {/if}
</div>