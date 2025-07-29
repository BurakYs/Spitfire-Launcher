<script lang="ts">
  import Combobox from '$components/ui/Combobox/Combobox.svelte';
  import { accountsStorage } from '$lib/core/data-storage';
  import UserIcon from 'lucide-svelte/icons/user';
  import type { AccountData } from '$types/accounts';
  import type { ClassValue } from 'svelte/elements';
  import { t } from '$lib/utils/util';

  type Props = {
    customList?: AccountData[];
    // Auto selects the only account in the list if it's the only one
    autoSelect?: boolean;
    disabled?: boolean;
    class?: ClassValue;
    triggerClass?: ClassValue;
  } & (
    | {
      type: 'single';
      selected?: string;
    }
    | {
      type: 'multiple';
      selected?: string[];
    }
  );

  let {
    customList,
    autoSelect = true,
    type = 'multiple',
    selected = $bindable(),
    disabled,
    class: className,
    triggerClass
  }: Props = $props();

  const accountList = $derived(customList || $accountsStorage.accounts);
  const items = $derived(accountList.map((account) => ({
    value: account.accountId,
    label: account.displayName
  })));

  $effect(() => {
    if (autoSelect && accountList.length === 1) {
      const { accountId } = accountList[0];
      selected = type === 'multiple' ? [accountId] : accountId;

      return;
    }

    if (!selected?.length) return;

    if (typeof selected === 'string') {
      const isValid = accountList.some(account => account.accountId === selected);
      if (!isValid) selected = undefined;
    }

    if (Array.isArray(selected)) {
      const filtered = selected.filter(accountId => accountList.some(account => account.accountId === accountId));

      if (filtered.length !== selected.length) {
        selected = filtered;
      }
    }
  });

  const selectedAccounts = $derived.by(() => {
    if (!selected?.length) {
      return type === 'single'
        ? $t('accountManager.selectAccount')
        : $t('accountManager.selectAccounts');
    }

    if (type === 'single' || (type === 'multiple' && selected.length < 3)) {
      return Array.isArray(selected)
        ? selected.map(getAccountName).join(', ')
        : getAccountName(selected);
    }

    return $t('accountManager.selectedAccounts', { count: selected.length });
  });

  function getAccountName(accountId: string) {
    return accountList.find((account) => account.accountId === accountId)?.displayName;
  }
</script>

<Combobox
  contentProps={{
    side: 'bottom',
    avoidCollisions: false
  }}
  disabled={disabled || !accountList.length}
  icon={UserIcon}
  inputProps={{ class: className }}
  {items}
  placeholder={selectedAccounts}
  {triggerClass}
  {type}
  bind:value={selected as never}
/>
