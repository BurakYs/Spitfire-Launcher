<script lang="ts">
  import { cn } from '$lib/utils/util';
  import { Avatar, type WithoutChildrenOrChild } from 'bits-ui';
  import type { ClassValue } from 'svelte/elements';

  let {
    src,
    alt,
    fallback,
    imageClass,
    ref = $bindable(null),
    imageRef = $bindable(null),
    fallbackRef = $bindable(null),
    ...restProps
  }: WithoutChildrenOrChild<Avatar.RootProps> & {
    src: string;
    alt: string;
    fallback: string;
    imageClass?: ClassValue;
    imageRef?: HTMLImageElement | null;
    fallbackRef?: HTMLElement | null;
  } = $props();
</script>

<Avatar.Root {...restProps} bind:ref>
  <Avatar.Image class={cn('rounded-full', imageClass)} {alt} {src} bind:ref={imageRef}/>
  <Avatar.Fallback bind:ref={fallbackRef}>
    <img
      class={cn('rounded-full', imageClass)}
      alt={alt}
      src={fallback}
    />
  </Avatar.Fallback>
</Avatar.Root>