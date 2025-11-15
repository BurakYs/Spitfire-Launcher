<script generics="T" lang="ts">
  import { Accordion, type WithoutChildrenOrChild } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import type { ClassValue } from 'svelte/elements';

  type Props = WithoutChildrenOrChild<Accordion.ItemProps> & {
    type: 'single' | 'multiple';
    items: T[];
    openItems?: number[];
    trigger: Snippet<[T]>;
    content: Snippet<[T]>;
    rootClass?: ClassValue
  };

  let { type, items, openItems, rootClass, trigger, content, ...restProps }: Props = $props();
</script>

<Accordion.Root class={rootClass} type={type as never} value={openItems?.map((i) => `item-${i}`)}>
  {#each items as item, index (index.toString())}
    <Accordion.Item
      value="item-{index}"
      {...restProps}
    >
      <Accordion.Header>
        <Accordion.Trigger class="w-full transition-all peer [&[data-state=open]_.lucide-chevron-down]:rotate-180">
          {@render trigger(item)}
        </Accordion.Trigger>
      </Accordion.Header>

      <Accordion.Content class="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
        {@render content(item)}
      </Accordion.Content>
    </Accordion.Item>
  {/each}
</Accordion.Root>