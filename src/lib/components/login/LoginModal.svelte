<script lang="ts">
  import LoginStep0, { type LoginMethod } from '$components/login/LoginStep0.svelte';
  import LoginStep1 from '$components/login/LoginStep1.svelte';
  import LoginStep2 from '$components/login/LoginStep2.svelte';
  import { Dialog } from '$components/ui/Dialog';
  import LoginSteps from '$components/login/LoginSteps.svelte';
  import { t } from '$lib/utils/util';

  type Props = {
    open: boolean;
  };

  let { open = $bindable(false) }: Props = $props();

  let currentStep = $state(0);
  let selectedMethod = $state<LoginMethod | null>(null);

  const steps = $derived([
    $t('accountManager.loginSteps.select'),
    $t('accountManager.loginSteps.login'),
    $t('accountManager.loginSteps.completed')
  ]);

  $effect(() => {
    const isLastStep = currentStep === steps.length - 1;
    if (isLastStep) {
      setTimeout(() => {
        open = false;
        currentStep = 0;
        selectedMethod = null;
      }, 3000);
    }
  });

  function selectLoginMethod(method: LoginMethod) {
    selectedMethod = method;
    goToNextStep();
  }

  function goToNextStep() {
    if (currentStep < steps.length - 1) {
      currentStep++;
    }
  }

  function goToPreviousStep() {
    if (currentStep > 0) {
      currentStep--;
    }

    if (currentStep === 0) {
      selectedMethod = null;
    }
  }
</script>

<Dialog.Root contentProps={{ class: 'overflow-hidden' }} bind:open>
  <div class="flex flex-col">
    <LoginSteps {currentStep} {steps}/>

    <div class="mt-4 min-h-64">
      {#if currentStep === 0}
        <LoginStep0 {selectLoginMethod}/>
      {:else if currentStep === 1}
        <LoginStep1
          {goToNextStep}
          {goToPreviousStep}
          selectedMethod={selectedMethod!}
        />
      {:else if currentStep === 2}
        <LoginStep2/>
      {/if}
    </div>
  </div>
</Dialog.Root>
