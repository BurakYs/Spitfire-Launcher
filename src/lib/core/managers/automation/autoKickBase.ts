import DataStorage, { AUTOMATION_FILE_PATH } from '$lib/core/dataStorage';
import { get } from 'svelte/store';
import { accountsStore, automationStore, doingBulkOperations } from '$lib/stores';
import type { AccountData } from '$types/accounts';
import type { AutomationSetting, AutomationSettings } from '$types/settings';
import XMPPManager from '$lib/core/managers/xmpp';
import { EventNotifications, type PartyState, ServiceEvents } from '$lib/constants/events';
import AutoKickManager from '$lib/core/managers/automation/autoKickManager';
import claimRewards from '$lib/utils/autoKick/claimRewards';
import transferBuildingMaterials from '$lib/utils/autoKick/transferBuildingMaterials';

export type AutomationAccount = {
  status: 'LOADING' | 'ACTIVE' | 'INVALID_CREDENTIALS' | 'DISCONNECTED';
  account: AccountData;
  settings: Partial<Omit<AutomationSetting, 'accountId'>>;
}

export default class AutoKickBase {
  private static accounts: Map<string, AutomationAccount> = new Map();
  private static connections: Map<string, XMPPManager> = new Map();
  private static autoKickManagers: Map<string, AutoKickManager> = new Map();
  private static abortControllers: Map<string, AbortController> = new Map();

  static async loadAccounts() {
    const accounts = await DataStorage.getAutomationFile();
    if (!accounts?.length) return;

    doingBulkOperations.set(true);

    const { allAccounts } = get(accountsStore);
    await Promise.allSettled(accounts.map(async automationAccount => {
      const account = allAccounts.find(a => a.accountId === automationAccount.accountId);
      const isAnySettingEnabled = Object.entries(automationAccount)
        .filter(([key]) => key !== 'accountId')
        .some(([, value]) => value);

      if (!account || !isAnySettingEnabled) {
        AutoKickBase.removeAccount(automationAccount.accountId);
        return;
      }

      await AutoKickBase.addAccount(account, automationAccount, false);
    }));

    doingBulkOperations.set(false);
  }

  static async addAccount(account: AccountData, settings: AutomationAccount['settings'] = {}, writeToFile = true) {
    if (AutoKickBase.accounts.has(account.accountId)) return;

    AutoKickBase.accounts.set(account.accountId, {
      status: 'LOADING',
      account,
      settings
    });

    await AutoKickBase.updateSettings(account.accountId, settings, writeToFile);
    await AutoKickBase.startAccount(account.accountId);
  }

  static removeAccount(accountId: string) {
    AutoKickBase.autoKickManagers.get(accountId)?.dispose();
    AutoKickBase.autoKickManagers.delete(accountId);

    AutoKickBase.abortControllers.get(accountId)?.abort();
    AutoKickBase.abortControllers.delete(accountId);

    AutoKickBase.connections.get(accountId)?.removePurpose('autoKick');
    AutoKickBase.connections.delete(accountId);

    automationStore.update(s => s.filter(a => a.accountId !== accountId));
    AutoKickBase.accounts.delete(accountId);

    DataStorage.writeConfigFile<AutomationSettings>(AUTOMATION_FILE_PATH, AutoKickBase.accounts.values().toArray().map((x) => ({
      accountId: x.account.accountId,
      ...x.settings
    }))).catch(() => null);
  }

  static async updateSettings(accountId: string, settings: Partial<AutomationSetting>, writeToFile = true) {
    const account = AutoKickBase.getAccountById(accountId);
    if (!account) return;

    account.settings = {
      ...account.settings,
      ...settings
    };

    const newSettings = AutoKickBase.accounts.values().toArray().map((x) => ({
      accountId: x.account.accountId,
      ...x.settings
    }));

    automationStore.set(newSettings.map((x) => ({
      ...x,
      status: AutoKickBase.getAccountById(x.accountId)?.status ?? 'LOADING'
    })));

    if (writeToFile) await DataStorage.writeConfigFile<AutomationSettings>(AUTOMATION_FILE_PATH, newSettings);
  }

  static async startAccount(accountId: string) {
    doingBulkOperations.set(true);

    const account = get(accountsStore).allAccounts.find(a => a.accountId === accountId)!;
    const automationAccount = AutoKickBase.getAccountById(accountId);
    if (!automationAccount) return;

    try {
      AutoKickBase.updateStatus(accountId, 'LOADING');

      const connection = await XMPPManager.create(account, 'autoKick').catch(() => null);
      if (!connection) {
        AutoKickBase.updateStatus(accountId, 'INVALID_CREDENTIALS');
        return;
      }

      AutoKickBase.addEventListeners(connection);

      await connection.connect();

      AutoKickBase.connections.set(accountId, connection);
      AutoKickBase.updateStatus(accountId, 'ACTIVE');
    } catch (error) {
      AutoKickBase.updateStatus(accountId, 'DISCONNECTED');
    }

    doingBulkOperations.set(false);
  }

  private static addEventListeners(connection: XMPPManager) {
    const { account } = AutoKickBase.getAccountById(connection.accountId!)!;

    const abortController = new AbortController();
    const { signal } = abortController;
    AutoKickBase.abortControllers.set(account.accountId, abortController);

    const oldProvider = AutoKickBase.autoKickManagers.get(account.accountId);
    if (oldProvider) {
      oldProvider.dispose();
      AutoKickBase.autoKickManagers.delete(account.accountId);
    }

    const autoKickManager = new AutoKickManager(account);
    AutoKickBase.autoKickManagers.set(account.accountId, autoKickManager);

    let partyState: PartyState;

    connection.addEventListener(ServiceEvents.SessionStarted, async () => {
      AutoKickBase.updateStatus(account.accountId, 'ACTIVE');
      await autoKickManager.checkMissionOnStartup();
    }, { signal });

    connection.addEventListener(ServiceEvents.Disconnected, async () => {
      AutoKickBase.updateStatus(account.accountId, 'DISCONNECTED');
      autoKickManager.dispose();
    }, { signal });

    connection.addEventListener(EventNotifications.MemberDisconnected, async (data) => {
      if (data.account_id !== account.accountId) return;

      autoKickManager.dispose();
    }, { signal });

    connection.addEventListener(EventNotifications.MemberExpired, async (data) => {
      if (data.account_id !== account.accountId) return;

      autoKickManager.dispose();
    }, { signal });

    connection.addEventListener(EventNotifications.MemberKicked, async (data) => {
      if (data.account_id !== account.accountId) return;

      if (autoKickManager.matchmakingState.partyState === 'PostMatchmaking' && autoKickManager.matchmakingState.started) {
        const automationAccount = AutoKickBase.getAccountById(account.accountId);

        if (automationAccount?.settings.autoTransferMaterials) {
          transferBuildingMaterials(account).catch(console.error);
        }

        if (automationAccount?.settings.autoClaim) {
          await claimRewards(account);
        }
      }
    }, { signal });

    connection.addEventListener(EventNotifications.MemberJoined, async (data) => {
      if (data.account_id !== account.accountId) return;

      AutoKickBase.updateStatus(account.accountId, 'ACTIVE');
      autoKickManager.initMissionCheckerIntervalTimeout(20000);
    }, { signal });

    connection.addEventListener(EventNotifications.PartyUpdated, async (data) => {
      const newPartyState = data.party_state_updated?.['Default:PartyState_s'] as PartyState | undefined;
      if (!newPartyState) return;

      partyState = newPartyState;

      if (partyState === 'PostMatchmaking') {
        autoKickManager.initMissionCheckerIntervalTimeout();
      }
    }, { signal });
  }

  static getAccountById(accountId: string) {
    return AutoKickBase.accounts.get(accountId);
  }

  private static updateStatus(accountId: string, status: AutomationAccount['status']) {
    const account = AutoKickBase.getAccountById(accountId);
    if (!account) return;

    account.status = status;
    automationStore.update(s => s.map(a => a.accountId === accountId ? { ...a, status } : a));
  }
}