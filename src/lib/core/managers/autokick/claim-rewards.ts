import { settingsStorage } from '$lib/core/data-storage';
import MCPManager from '$lib/core/managers/mcp';
import { sleep } from '$lib/utils/util';
import type { AccountData } from '$types/accounts';
import type { CampaignProfile } from '$types/game/mcp';
import { get } from 'svelte/store';

export default async function claimRewards(account: AccountData, skipDelay = false) {
  const delaySeconds = get(settingsStorage).app?.claimRewardsDelay;
  if (!skipDelay && delaySeconds) {
    await sleep(delaySeconds * 1000);
  }

  const queryProfile = await MCPManager.queryProfile(account, 'campaign');
  const profile = queryProfile.profileChanges[0].profile;
  const attributes = profile.stats.attributes;

  const hasMissionAlertRewards = !!attributes.mission_alert_redemption_record?.pendingMissionAlertRewards?.items?.length;
  const hasDifficultyIncreaseRewards = !!attributes.difficulty_increase_rewards_record?.pendingRewards?.length;

  return Promise.allSettled([
    claimQuestRewards(account, profile.items),
    openCardPacks(account, profile.items),
    MCPManager.compose(account, 'RedeemSTWAccoladeTokens', 'athena', {}),
    hasMissionAlertRewards && MCPManager.compose(account, 'ClaimMissionAlertRewards', 'campaign', {}),
    hasDifficultyIncreaseRewards && MCPManager.compose(account, 'ClaimDifficultyIncreaseRewards', 'campaign', {})
  ]);
}

async function openCardPacks(account: AccountData, queryProfileItems: CampaignProfile['items']) {
  const cardPackItemIds = Object.entries(queryProfileItems)
    .filter(([, item]) => item.templateId.startsWith('CardPack:') && (item.attributes.match_statistics || item.attributes.pack_source === 'ItemCache'))
    .map(([id]) => id);

  if (!cardPackItemIds.length) return;

  return MCPManager.compose(account, 'OpenCardPackBatch', 'campaign', { cardPackItemIds });
}

async function claimQuestRewards(account: AccountData, queryProfileItems: CampaignProfile['items']) {
  const questIds = Object.entries(queryProfileItems)
    .filter(([, item]) => item.templateId.startsWith('Quest:') && item.attributes.quest_state === 'Completed')
    .map(([id]) => id);

  if (!questIds.length) return;

  return Promise.allSettled(
    questIds.map(id =>
      MCPManager.compose(account, 'ClaimQuestReward', 'campaign', { questId: id, selectedRewardIndex: 0 })
    )
  );
}
