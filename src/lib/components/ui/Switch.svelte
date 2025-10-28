<script lang="ts">
  import { Switch, type WithoutChildrenOrChild } from 'bits-ui';
  import { cn } from '$lib/utils/util';

  type Props = WithoutChildrenOrChild<Switch.RootProps>;

  let {
    checked = $bindable(false),
    ...restProps
  }: Props = $props();
</script>

<Switch.Root
  bind:checked
  {...restProps}
  class={cn(
    'peer inline-flex items-center h-6 min-h-6 w-12 shrink-0 cursor-pointer rounded-full px-1 transition-colors',
    'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
    'transition-colors focus-visible:ring-foreground focus-visible:ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50'
  )}
>
  <Switch.Thumb
    class={cn(
      'pointer-events-none block size-5 shrink-0 rounded-full transition-transform',
      'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 border data-[state=unchecked]:border',
      'data-[state=checked]:bg-background data-[state=unchecked]:bg-primary'
    )}
  />
</Switch.Root>