<script lang="ts">
  import type { SpitfireShopSection } from '$lib/types/game/shop';
  import ShopItemCard from '$components/shop/ShopItemCard.svelte';

  type ShopSectionProps = {
    section: SpitfireShopSection;
    modalOfferId: string;
  };

  let { section, modalOfferId = $bindable() }: ShopSectionProps = $props();
</script>

<div class="flex flex-col items-center mb-9">
  <h2 class="w-full text-2xl font-extrabold uppercase tracking-wider mb-4">
    {section.name}
  </h2>

  <div class="w-full @container">
    <div class="grid gap-4 @max-[28rem]:grid-cols-2 @max-[36rem]:grid-cols-3 @max-[48rem]:grid-cols-4 @max-[60rem]:grid-cols-5 @max-[75rem]:grid-cols-6 @max-[90rem]:grid-cols-7">
      {#each section.items as item (item.offerId)}
        <ShopItemCard {item} bind:modalOfferId/>
      {/each}
    </div>
  </div>
</div>