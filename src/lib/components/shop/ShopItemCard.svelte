<script lang="ts">
  import { calculateDiscountedShopPrice, t } from '$lib/utils/util';
  import type { SpitfireShopItem } from '$types/game/shop';
  import { ItemColors } from '$lib/constants/itemColors';
  import { activeAccountId, language, ownedItemsStore } from '$lib/stores';
  import ShopItemModal from '$components/shop/modals/ShopItemModal.svelte';
  import CheckIcon from 'lucide-svelte/icons/check';
  import { derived as jsDerived } from 'svelte/store';

  type ItemCardProps = {
    item: SpitfireShopItem;
  };

  const { item }: ItemCardProps = $props();

  let showItemModal = $state(false);

  const isItemOwned = $derived($activeAccountId && $ownedItemsStore[$activeAccountId!]?.has(item.id?.toLowerCase()));
  const displayName = item.name;
  const imageUrl = item.assets.featured || item.assets.icon || item.assets.smallIcon;
  const discountedPrice = jsDerived([activeAccountId, ownedItemsStore], ([accountId]) => calculateDiscountedShopPrice(accountId!, item));

  const colors: Record<string, string> = { ...ItemColors.rarities, ...ItemColors.series };

  const seriesId = item.series?.id?.toLowerCase() || '';
  const rarityId = item.rarity?.id?.toLowerCase();

  const backgroundColorHex = colors[seriesId] || colors[rarityId] || colors.common;

  function handleItemModal() {
    if (!$activeAccountId) return;
    showItemModal = true;
  }
</script>

<div
  style="background-color: {backgroundColorHex}"
  class="relative pb-[100%] rounded-xl overflow-hidden transition-all duration-300 w-full hover:scale-105 {$activeAccountId ? 'cursor-pointer' : ''}"
  onclick={handleItemModal}
  onkeydown={(e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleItemModal();
    }
  }}
  role="button"
  tabindex="0"
>
  {#if imageUrl}
    <img
      class="absolute pointer-events-none select-none"
      alt={displayName}
      draggable="false"
      loading="lazy"
      src={imageUrl}
    />
  {/if}

  <div class="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/80 to-transparent">
    <div class="item-info">
      <h3
        style="text-shadow: 0 2px 4px #000000"
        class="text-white text-lg font-bold mb-2 leading-none text-left"
      >
        {displayName}
      </h3>

      <div class="relative flex items-center justify-start pl-6">
        {#if isItemOwned}
          <CheckIcon class="absolute left-0 top-1/2 -translate-y-1/2 size-5 object-contain text-green-500"/>
        {:else}
          <img
            class="absolute left-0 top-1/2 -translate-y-1/2 size-5 object-contain"
            alt={$t('common.vbucks')}
            draggable="false"
            src="/assets/resources/currency_mtxswap.png"
          />
        {/if}

        <span
          style="text-shadow: 0 2px 4px #000000"
          class="text-sm font-bold pb-0.5 {isItemOwned ? 'text-green-500' : 'text-white'}"
        >
          {#if isItemOwned}
            {$t('itemShop.owned')}
          {:else if $discountedPrice !== item.price.final}
            {$discountedPrice.toLocaleString($language)}
            <span class="line-through text-white/95">{item.price.final.toLocaleString($language)}</span>
          {:else}
            {item.price.final.toLocaleString($language)}
          {/if}
        </span>
      </div>
    </div>
  </div>
</div>

<ShopItemModal {item} bind:open={showItemModal}/>
