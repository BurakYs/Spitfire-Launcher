<script lang="ts">
  import { Tooltip } from 'bits-ui';
  import { type Snippet } from 'svelte';
  import { cn } from '$lib/utils/util';
  import type { ClassValue } from 'svelte/elements';

  type Props = Tooltip.RootProps & {
    children: Snippet;
    message?: Snippet | string;
    class?: ClassValue;
  };

  let {
    open = $bindable(false),
    children,
    message,
    class: className,
    ...restProps
  }: Props = $props();
</script>

{#if message}
  <Tooltip.Root delayDuration={200} bind:open {...restProps}>
    <Tooltip.Trigger class={className}>
      {@render children()}
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content
        class={cn(
          'border border-input bg-background hover:bg-muted z-50',
          'focus-visible:ring-foreground focus-visible:ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2',
          'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm'
        )}
        sideOffset={4}
      >
        {#if typeof message === 'string'}
          {message}
        {:else}
          {@render message()}
        {/if}
        <Tooltip.Arrow class="text-border"/>
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
{:else}
  {@render children()}
{/if}