<script lang="ts">
  import XIcon from '@lucide/svelte/icons/x';
  import Input from '$components/ui/Input.svelte';
  import { open } from '@tauri-apps/plugin-dialog';
  import type { HTMLInputAttributes } from 'svelte/elements';

  // todo: change HTMLInputAttributes to InputProps in components/ui/Input.svelte later
  // and remove the hardcoded "variant"

  type Props = Omit<HTMLInputAttributes, 'onchange'> & {
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
    variant="outline"
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