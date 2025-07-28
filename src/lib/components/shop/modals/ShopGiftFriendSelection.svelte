<script lang="ts">
  import Combobox from '$components/ui/Combobox/Combobox.svelte';
  import { Dialog } from '$components/ui/Dialog';
  import LoaderCircleIcon from 'lucide-svelte/icons/loader-circle';
  import UserIcon from 'lucide-svelte/icons/user';
  import GiftIcon from 'lucide-svelte/icons/gift';
  import { accountDataStore, accountsStore, language } from '$lib/stores';
  import { nonNull, t } from '$lib/utils/util';
  import { toast } from 'svelte-sonner';
  import type { SpitfireShopItem } from '$types/game/shop';
  import MCPManager from '$lib/core/managers/mcp';
  import type { AccountStoreData } from '$types/accounts';
  import EpicAPIError from '$lib/exceptions/EpicAPIError';

  type Props = {
    item: SpitfireShopItem;
    isSendingGifts: boolean;
    open: boolean;
  };

  let { item, isSendingGifts, open = $bindable(false) }: Props = $props();

  const activeAccount = $derived(nonNull($accountsStore.activeAccount));

  const {
    vbucks: ownedVbucks = 0,
    friends = [],
    remainingGifts = 5
  } = $derived<AccountStoreData>($accountDataStore[activeAccount.accountId] || {});

  let selectedFriends = $state<string[]>([]);

  async function sendGifts() {
    isSendingGifts = true;

    try {
      const giftData = await MCPManager.giftCatalogEntry(
        activeAccount,
        item.offerId,
        selectedFriends,
        item.price.final
      );

      accountDataStore.update((accounts) => {
        const account = accounts[activeAccount.accountId];
        account.remainingGifts =
          (account.remainingGifts || 0) - selectedFriends.length;
        account.vbucks = (account.vbucks || 0) - giftData.vbucksSpent;
        return accounts;
      });

      toast.success($t('itemShop.sentGift'));
    } catch (error) {
      if (error instanceof EpicAPIError) {
        switch (error.errorCode) {
          case 'errors.com.epicgames.modules.gamesubcatalog.gift_limit_reached': {
            toast.error($t('itemShop.reachedDailyGiftLimit'));
            accountDataStore.update((accounts) => {
              const account = accounts[activeAccount.accountId];
              account.remainingGifts = 0;
              return accounts;
            });

            return;
          }
          case 'errors.com.epicgames.modules.gameplayutils.not_enough_mtx': {
            const [, errorItemPrice, errorOwnedVbucks] = error.messageVars;

            toast.error($t('itemShop.needMoreVbucksToGift', { amount: Number.parseInt(errorItemPrice) - Number.parseInt(errorOwnedVbucks) }));
            accountDataStore.update((accounts) => {
              const account = accounts[activeAccount.accountId];
              account.vbucks = Number.parseInt(errorItemPrice);
              return accounts;
            });

            return;
          }
          case 'errors.com.epicgames.modules.gamesubcatalog.purchase_not_allowed': {
            toast.error($t('itemShop.friendsMayOwnItem'));
            return;
          }
          case 'errors.com.epicgames.modules.gamesubcatalog.gift_recipient_not_eligible': {
            toast.error($t('itemShop.friendsNotEligible'));
            return;
          }
          case 'errors.com.epicgames.modules.gamesubcatalog.receiver_owns_item_from_bundle': {
            toast.error($t('itemShop.friendsOwnItemFromBundle'));
            return;
          }
          default: {
            if (error.message.toLowerCase().includes('mfa')) {
              toast.error($t('itemShop.enableMFA'));
              return;
            }

            if (
              error.messageVars?.[0] ===
              'errors.com.epicgames.modules.gamesubcatalog.receiver_will_not_accept_gifts'
            ) {
              toast.error($t('itemShop.friendsDoNotAcceptGifts'));
              return;
            }
          }
        }
      }

      toast.error($t('itemShop.failedToGift'));
    } finally {
      isSendingGifts = false;
      open = false;
    }
  }
</script>

<Dialog.Root title={$t('itemShop.giftConfirmation.title')} bind:open>
  {#snippet description()}
    <p class="flex flex-wrap items-center gap-1 break-words whitespace-normal">
      {@html $t('itemShop.giftConfirmation.description', {
        name: `<span class="font-semibold">${item.name}</span>`,
        price: `<span class="font-semibold">${(item.price.final * (selectedFriends.length || 1)).toLocaleString($language)}</span>`,
        vbucksIcon: '<img class="size-5 inline-block" alt="V-Bucks" src="/assets/resources/currency_mtxswap.png"/>'
      })}
    </p>
  {/snippet}

  <Combobox
    contentProps={{
      side: 'bottom',
      avoidCollisions: false
    }}
    disabled={!friends?.length}
    icon={UserIcon}
    isGiftFriendSelection={true}
    items={friends.map((friend) => ({
      label: friend.displayName,
      value: friend.accountId
    }))}
    maxSelections={remainingGifts}
    placeholder={
      !selectedFriends.length
        ? $t('itemShop.selectFriends')
        : selectedFriends.length > 1
        ? $t('itemShop.selectedFriendCount', { count: selectedFriends.length })
        :friends.find((f) => f.accountId === selectedFriends[0])?.displayName
    }
    type="multiple"
    bind:value={selectedFriends}
  >
  </Combobox>

  <div class="flex w-full items-center justify-center gap-2 mt-4">
    <Dialog.Button buttonType="cancel" onclick={() => (open = false)}>
      {$t('common.cancel')}
    </Dialog.Button>

    <Dialog.Button
      class="gap-x-2"
      buttonType="action"
      color="epic"
      disabled={!selectedFriends.length ||
        isSendingGifts ||
        ownedVbucks < item.price.final * (selectedFriends.length || 1)}
      onclick={sendGifts}
    >
      {#if isSendingGifts}
        <LoaderCircleIcon class="size-5 animate-spin"/>
        {$t('itemShop.sendingGift')}
      {:else}
        <GiftIcon class="size-5"/>
        {$t('itemShop.sendGift')}
      {/if}
    </Dialog.Button>
  </div>
</Dialog.Root>
