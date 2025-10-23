<script lang="ts" module>
  import { tv, type VariantProps } from 'tailwind-variants';
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  export const badgeVariants = tv({
    base: 'px-3 py-1 rounded-full',
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'bg-transparent text-input-foreground border-input',
        ghost: 'bg-transparent text-input-foreground border-none'
      }
    },
    defaultVariants: {
      variant: 'primary'
    }
  });

  export type BadgeVariant = VariantProps<typeof badgeVariants>;

  export type BadgeProps = {
    class?: string;
    children: Snippet;
  } & HTMLAttributes<any> & BadgeVariant;
</script>

<script lang="ts">
  import { cn } from '$lib/utils/util';

  let {
    class: className,
    variant,
    children,
    ...restProps
  }: BadgeProps = $props();
</script>

<span
  {...restProps}
  class={cn(badgeVariants({ variant }), className)}
>
  {@render children()}
</span>