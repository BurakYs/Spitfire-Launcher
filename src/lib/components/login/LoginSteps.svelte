<script lang="ts">
  import { cn } from '$lib/utils/util';

  type Props = {
    steps: string[];
    currentStep: number;
  };

  const { steps, currentStep }: Props = $props();
</script>

<div class="relative mb-6 select-none">
  <div class="absolute left-0 top-4 h-1 w-full bg-muted/25">
    <div
      style="width: {(currentStep / (steps.length - 1) * 100) || 20}%"
      class="h-full bg-muted transition-all duration-500 ease-in-out"
    ></div>
  </div>

  <div class="relative flex justify-between">
    {#each steps as step, index (step)}
      <div class="relative flex flex-col items-center flex-1">
        <div
          class={cn(
            'z-10 flex size-8 items-center justify-center rounded-full border transition-all',
            index <= currentStep
              ? 'border-muted bg-accent text-accent-foreground'
              : 'border-muted bg-background text-muted-foreground'
          )}
        >
          {index + 1}
        </div>

        <span class="absolute top-10 w-max max-w-[120px] text-center text-xs" class:text-foreground={index <= currentStep} class:text-muted-foreground={!(index <= currentStep)}>
          {step}
        </span>
      </div>
    {/each}
  </div>
</div>
