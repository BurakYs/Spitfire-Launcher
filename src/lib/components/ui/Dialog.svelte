<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Dialog, type WithoutChild } from 'bits-ui';
  import XIcon from 'lucide-svelte/icons/x';
  import { cn } from '$lib/utils/util';
  import type { ClassValue } from 'svelte/elements';

  type Props = Dialog.RootProps & {
    trigger?: Snippet;
    triggerClass?: ClassValue;
    title?: string | Snippet;
    description?: string | Snippet;
    contentProps?: WithoutChild<Dialog.ContentProps>;
  };

  let {
    open = $bindable(false),
    children,
    trigger,
    triggerClass,
    contentProps,
    title,
    description,
    ...restProps
  }: Props = $props();
</script>

<Dialog.Root {...restProps} bind:open>
  {#if trigger}
    <Dialog.Trigger
      class={cn(
        'inline-flex items-center justify-center peer transition-colors',
        'focus-visible:ring-foreground focus-visible:ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]',
        triggerClass
      )}
    >
      {@render trigger()}
    </Dialog.Trigger>
  {/if}
  <Dialog.Portal>
    <Dialog.Overlay
      class={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'fixed inset-0 z-50 bg-black/80'
      )}
    />
    <Dialog.Content
      {...contentProps}
      class={cn(
        'rounded-xl bg-background shadow-popover overflow-y-auto max-h-[calc(100dvh-2rem)]',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'outline-hidden fixed left-[50%] top-[50%] z-50 w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] border p-6 sm:max-w-lg',
        contentProps?.class
      )}
    >
      {#if title || description}
        <div class="flex flex-col gap-2 mb-6">
          {#if title}
            <Dialog.Title class="text-lg font-semibold tracking-tight">
              {#if typeof title === 'string'}
                {title}
              {:else}
                {@render title()}
              {/if}
            </Dialog.Title>
          {/if}

          {#if description}
            <Dialog.Description class="text-muted-foreground text-sm">
              {#if typeof description === 'string'}
                {description}
              {:else}
                {@render description()}
              {/if}
            </Dialog.Description>
          {/if}
        </div>
      {/if}

      {@render children?.()}

      <Dialog.Close
        class={cn(
          'absolute right-3 top-3 rounded-md active:scale-[0.98]',
          'focus-visible:ring-foreground focus-visible:ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2'
        )}
      >
        <XIcon class="text-foreground size-5"/>
      </Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>