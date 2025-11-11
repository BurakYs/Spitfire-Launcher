<script lang="ts">
  import { activeAccountStore, language } from '$lib/core/data-storage';
  import { calculateDiscountedShopPrice, t } from '$lib/utils/util';
  import type { SpitfireShopItem } from '$types/game/shop';
  import { ItemColors } from '$lib/constants/item-colors';
  import { ownedItemsStore } from '$lib/stores';
  import CheckIcon from '@lucide/svelte/icons/check';
  import { derived as jsDerived } from 'svelte/store';

  type ItemCardProps = {
    item: SpitfireShopItem;
    modalOfferId: string;
  };

  let { item, modalOfferId = $bindable() }: ItemCardProps = $props();

  const isItemOwned = $derived($activeAccountStore && $ownedItemsStore[$activeAccountStore.accountId!]?.has(item.id?.toLowerCase()));
  const discountedPrice = jsDerived(
    [activeAccountStore, ownedItemsStore],
    ([activeAccount]) => !activeAccount ? item.price.final : calculateDiscountedShopPrice(activeAccount!.accountId, item)
  );

  const colors: Record<string, string> = { ...ItemColors.rarities, ...ItemColors.series };
  const seriesId = item.series?.id?.toLowerCase() || '';
  const rarityId = item.rarity?.id?.toLowerCase();
  const imageUrl = item.assets.featured || item.assets.large || item.assets.small;
  const backgroundColorHex = colors[seriesId] || colors[rarityId] || colors.common;

  function showItemModal() {
    modalOfferId = item.offerId;
  }
</script>

<div
  style="background-color: {backgroundColorHex}"
  class="relative pb-[100%] rounded-xl overflow-hidden transition-all duration-300 w-full hover:scale-105 focus:scale-105 cursor-pointer"
  onclick={showItemModal}
  onkeydown={(event) => event.key === 'Enter' && showItemModal()}
  role="button"
  tabindex="0"
>
  {#if imageUrl}
    <img
      class="absolute inset-0 size-full select-none object-cover"
      alt={item.name}
      draggable="false"
      loading="lazy"
      src={imageUrl}
    />
  {/if}

  <div class="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/80 to-transparent">
    <h3
      style="text-shadow: 0 2px 4px #000000"
      class="text-white text-lg font-bold mb-2 leading-none text-left"
    >
      {item.name}
    </h3>

    <div class="relative flex items-center justify-start pl-6">
      {#if isItemOwned}
        <CheckIcon class="absolute left-0 top-1/2 -translate-y-1/2 size-5 text-green-500"/>
      {:else}
        <img
          class="absolute left-0 top-1/2 -translate-y-1/2 size-5"
          alt={$t('vbucks')}
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
