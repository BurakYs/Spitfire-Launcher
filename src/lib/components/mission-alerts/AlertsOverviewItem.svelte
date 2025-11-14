<script lang="ts">
  import { language } from '$lib/core/data-storage';

  type Props = {
    name: string;
    icon: string;
    amount: number;
  };

  const { name, icon, amount }: Props = $props();
</script>

<div class="flex items-center border rounded-md">
  <div class="flex items-center justify-center size-10 bg-muted-foreground/10 shrink-0">
    <img class="size-7" alt={name} src={icon}/>
  </div>

  <div class="grow px-2 font-medium text-center">
    {amount.toLocaleString($language)}
  </div>
</div>
