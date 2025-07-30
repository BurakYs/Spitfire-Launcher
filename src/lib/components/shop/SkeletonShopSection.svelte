<script lang="ts">
  import SkeletonShopItemCard from '$components/shop/SkeletonShopItemCard.svelte';

  const mininumItemCount = 2;
  const maximumItemCount = 4;
  const itemCount = Math.floor(Math.random() * (maximumItemCount - mininumItemCount + 1)) + mininumItemCount;
</script>

<div class="flex flex-col items-center w-full">
  <div class="skeleton-loader w-48 h-7 rounded-md mb-4 self-start"></div>
  <div class="w-full @container">
    <div class="grid gap-4 @max-[28rem]:grid-cols-2 @max-[36rem]:grid-cols-3 @max-[48rem]:grid-cols-4 @max-[60rem]:grid-cols-5 @max-[75rem]:grid-cols-6 @max-[90rem]:grid-cols-7">
      <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
      {#each Array(itemCount) as _, index (index)}
        <SkeletonShopItemCard/>
      {/each}
    </div>
  </div>
</div>