import type { ParsedResourceData, RarityType } from '$types/game/stw/resources';
import { Theaters, type ZoneCategories } from '$lib/constants/stw/worldInfo';

export type WorldInfoData = {
  missionAlerts: Array<{
    availableMissionAlerts: Array<{
      name: string
      missionAlertGuid: string
      tileIndex: number
      missionAlertRewards: {
        tierGroupName: string
        items: Array<{
          attributes?: {
            Alteration?: Partial<{
              LootTierGroup: string
              Tier: number
            }>
          }
          itemType: string
          quantity: number
        }>
      }
      missionAlertModifiers: {
        tierGroupName: string
        items: Array<{
          itemType: string
          quantity: number
        }>
      }
    }>
    nextRefresh: string
    theaterId: string
  }>
  missions: Array<{
    availableMissions: Array<{
      missionGuid: string
      missionRewards: {
        tierGroupName: string
        items: Array<{
          itemType: string
          quantity: number
        }>
      }
      missionGenerator: string
      tileIndex: number
    }>
    nextRefresh: string
    theaterId: string
  }>
  theaters: Array<{
    displayName: Record<AvailableLocales, string>
    uniqueId: string
    missionRewardNamedWeightsRowName: string
    description: Record<AvailableLocales, string>
    tiles: Array<Tile>
    regions: Array<Region>
  }>
}

type AvailableLocales =
  | 'de'
  | 'ru'
  | 'ko'
  | 'pt-br'
  | 'en'
  | 'it'
  | 'fr'
  | 'es'
  | 'ar'
  | 'ja'
  | 'pl'
  | 'es-419'
  | 'tr'

type Region = {
  displayName: Record<AvailableLocales, string>
  uniqueId: string
  tileIndices: Array<number>
  missionData: {
    difficultyWeights: Array<{
      difficultyInfo: {
        dataTable: string
        rowName: string
      }
      weight: number
    }>
  }
}

type Tile = {
  tileType: string
  zoneTheme: string
  requirements: {
    commanderLevel: number
    personalPowerRating: number
    maxPersonalPowerRating: number
    partyPowerRating: number
    maxPartyPowerRating: number
  }
  xCoordinate: number
  yCoordinate: number
}

export type WorldParsedMission = {
  filters: string[]
  guid: string
  generator: string
  tileIndex: number
  modifiers: Array<{
    id: string
    imageUrl: string
  }> | null
  rewards: Array<{
    imageUrl: string
    itemId: string
    isHard: boolean
    key: string
    quantity: number
  }>
  zone: {
    color: string
    iconUrl?: string
    letter: string
    theme: string
    type: {
      id?: keyof typeof ZoneCategories
      imageUrl?: string
    }
  }
  powerLevel: number
  alert: {
    guid: string
    rewards: Array<
      {
        itemId: string
        imageUrl: string
        quantity: number
        rarity: RarityType
      } & Pick<ParsedResourceData, 'type'>
    >
  } | null
}

export type ParsedWorldInfo = Map<Theaters, Map<string, WorldParsedMission>>