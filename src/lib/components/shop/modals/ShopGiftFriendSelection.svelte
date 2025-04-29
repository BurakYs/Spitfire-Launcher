<script lang="ts">
  import Dialog from '$components/ui/Dialog.svelte';
  import Select from '$components/ui/Select.svelte';
  import Button from '$components/ui/Button.svelte';
  import UserIcon from 'lucide-svelte/icons/user';
  import ChevronsUpAndDownIcon from 'lucide-svelte/icons/chevrons-up-down';
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

<Dialog
  contentProps={{ class: 'w-96 space-y-4' }}
  title={$t('itemShop.giftConfirmation.title')}
  bind:open
>
  {#snippet description()}
    {@html $t('itemShop.giftConfirmation.description', {
      name: `<span class="font-semibold shrink-0">${item.name}</span>`,
      price: `<span class="font-semibold shrink-0">${(item.price.final * (selectedFriends.length || 1)).toLocaleString($language)}</span>`,
      vbucksIcon: '<img class="inline-block size-5 align-middle shrink-0" alt="V-Bucks" src="/assets/resources/currency_mtxswap.png"/>'
    })}
  {/snippet}

  <Select
    disabled={!friends?.length}
    items={friends.map((friend) => ({
      label: friend.displayName,
      value: friend.accountId
    }))}
    maxSelections={remainingGifts}
    triggerClass="w-full"
    type="multiple"
    bind:value={selectedFriends}
  >
    {#snippet trigger(label)}
      <UserIcon class="text-muted-foreground size-5 mr-2"/>
      <span class="text-muted-foreground">
        {!selectedFriends.length ? $t('itemShop.selectFriends') : selectedFriends.length > 1 ? $t('itemShop.selectedFriendCount', { count: selectedFriends.length }) : label}
      </span>
      <ChevronsUpAndDownIcon class="text-muted-foreground size-5 ml-auto"/>
    {/snippet}
  </Select>

  <div class="flex justify-end gap-1">
    <Button onclick={() => (open = false)} variant="outline">
      {$t('common.cancel')}
    </Button>

    <Button
      class="flex justify-center items-center gap-x-2"
      disabled={!selectedFriends.length ||
        isSendingGifts ||
        ownedVbucks < item.price.final * (selectedFriends.length || 1)}
      loading={isSendingGifts}
      loadingText="Sending"
      onclick={sendGifts}
      variant="epic"
    >
      <GiftIcon class="size-5"/>
      {$t('itemShop.sendGift')}
    </Button>
  </div>
</Dialog>
