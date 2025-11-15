<script lang="ts">
  import XIcon from '@lucide/svelte/icons/x';

  type Props = {
    items?: string[];
    placeholder?: string;
  };

  let {
    items = $bindable<string[]>([]),
    placeholder = 'Enter items and press Enter'
  }: Props = $props();

  let currentInput = $state<string>();

  function addItem(input: string) {
    if (items.includes(input)) return;

    items = [...items, input];
    currentInput = '';
  }

  function removeItem(index: number, event?: MouseEvent) {
    event?.stopPropagation();
    items = items.filter((_, i) => i !== index);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();

      const input = currentInput?.trim();
      if (input) addItem(input);
    }

    if (e.key === 'Backspace' && !currentInput && items.length) {
      removeItem(items.length - 1);
    }
  }
</script>

<div class="flex flex-col gap-2 w-full peer bg-surface-alt">
  <div class="relative border rounded-md p-2 flex flex-wrap gap-2 items-center cursor-text">
    {#each items as item, i (i)}
      <div class="bg-muted flex items-center gap-2 px-2 py-1 rounded-md text-sm select-none cursor-default max-w-full">
        <span class="whitespace-normal break-words overflow-hidden">{item}</span>
        <button
          class="text-muted-foreground hover:text-foreground shrink-0 ml-auto"
          onclick={(e) => removeItem(i, e)}
          type="button"
        >
          <XIcon class="size-4"/>
        </button>
      </div>
    {/each}

    <textarea
      class="grow-0 outline-none border-none resize-none overflow-hidden bg-transparent field-sizing-content" class:min-w-20={items.length} class:min-w-full={!items.length}
      onkeydown={handleKeyDown}
      placeholder={items.length ? '' : placeholder}
      rows="1"
      bind:value={currentInput}
    ></textarea>
  </div>
</div>