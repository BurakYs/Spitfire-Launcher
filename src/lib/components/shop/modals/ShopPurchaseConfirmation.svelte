<script lang="ts">
  import { Dialog } from '$components/ui/Dialog';
  import { activeAccountStore, language } from '$lib/core/data-storage';
  import LoaderCircleIcon from 'lucide-svelte/icons/loader-circle';
  import type { SpitfireShopItem } from '$types/game/shop';
  import { toast } from 'svelte-sonner';
  import { accountDataStore, ownedItemsStore } from '$lib/stores';
  import MCPManager from '$lib/core/managers/mcp';
  import { calculateDiscountedShopPrice, nonNull, t } from '$lib/utils/util';
  import EpicAPIError from '$lib/exceptions/EpicAPIError';
  import { derived as jsDerived } from 'svelte/store';

  type Props = {
    item: SpitfireShopItem;
    isPurchasing: boolean;
    open: boolean;
  };

  let { item, isPurchasing, open = $bindable(false) }: Props = $props();

  const activeAccount = $derived(nonNull($activeAccountStore));
  const discountedPrice = jsDerived([activeAccountStore, ownedItemsStore], ([account]) => calculateDiscountedShopPrice(account!.accountId, item));

  async function purchaseItem() {
    isPurchasing = true;

    try {
      const purchaseData = await MCPManager.purchaseCatalogEntry(activeAccount, item.offerId, $discountedPrice);

      accountDataStore.update((accounts) => {
        const account = accounts[activeAccount.accountId];
        account.vbucks = (account.vbucks || 0) - purchaseData.vbucksSpent;
        return accounts;
      });

      ownedItemsStore.update((accounts) => {
        // eslint-disable-next-line svelte/prefer-svelte-reactivity -- This is not a reactive store
        const items = accounts[activeAccount.accountId] || new Set<string>();
        items.add(item.offerId);

        accounts[activeAccount.accountId] = items;
        return accounts;
      });

      toast.success($t('itemShop.purchased'));
    } catch (error) {
      if (error instanceof EpicAPIError) {
        switch (error.errorCode) {
          case 'errors.com.epicgames.modules.gameplayutils.not_enough_mtx': {
            const [, errorItemPrice, errorOwnedVbucks] = error.messageVars;

            toast.error($t('itemShop.needMoreVbucksToPurchase', { amount: Number.parseInt(errorItemPrice) - Number.parseInt(errorOwnedVbucks) }));
            accountDataStore.update((accounts) => {
              const account = accounts[activeAccount.accountId];
              account.vbucks = Number.parseInt(errorItemPrice);
              return accounts;
            });

            return;
          }
          case 'errors.com.epicgames.modules.gamesubcatalog.purchase_not_allowed': {
            toast.error($t('itemShop.alreadyOwned'));
            ownedItemsStore.update((accounts) => {
              // eslint-disable-next-line svelte/prefer-svelte-reactivity -- This is not a reactive store
              const items = accounts[activeAccount.accountId] || new Set<string>();
              items.add(item.offerId);

              accounts[activeAccount.accountId] = items;
              return accounts;
            });

            return;
          }
        }
      }

      toast.error($t('itemShop.failedToPurchase'));
    } finally {
      isPurchasing = false;
      open = false;
    }
  }
</script>

<Dialog.Root title={$t('itemShop.purchaseConfirmation.title')} bind:open>
  {#snippet description()}
    <p class="flex flex-wrap items-center gap-1 break-words whitespace-normal">
      {@html $t('itemShop.purchaseConfirmation.description', {
        name: `<span class="font-semibold">${item.name}</span>`,
        price: `<span class="font-semibold">${$discountedPrice.toLocaleString($language)}</span>`,
        vbucksIcon: '<img class="size-5 inline-block" alt="V-Bucks" src="/assets/resources/currency_mtxswap.png"/>'
      })}
    </p>
  {/snippet}

  <div class="flex w-full items-center justify-center gap-2">
    <Dialog.Button buttonType="cancel">
      {$t('common.cancel')}
    </Dialog.Button>

    <Dialog.Button
      buttonType="action"
      color="epic"
      disabled={isPurchasing}
      onclick={purchaseItem}
    >
      {#if isPurchasing}
        <LoaderCircleIcon class="size-5 animate-spin mr-2"/>
        {$t('itemShop.purchasing')}
      {:else}
        {$t('common.confirm')}
      {/if}
    </Dialog.Button>
  </div>
</Dialog.Root>
