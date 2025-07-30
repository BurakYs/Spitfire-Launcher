export type MCPOperation =
  | 'AbandonExpedition'
  | 'ActivateConsumable'
  | 'AddToCollection'
  | 'ApplyVote'
  | 'AssignGadgetToLoadout'
  | 'AssignHeroToLoadout'
  | 'AssignTeamPerkToLoadout'
  | 'AssignWorkerToSquad'
  | 'AssignWorkerToSquadBatch'
  | 'AthenaPinQuest'
  | 'AthenaRemoveQuests'
  | 'BulkUpdateCollections'
  | 'CancelOrResumeSubscription'
  | 'ChallengeBundleLevelUp'
  | 'ClaimCollectedResources'
  | 'ClaimCollectionBookPageRewards'
  | 'ClaimCollectionBookRewards'
  | 'ClaimDifficultyIncreaseRewards'
  | 'ClaimImportFriendsReward'
  | 'ClaimLoginReward'
  | 'ClaimMfaEnabled'
  | 'ClaimMissionAlertRewards'
  | 'ClaimQuestReward'
  | 'ClaimSubscriptionRewards'
  | 'ClearHeroLoadout'
  | 'ClientQuestLogin'
  | 'CollectExpedition'
  | 'CompletePlayerSurvey'
  | 'ConvertItem'
  | 'ConvertLegacyAlterations'
  | 'ConvertSlottedItem'
  | 'CopyCosmeticLoadout'
  | 'CraftWorldItem'
  | 'CreateNewBattleLabFile'
  | 'CreateNewIsland'
  | 'CreateNewIslandFromLinkCode'
  | 'DeleteBattleLabIsland'
  | 'DeleteCosmeticLoadout'
  | 'DeleteIsland'
  | 'DeleteModularCosmeticLoadout'
  | 'DepositPostResources'
  | 'DestroyWorldItems'
  | 'DisassembleWorldItems'
  | 'DuplicateIsland'
  | 'EndBattleRoyaleGame'
  | 'EndBattleRoyaleGameV2'
  | 'EquipModularCosmeticLoadoutPreset'
  | 'ExchangeGameCurrencyForBattlePassOffer'
  | 'ExchangeGiftToken'
  | 'FortRerollDailyQuest'
  | 'GiftCatalogEntry'
  | 'InitializeTheater'
  | 'IssueFriendCode'
  | 'LockProfileForWrite'
  | 'MarkCollectedItemsSeen'
  | 'MarkItemSeen'
  | 'MarkNewQuestNotificationSent'
  | 'ModifyCreativePlotPermissions'
  | 'ModifyMission'
  | 'ModifyQuickbar'
  | 'OpenCardPack'
  | 'OpenCardPackBatch'
  | 'PopulatePrerolledOffers'
  | 'PromoteItem'
  | 'ProtoJuno_CreateWorld'
  | 'ProtoJuno_DeleteAllWorlds'
  | 'ProtoJuno_DeleteWorld'
  | 'ProtoJuno_MarkWorldDeleted'
  | 'ProtoJuno_SetWorldName'
  | 'ProtoJuno_UpdateWorldLastAccessTime'
  | 'ProtoJuno_UpdateWorldMetadata'
  | 'ProtoJuno_UpdateWorldSysMetadata'
  | 'PurchaseCatalogEntry'
  | 'PurchaseMultipleCatalogEntries'
  | 'PurchaseOrUpgradeHomebaseNode'
  | 'PurchaseResearchStatUpgrade'
  | 'PutModularCosmeticLoadout'
  | 'QueryProfile'
  | 'QueryPublicProfile'
  | 'RecordCampaignMatchEnded'
  | 'RecycleItem'
  | 'RecycleItemBatch'
  | 'RedeemRealMoneyPurchases'
  | 'RedeemSTWAccoladeTokens'
  | 'RefreshExpeditions'
  | 'RefundItem'
  | 'RefundMtxPurchase'
  | 'RemoveGiftBox'
  | 'ReportConsumableUsed'
  | 'RequestRestedStateIncrease'
  | 'ResearchItemFromCollectionBook'
  | 'RespecAlteration'
  | 'RespecResearch'
  | 'RespecUpgrades'
  | 'RestoreDeletedIsland'
  | 'ServerQuestLogin'
  | 'SetActiveArchetype'
  | 'SetActiveHeroLoadout'
  | 'SetAffiliateName'
  | 'SetCosmeticLockerBanner'
  | 'SetCosmeticLockerName'
  | 'SetCosmeticLockerSlot'
  | 'SetCosmeticLockerSlots'
  | 'SetCreativePlotMetadata'
  | 'SetForcedIntroPlayed'
  | 'SetGameplayStats'
  | 'SetHardcoreModifier'
  | 'SetHeroCosmeticVariants'
  | 'SetHomebaseBanner'
  | 'SetHomebaseName'
  | 'SetIntroGamePlayed'
  | 'SetItemArchivedStatusBatch'
  | 'SetItemFavoriteStatus'
  | 'SetItemFavoriteStatusBatch'
  | 'SetLastUsedBattleLabFile'
  | 'SetLastUsedCreativePlot'
  | 'SetLastUsedProject'
  | 'SetLoadoutShuffleEnabled'
  | 'SetMatchmakingBansViewed'
  | 'SetMtxPlatform'
  | 'SetPinnedQuests'
  | 'SetRandomCosmeticLoadoutFlag'
  | 'SetReceiveGiftsEnabled'
  | 'SetRewardGraphConfig'
  | 'SkipTutorial'
  | 'StartExpedition'
  | 'StorageTransfer'
  | 'ToggleQuestActiveState'
  | 'UnassignAllSquads'
  | 'UnlockProfileForWrite'
  | 'UnlockRewardNode'
  | 'UnslotItemFromCollectionBook'
  | 'UpdatePlotPublishInfo'
  | 'UpdateQuestClientObjectives'
  | 'UpdateQuests'
  | 'UpgradeAlteration'
  | 'UpgradeItem'
  | 'UpgradeItemBulk'
  | 'UpgradeItemRarity'
  | 'UpgradeSlottedItem'
  | 'VerifyRealMoneyPurchase';

export type MCPProfileId =
  | 'athena'
  | 'creative'
  | 'campaign'
  | 'common_public'
  | 'collections'
  | 'common_core'
  | 'metadata'
  | 'collection_book_people0'
  | 'collection_book_schematics0'
  | 'outpost0'
  | 'theater0'
  | 'theater1'
  | 'theater2'
  | 'recycle_bin';

export type BaseProfile<T = Record<string, any>> = {
  _id: string;
  created: string;
  updated: string;
  rvn: number;
  wipeNumber: number;
  accountId: string;
  profileId: string;
  version: string;
  commandRevision: number;
  items: {
    [key: string]: ProfileItem;
  };
  stats: {
    attributes: T;
  };
};

type ProfileItem = {
  templateId: string;
  attributes: {
    [key: string]: any;
  };
  quantity: number;
};

export type AthenaProfileAttributes = {
  past_seasons: {
    numWins: number;
    seasonXp: number;
    purchasedVIP: boolean;
    seasonLevel: number;
    numLowBracket: number;
    bookLevel: number;
    numRoyalRoyales: number;
    seasonNumber: number;
    numHighBracket: number;
  }[];
  loadouts: [string];
  mfa_reward_claimed: boolean;
  book_level: number;
  season_num: number;
  book_xp: number;
  creative_dynamic_xp: {
    dailyExcessXpMult: number;
    currentWeekXp: number;
    bankXp: number;
    currentDayXp: number;
    bankXpMult: number;
    currentDay: number;
    boosterBucketXp: number;
    boosterXpMult: number;
    timespan: number;
    bucketXp: number;
  };
  season: {
    numWins: number;
    numLowBracket: number;
    numHighBracket: number;
  };
  lifetime_wins: number;
  playtime_xp: {
    currentWeekXp: number;
    currentWeek: number;
  };
  level: number;
  rested_xp: number;
  rested_xp_mult: number;
  accountLevel: number;
  xp_overflow: number;
  last_stw_match_end_datetime: string;
  last_match_end_datetime: string;
};

export type AthenaProfile = BaseProfile<AthenaProfileAttributes>;

export type CampaignProfileAttributes = {
  mission_alert_redemption_record: Partial<{
    claimData: {
      missionAlertId: string;
      redemptionDateUtc: string;
      evictClaimDataAfterUtc: string;
    }[];
    pendingMissionAlertRewards: {
      tierGroupName: 'MissionAlert_Storm:4';
      items: {
        itemType: string;
        quantity: number;
      }[];
    }
  }>;
  difficulty_increase_rewards_record?: {
    pendingRewards: {
      difficultyIncreaseMissionRewards: {
        tierGroupName: 'BluGloDifficultyTG:4';
        items: {
          itemType: string;
          quantity: number;
        }[];
      };
      difficultyIncreaseTier: number;
    }[];
  };
  rewards_claimed_post_max_level: number;
  selected_hero_loadout: string;
  loadouts: string[];
  collection_book: Partial<{
    maxBookXpLevelAchieved: number;
  }>;
  mfa_reward_claimed: boolean;
  quest_manager: Partial<{
    dailyLoginInterval: string;
    dailyQuestRerolls: number;
  }>;
  gameplay_stats: {
    statName: string;
    statValue: number;
  }[];
  unslot_mtx_spend: number;
  client_settings: Partial<{
    pinnedQuestInstances: any[];
  }>;
  research_levels: Partial<{
    technology: number;
    offense: number;
    fortitude: number;
    resistance: number;
  }>;
  level: number;
  xp_overflow: number;
  event_currency?: {
    templateId: string;
    cf: number;
  };
  inventory_limit_bonus: number;
  matches_played: number;
  xp_lost: number;
  last_applied_loadout: string;
  daily_rewards: Partial<{
    nextDefaultReward: number;
    totalDaysLoggedIn: number;
    lastClaimDate: string;
    additionalSchedules: {
      [key: string]: {
        rewardsClaimed: number;
        claimedToday: boolean;
      };
    };
  }>;
  xp: number;
  active_loadout_index: number;
};

export type CampaignProfile = BaseProfile<CampaignProfileAttributes>;

export type CommonCoreProfileAttributes = {
  mtx_purchase_history: {
    refundsUsed: number;
    purchases: {
      purchaseDate: string;
      metadata: Partial<{
        mtx_affiliate: string;
        mtx_affiliate_id: string;
      }>;
      refundDate?: string;
      undoTimeout?: string;
      totalMtxPaid: number;
      purchaseId: string;
      offerId: string;
      freeRefundEligible: boolean;
      lootResult: {
        itemType: string;
        quantity: number;
        itemGuid: string;
        itemProfile: MCPProfileId;
      }[];
    }[];
    refundCredits: number;
    tokenRefreshReferenceTime: string;
  };
  undo_cooldowns: {
    offerId: string;
    cooldownExpires: string;
  }[];
  mtx_affiliate_set_time: string;
  current_mtx_platform: 'EpicPC' | 'Live' | 'PSN' | 'Nintendo' | 'IOSAppStore' | 'Samsung' | 'GooglePlay';
  mtx_affiliate: string;
  mtx_affiliate_id: string;
  in_app_purchases: {
    fulfillmentCounts: Record<string, number>;
  };
  allowed_to_send_gifts: boolean;
  mfa_enabled: boolean;
  gift_history: {
    sentTo: Record<string, string>;
    receivedFrom: Record<string, string>;
    num_sent: number;
    num_received: number;
  };
  ban_status?: {
    bBanHasStarted: boolean;
    banReasons?: string[];
    banDurationDays: number;
    competitiveBanReason?: string;
    additionalInfo?: string;
    exploitProgramName?: string;
    banStartTimeUtc: string;
    bRequiresUserAck: boolean;
  };
};

export type CommonCoreProfile = BaseProfile<CommonCoreProfileAttributes>;

type QueryProfileMapping = {
  athena: AthenaProfile;
  campaign: CampaignProfile;
  common_core: CommonCoreProfile;
};

export type ProfileFromId<T extends EpicProfileId> = T extends keyof QueryProfileMapping ? QueryProfileMapping[T] : BaseProfile;

export type FullQueryProfile<T extends MCPProfileId> = {
  profileRevision: number;
  profileId: T;
  profileChangesBaseRevision: number;
  profileChanges: [
    {
      changeType: 'fullProfileUpdate';
      profile: ProfileFromId<T>;
    }
  ];
  profileCommandRevision: number;
  serverTime: string;
  responseVersion: number;
};