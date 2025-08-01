<script lang="ts">
  import ExternalLink from '$components/ui/ExternalLink.svelte';
  import LoaderCircleIcon from 'lucide-svelte/icons/loader-circle';
  import { tv, type VariantProps } from 'tailwind-variants';
  import { cn } from '$lib/utils/util';
  import type { Snippet } from 'svelte';
  import type { ClassValue, HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

  const buttonVariants = tv({
    base: 'rounded-md transition-all duration-200 peer disabled:opacity-50 disabled:cursor-not-allowed',
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        accent: 'bg-accent text-accent-foreground hover:bg-accent/80',
        outline: 'border border-input bg-transparent hover:bg-input/40',
        ghost: 'bg-transparent hover:bg-input/40',
        danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/80',
        epic: 'bg-epic text-epic-secondary hover:bg-epic/80'
      },
      size: {
        sm: 'px-2 py-1 text-sm font-normal',
        md: 'px-4 py-2 text-base font-medium',
        lg: 'px-6 py-3 text-lg font-bold'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md'
    }
  });

  type ElementProps = HTMLButtonAttributes & HTMLAnchorAttributes & VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    loadingText?: string;
    href?: string;
    children: Snippet;
  };

  const {
    class: className,
    variant,
    size,
    href,
    loading,
    loadingText,
    children,
    ...restProps
  }: ElementProps = $props();

  const loadingClasses = $derived<ClassValue | null>(loading ? 'flex justify-center items-center gap-x-2' : null);
  const allClasses = $derived(cn(buttonVariants({ variant, size }), loadingClasses, className));
</script>

{#snippet Content()}
  {#if loading}
    <LoaderCircleIcon class="size-5 animate-spin"/>
  {/if}

  {#if loading && loadingText}
    {loadingText}
  {:else}
    {@render children()}
  {/if}
{/snippet}

{#if href}
  <ExternalLink
    class={allClasses}
    {href}
    {...restProps}
  >
    {@render Content()}
  </ExternalLink>
{:else}
  <button
    class={allClasses}
    {...restProps}
  >
    {@render Content()}
  </button>
{/if}