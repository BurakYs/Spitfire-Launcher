<script lang="ts">
  import { AlertDialog } from 'bits-ui';
  import { tv, type VariantProps } from 'tailwind-variants';
  import { cn } from '$lib/utils/util';
  import type { Snippet } from 'svelte';

  const dialogButtonVariants = tv({
    base: 'rounded-md inline-flex w-full items-center justify-center font-medium p-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
    variants: {
      color: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'bg-muted text-primary hover:bg-muted/80',
        epic: 'bg-epic text-epic-secondary hover:bg-epic/80'
      }
    },
    defaultVariants: {
      color: 'primary'
    }
  });

  type Props = AlertDialog.CancelProps & VariantProps<typeof dialogButtonVariants> & {
    children: Snippet;
    buttonType: 'action' | 'cancel';
  };

  const {
    children,
    buttonType,
    color,
    ...restProps
  }: Props = $props();

  const DialogButton = buttonType === 'action' ? AlertDialog.Action : AlertDialog.Cancel;
</script>

<DialogButton
  {...restProps}
  class={cn(
    dialogButtonVariants({ color: color || (buttonType === 'action' ? 'primary' : 'secondary') }),
    'focus-visible:ring-foreground focus-visible:ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2',
    restProps.class
  )}
>
  {@render children()}
</DialogButton>
