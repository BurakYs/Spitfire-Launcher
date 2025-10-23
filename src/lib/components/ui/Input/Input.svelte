<script lang="ts" module>
  import type { HTMLInputAttributes } from 'svelte/elements';
  import { tv, type VariantProps } from 'tailwind-variants';
  import type { WithElementRef } from 'bits-ui';

  export const inputVariants = tv({
    base: cn(
      'w-full px-4 py-2 text-sm rounded-md transition-all border border-input appearance-none h-10 peer',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'focus:ring-offset-background focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foreground'
    ),
    variants: {
      variant: {
        primary: 'bg-surface-alt',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'bg-transparent text-input-foreground',
        ghost: 'bg-transparent text-input-foreground border-none'
      }
    },
    defaultVariants: {
      variant: 'primary'
    }
  });

  export type InputVariants = VariantProps<typeof inputVariants>;
  export type InputVariant = InputVariants['variant'];
  export type InputProps = HTMLInputAttributes & InputVariants & WithElementRef<HTMLInputAttributes, HTMLInputElement>;
</script>

<script lang="ts">
  import { cn } from '$lib/utils/util';
  import { onMount } from 'svelte';

  let {
    class: className,
    variant,
    ref = $bindable(),
    value = $bindable<string>(),
    type,
    ...restProps
  }: InputProps = $props();

  function handleSearchShortcut(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === 'f') {
      event.preventDefault();
      ref?.focus();
    }
  }

  if (type === 'search') {
    onMount(() => {
      document.addEventListener('keydown', handleSearchShortcut);

      return () => {
        document.removeEventListener('keydown', handleSearchShortcut);
      };
    });
  }
</script>

<input
  bind:this={ref}
  class={cn(inputVariants({ variant }), className)}
  autocomplete="off"
  spellcheck="false"
  {type}
  bind:value
  {...restProps}
/>