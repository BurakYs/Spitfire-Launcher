import type { WorldParsedMission } from '$types/game/stw/worldInfo';
import type { RarityTypes } from '$lib/constants/stw/resources';
import type { Locale } from '$lib/paraglide/runtime';

export type RarityType = typeof RarityTypes[keyof typeof RarityTypes];
export type ResourceType =
  | 'construction'
  | 'currency'
  | 'evo'
  | 'perk'
  | 'sc'
  | 'token'
  | 'voucher'
  | 'xp'
  | 'xpboost';

export type ResourceData = {
  name: string;
  type: ResourceType;
};

export type SurvivorData = {
  gender: number;
  name: string | null;
  portrait: string | null;
};

export type SurvivorUniqueLeadData = {
  managerSynergy: string;
  personality: string;
  portrait: string;
};

export type IngredientData = {
  name: string;
};

export type TrapData = {
  name: string;
};

export type TeamPerkData = {
  name: string;
  icon: string;
};

export type GadgetData = {
  name: string;
  icon: string;
};

export type HeroData = {
  name: string;
  type: 'Soldier' | 'Constructor' | 'Ninja' | 'Outlander';
};

export type ZoneThemeData = {
  names: Record<Locale, string>;
};

export type TheaterData = {
  names: Record<Locale, string>;
};

export type ParsedModifierData = WorldParsedMission['mission']['modifiers'][number];

export type ParsedResourceData = {
  imageUrl: string;
  itemType: string;
  key: string;
  name: string;
  rarity: RarityType;
  type:
    | 'defender'
    | 'hero'
    | 'melee'
    | 'ranged'
    | 'resource'
    | 'ingredient'
    | 'trap'
    | 'worker'
    | null;
  quantity: number;
};

export type DailyQuestData = {
  names: Record<Locale, string>;
  limit: number;
  rewards: {
    gold: number;
    mtx: number;
    xp: number;
  };
};