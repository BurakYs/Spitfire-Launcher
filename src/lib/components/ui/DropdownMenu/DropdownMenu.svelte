<script lang="ts">
  import type { Snippet } from 'svelte';
  import { DropdownMenu, type WithoutChild } from 'bits-ui';
  import { cn } from '$lib/utils/util';
  import type { ClassValue } from 'svelte/elements';

  type Props = DropdownMenu.RootProps & {
    trigger?: Snippet;
    triggerClass?: ClassValue;
    contentProps?: WithoutChild<DropdownMenu.ContentProps>;
  };

  let {
    open = $bindable(false),
    children,
    trigger,
    triggerClass,
    contentProps,
    ...restProps
  }: Props = $props();
</script>

<DropdownMenu.Root {...restProps} bind:open>
  {#if trigger}
    <DropdownMenu.Trigger
      class={cn(
        'inline-flex items-center justify-center transition-colors',
        'focus-visible:ring-foreground focus-visible:ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]',
        triggerClass
      )}
    >
      {@render trigger()}
    </DropdownMenu.Trigger>
  {/if}

  <DropdownMenu.Portal>
    <DropdownMenu.Content
      {...contentProps}
      class={cn(
        'border-muted bg-background shadow-popover outline-hidden rounded-lg border p-1 z-50',
        'w-[var(--bits-dropdown-menu-anchor-width)] min-w-60 max-h-[var(--bits-dropdown-menu-content-available-height)] overflow-hidden',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--bits-dropdown-menu-content-transform-origin)',
        contentProps?.class
      )}
      sideOffset={8}
    >
      {@render children?.()}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>