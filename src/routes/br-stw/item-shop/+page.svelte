<script lang="ts" module>
  import type { SpitfireShopFilter } from '$types/game/shop';

  let searchQuery = $state<string>('');
  let selectedFilter = $state<SpitfireShopFilter>();
</script>

<script lang="ts">
  import PageContent from '$components/PageContent.svelte';
  import ShopItemModal from '$components/shop/modals/ShopItemModal.svelte';
  import ShopFilter from '$components/shop/ShopFilter.svelte';
  import ShopSection from '$components/shop/ShopSection.svelte';
  import SkeletonShopSection from '$components/shop/SkeletonShopSection.svelte';
  import Input from '$components/ui/Input/Input.svelte';
  import { activeAccountStore as activeAccount } from '$lib/core/data-storage';
  import FriendsManager from '$lib/core/managers/friends';
  import LookupManager from '$lib/core/managers/lookup';
  import MCPManager from '$lib/core/managers/mcp';
  import ShopManager from '$lib/core/managers/shop';
  import { accountDataStore, brShopStore, ownedItemsStore } from '$lib/stores';
  import { calculateVbucks, formatRemainingDuration, getResolvedResults, t } from '$lib/utils/util';
  import type { AccountStoreData } from '$types/accounts';
  import type { SpitfireShopSection } from '$types/game/shop';
  import Fuse from 'fuse.js';
  import { onMount } from 'svelte';

  $effect(() => {
    const alreadyFetched = $activeAccount && Object.keys($accountDataStore[$activeAccount.accountId] || {}).length > 0;
    if (!$activeAccount || alreadyFetched) return;

    fetchAccountData();
  });

  let remainingTime = $state(getResetDate().getTime() - Date.now());
  let shopSections = $state<SpitfireShopSection[] | null>(null);
  let errorOccurred = $state(false);
  let modalOfferId = $state<string>('');

  const filteredSections = $derived.by(() => {
    if (!shopSections) return null;

    let result: SpitfireShopSection[] = shopSections;

    switch (selectedFilter) {
      case 'new':
        result = result.map((section) => ({
          ...section,
          items: section.items.filter((item) => !item.dates.lastSeen || item.shopHistory.length < 2)
        }));
        break;
      case 'leavingSoon':
        result = result.map((section) => ({
          ...section,
          items: section.items.filter((item) => item.dates.out && new Date(item.dates.out).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000)
        }));
        break;
      case 'longestWait':
        result = result.map((section) => ({
          ...section,
          items: section.items.filter((item) => item.dates.lastSeen && Date.now() - new Date(item.dates.lastSeen).getTime() > 120 * 24 * 60 * 60 * 1000)
        }));
        break;
    }

    if (searchQuery) {
      result = result.map((section) => {
        const fuse = new Fuse(section.items, {
          keys: ['name'],
          threshold: 0.4,
          shouldSort: false
        });

        return {
          ...section,
          items: fuse.search(searchQuery).map((result) => result.item)
        };
      });
    }

    return result.filter((x) => x.items.length > 0);
  });

  async function fetchShop(forceRefresh = false) {
    shopSections = null;

    try {
      const shopResponse = (!forceRefresh && $brShopStore) || await ShopManager.fetch();
      shopSections = ShopManager.groupBySections(shopResponse.offers).map((section) => ({
        ...section,
        items: section.items.sort((a, b) => b.sortPriority - a.sortPriority)
      }));
    } catch (error) {
      console.error(error);
      errorOccurred = true;
    }
  }

  async function fetchAccountData() {
    const account = $activeAccount!;
    const [athenaProfile, commonCoreProfile, friendsList] = await getResolvedResults([
      MCPManager.queryProfile(account, 'athena'),
      MCPManager.queryProfile(account, 'common_core'),
      FriendsManager.getFriends(account)
    ]);

    let accountData: AccountStoreData = {
      vbucks: 0,
      remainingGifts: 0,
      friends: []
    };

    if (athenaProfile) {
      const profile = athenaProfile.profileChanges[0].profile;
      const items = Object.values(profile.items);
      const ownedItems = items.filter((item) => item.attributes.item_seen != null).map((item) => item.templateId.split(':')[1].toLowerCase());

      ownedItemsStore.update((accounts) => {
        accounts[account.accountId] = new Set<string>(ownedItems);
        return accounts;
      });
    }

    if (commonCoreProfile) {
      const profile = commonCoreProfile.profileChanges[0].profile;
      accountData.vbucks = calculateVbucks(commonCoreProfile);
      accountData.remainingGifts = profile.stats.attributes.allowed_to_send_gifts ? 5 : 0;
    }

    if (friendsList) {
      const accountsData = await LookupManager.fetchByIds(account, friendsList.map((friend) => friend.accountId));

      accountData.friends = accountsData
        .sort((a, b) => (a.displayName || a.id).localeCompare(b.displayName || b.id))
        .map((account) => ({
          displayName: account.displayName || account.id,
          accountId: account.id
        }));
    }

    if (commonCoreProfile || friendsList) {
      accountDataStore.update((accounts) => {
        accounts[account.accountId] = accountData;
        return accounts;
      });
    }
  }

  function getResetDate() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const day = now.getUTCDate();

    return new Date(Date.UTC(year, month, day + 1));
  }

  onMount(() => {
    let isFetching = true;
    fetchShop().finally(() => isFetching = false);

    let intervalId = setInterval(() => {
      const nextResetDate = getResetDate();
      remainingTime = nextResetDate.getTime() - Date.now();

      if (Date.now() > nextResetDate.getTime() && !isFetching) {
        isFetching = true;
        fetchShop(true).finally(() => {
          isFetching = false;
        });
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  });
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key === 'F5') {
      event.preventDefault();
      errorOccurred = false;
      fetchShop(true);
    }
  }}
/>

<PageContent
  class="mt-2"
  description={remainingTime ? $t('itemShop.nextRotation', { time: formatRemainingDuration(remainingTime) }) : undefined}
  title={$t('itemShop.page.title')}
>
  <div class="flex max-xs:flex-col items-center gap-2">
    <Input
      class="max-w-64 max-xs:max-w-full w-full"
      placeholder={$t('itemShop.searchPlaceholder')}
      type="search"
      bind:value={searchQuery}
    />
    <ShopFilter bind:selected={selectedFilter}/>
  </div>

  <div class="mt-4">
    {#if !filteredSections}
      {#if errorOccurred}
        <p class="text-red-500">{$t('itemShop.failedtoFetch')}</p>
      {:else}
        <div class="space-y-9">
          <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
          {#each Array(2) as _, index (index)}
            <SkeletonShopSection/>
          {/each}
        </div>
      {/if}
    {:else if filteredSections?.length}
      <div class="space-y-9">
        {#each filteredSections as section (section.id)}
          <ShopSection {section} bind:modalOfferId/>
        {/each}
      </div>
    {:else}
      <p>{$t('itemShop.noItems')}</p>
    {/if}
  </div>

  {#if modalOfferId}
    <ShopItemModal bind:offerId={modalOfferId}/>
  {/if}
</PageContent>
