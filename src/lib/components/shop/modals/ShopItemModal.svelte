<script lang="ts">
  import { Separator } from 'bits-ui';
  import { Dialog } from '$components/ui/Dialog';
  import Tooltip from '$components/ui/Tooltip.svelte';
  import { accountsStorage, language } from '$lib/core/data-storage';
  import { calculateDiscountedShopPrice, t } from '$lib/utils/util';
  import Badge from '$components/ui/Badge.svelte';
  import Button from '$components/ui/Button.svelte';
  import GiftIcon from 'lucide-svelte/icons/gift';
  import ShoppingCartIcon from 'lucide-svelte/icons/shopping-cart';
  import CheckIcon from 'lucide-svelte/icons/check';
  import { ItemColors } from '$lib/constants/item-colors';
  import { accountDataStore, brShopStore, ownedItemsStore } from '$lib/stores';
  import ShopPurchaseConfirmation from '$components/shop/modals/ShopPurchaseConfirmation.svelte';
  import ShopGiftFriendSelection from '$components/shop/modals/ShopGiftFriendSelection.svelte';
  import type { AccountStoreData } from '$types/accounts';
  import { derived as jsDerived } from 'svelte/store';

  type Props = {
    offerId: string;
  };

  let { offerId = $bindable() }: Props = $props();

  const item = $brShopStore.offers.find(x => x.offerId === offerId)!;
  let isOpen = $state(true);

  const {
    vbucks: ownedVbucks = 0,
    friends = [],
    remainingGifts = 5
  } = $derived<AccountStoreData>($accountDataStore[$accountsStorage.activeAccountId!] || {});

  const ownedItems = $derived($ownedItemsStore[$accountsStorage.activeAccountId!]);
  const isItemOwned = $derived(ownedItems?.has(item.id?.toLowerCase()));
  const discountedPrice = jsDerived([accountsStorage, ownedItemsStore], ([accountSettings]) => calculateDiscountedShopPrice(accountSettings.activeAccountId!, item));

  let isPurchasing = $state(false);
  let isPurchaseDialogOpen = $state(false);
  let isGiftDialogOpen = $state(false);
  let isSendingGifts = $state(false);

  function getItemColor() {
    const colors: Record<string, string> = { ...ItemColors.rarities, ...ItemColors.series };
    const rarityId = (item.series?.id || item.rarity?.id)?.toLowerCase();
    const hexColor = colors[rarityId] || colors.common;

    return `rgba(${hexToRgb(hexColor).join(', ')}, 0.7)`;
  }

  function hexToRgb(hex: string): [number, number, number] {
    hex = hex.replace(/^#/, '');

    let bigint = Number.parseInt(hex, 16);
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;

    return [r, g, b];
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString($language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
</script>

<Dialog.Root
  contentProps={{ class: '!max-w-160 !min-h-112 overflow-y-auto !min-h-0' }}
  onOpenChangeComplete={(open) => !open && (offerId = '')}
  bind:open={isOpen}
>
  <div class="flex flex-col gap-y-6 w-full">
    <div class="flex flex-col xs:flex-row gap-x-6">
      <img
        class="size-48 xs:size-64 object-cover place-self-center xs:place-self-start rounded-md"
        alt={item.name}
        src={item.assets.featured || item.assets.large || item.assets.small}
      />

      <div class="flex flex-col justify-between gap-y-4 mt-3 xs:mt-0">
        <div class="space-y-4">
          <div>
            <h2 class="font-bold text-2xl">{item.name}</h2>
            {#if item.description}
              <p class="text-muted-foreground italic mt-1">
                {item.description}
              </p>
            {/if}
          </div>

          <div class="flex flex-wrap gap-2">
            <Badge
              style="background: {getItemColor()}"
              class="text-primary font-medium px-3 py-1 rounded-lg capitalize"
            >
              {(item.series?.name || item.rarity?.name)?.toLowerCase()}
            </Badge>

            <Badge
              class="text-primary font-medium px-3 py-1 rounded-lg border"
              variant="outline"
            >
              {item.type?.name}
            </Badge>
          </div>
        </div>

        <div class="flex flex-col">
          <div class="flex items-center gap-1">
            <span class="text-muted-foreground">{$t('itemShop.itemInformation.price')}:</span>

            {#if $discountedPrice !== item.price.final}
              <span class="mr-1">{$discountedPrice.toLocaleString($language)}</span>
              <span class="line-through text-muted-foreground/95">{item.price.final.toLocaleString($language)}</span>
            {:else}
              <span>{item.price.final.toLocaleString($language)}</span>
            {/if}

            <img
              class="size-5"
              alt="V-Bucks"
              src="/assets/resources/currency_mtxswap.png"
            />
          </div>

          <div class="flex items-center gap-1">
            <span class="text-muted-foreground">{$t('itemShop.itemInformation.firstSeen')}:</span>
            <span>{formatDate(item.dates.releaseDate)}</span>
          </div>

          <div class="flex items-center gap-1">
            <span class="text-muted-foreground">{$t('itemShop.itemInformation.lastSeen')}:</span>
            <span>{formatDate(item.dates.lastSeen)}</span>
          </div>

          <div class="flex items-center gap-1">
            <span class="text-muted-foreground">{$t('itemShop.itemInformation.leavesOn')}:</span>
            <span>{formatDate(item.dates.out)}</span>
          </div>
        </div>
      </div>
    </div>

    {#if $accountsStorage.activeAccountId}
      <Separator.Root class="bg-border h-px"/>

      <div class="flex w-full gap-3">
        <Tooltip
          class="w-full"
          ignoreNonKeyboardFocus={true}
          message={ownedVbucks < $discountedPrice ? $t('itemShop.notEnoughVbucks') : undefined}
        >
          <Button
            class="flex justify-center items-center gap-x-2 w-full"
            disabled={isPurchasing || ownedVbucks < $discountedPrice || isItemOwned}
            onclick={() => (isPurchaseDialogOpen = true)}
            variant="epic"
          >
            {#if isItemOwned}
              <CheckIcon class="size-5"/>
              {$t('itemShop.owned')}
            {:else}
              <ShoppingCartIcon class="size-5"/>
              {$t('itemShop.purchase')}
            {/if}
          </Button>
        </Tooltip>

        <Tooltip
          class="w-full"
          message={remainingGifts < 1 ? $t('itemShop.noRemainingGifts') : ownedVbucks < item.price.final ? $t('itemShop.notEnoughVbucks') : !friends.length ? $t('itemShop.noFriends') : ''}
        >
          <Button
            class="flex justify-center items-center gap-x-2 w-full"
            disabled={isSendingGifts || remainingGifts < 1 || ownedVbucks < item.price.final || !item.giftable || !friends.length}
            onclick={() => (isGiftDialogOpen = true)}
            variant="outline"
          >
            <GiftIcon class="size-5"/>
            {$t('itemShop.gift')}
          </Button>
        </Tooltip>
      </div>
    {/if}
  </div>
</Dialog.Root>

{#if $accountsStorage.activeAccountId}
  <ShopPurchaseConfirmation {isPurchasing} {item} bind:open={isPurchaseDialogOpen}/>

  <ShopGiftFriendSelection {isSendingGifts} {item} bind:open={isGiftDialogOpen}/>
{/if}