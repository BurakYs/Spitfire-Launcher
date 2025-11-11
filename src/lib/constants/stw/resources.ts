import type {
  DailyQuestData,
  GadgetData,
  HeroData,
  IngredientData,
  MissionData,
  RarityType,
  ResourceData,
  SurvivorData,
  SurvivorUniqueLeadData,
  TeamPerkData,
  TheaterData,
  TrapData,
  ZoneThemeData
} from '$types/game/stw/resources';

import resourcesJson from '$lib/data/resources.json';
import survivorsJson from '$lib/data/survivors.json';
import survivorsMythicLeadsJson from '$lib/data/survivors-mythic-leads.json';
import ingredientsJson from '$lib/data/ingredients.json';
import trapsJson from '$lib/data/traps.json';
import dailyQuestsJson from '$lib/data/daily-quests.json';
import teamPerksJson from '$lib/data/team-perks.json';
import gadgetsJson from '$lib/data/gadgets.json';
import heroesJson from '$lib/data/heroes.json';
import zoneThemesJson from '$lib/data/zone-themes.json';
import theatersJson from '$lib/data/theaters.json';
import missionsJson from '$lib/data/missions.json';
import { derived } from 'svelte/store';
import { t } from '$lib/utils/util';

export const RarityTypes = Object.freeze({
  Common: 'c',
  Uncommon: 'uc',
  Rare: 'r',
  Epic: 'vr',
  Legendary: 'sr',
  Mythic: 'ur'
} as const);

export const RarityNames = derived(t, ($t) => ({
  [RarityTypes.Common]: $t('rarities.common'),
  [RarityTypes.Uncommon]: $t('rarities.uncommon'),
  [RarityTypes.Rare]: $t('rarities.rare'),
  [RarityTypes.Epic]: $t('rarities.epic'),
  [RarityTypes.Legendary]: $t('rarities.legendary'),
  [RarityTypes.Mythic]: $t('rarities.mythic')
}));

export const RarityColors: Record<RarityType, string> = {
  [RarityTypes.Common]: '#8B9399',
  [RarityTypes.Uncommon]: '#6ABB1E',
  [RarityTypes.Rare]: '#3D9BF7',
  [RarityTypes.Epic]: '#6C3F9E',
  [RarityTypes.Legendary]: '#DA791D',
  [RarityTypes.Mythic]: '#D1AE49'
};

export const FounderEditions = Object.freeze({
  Standard: 'Quest:foundersquest_getrewards_0_1',
  Deluxe: 'Quest:foundersquest_getrewards_1_2',
  SuperDeluxe: 'Quest:foundersquest_getrewards_2_3',
  Limited: 'Quest:foundersquest_getrewards_3_4',
  Ultimate: 'Quest:foundersquest_getrewards_4_5'
} as const);

export const FounderEditionNames = derived(t, ($t) => ({
  [FounderEditions.Standard]: $t('stw.founderEditions.standard'),
  [FounderEditions.Deluxe]: $t('stw.founderEditions.deluxe'),
  [FounderEditions.SuperDeluxe]: $t('stw.founderEditions.superDeluxe'),
  [FounderEditions.Limited]: $t('stw.founderEditions.limited'),
  [FounderEditions.Ultimate]: $t('stw.founderEditions.ultimate')
}));

export const resources = resourcesJson as Record<string, ResourceData>;
export const survivors = survivorsJson as Record<string, SurvivorData>;
export const survivorsMythicLeads = survivorsMythicLeadsJson as Record<string, SurvivorUniqueLeadData>;
export const ingredients = ingredientsJson as Record<string, IngredientData>;
export const traps = trapsJson as Record<string, TrapData>;
export const dailyQuests = dailyQuestsJson as Record<string, DailyQuestData>;
export const teamPerks = teamPerksJson as Record<string, TeamPerkData>;
export const gadgets = gadgetsJson as Record<string, GadgetData>;
export const heroes = heroesJson as Record<string, HeroData>;
export const zoneThemes = zoneThemesJson as Record<string, ZoneThemeData>;
export const theaters = theatersJson as Record<string, TheaterData>;
export const missions = missionsJson as Record<string, MissionData>;