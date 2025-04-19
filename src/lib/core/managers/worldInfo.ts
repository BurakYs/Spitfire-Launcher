import type { ParsedWorldInfo, WorldInfoData, WorldParsedMission } from '$types/game/stw/worldInfo';
import {
  WorldColors,
  WorldColorsByTheater,
  WorldLetters,
  WorldLettersByTheaters,
  WorldModifiers,
  WorldPowerLevels,
  Theaters,
  WorldStormKingZones,
  ZoneCategories,
  GroupZones
} from '$lib/constants/stw/worldInfo';
import type { ParsedModifierData, ParsedResourceData, RarityType } from '$types/game/stw/resources';
import { ingredients, RarityNames, RarityTypes, resources, survivors, survivorsMythicLeads, traps } from '$lib/constants/stw/resources';
import { baseGameService } from '$lib/core/services';
import Authentication from '$lib/core/authentication';
import { get } from 'svelte/store';

type World = keyof typeof Theaters;

export default class WorldInfoManager {
  static async getWorldInfoData(accessToken?: string) {
    const token = accessToken || (await Authentication.getAccessTokenUsingClientCredentials()).access_token;

    return baseGameService.get<WorldInfoData>('world/info', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }).json();
  }

  static parseWorldInfo(worldInfoData: WorldInfoData) {
    const rawWorldInfo: Record<string, {
      alerts: Record<string, WorldInfoData['missionAlerts'][number]['availableMissionAlerts']>
      missions: Record<string, WorldInfoData['missions'][number]['availableMissions']>
      zones: Record<string, Array<number>>
    }> = {};

    const validWorlds = [
      Theaters.Stonewood,
      Theaters.Plankerton,
      Theaters.CannyValley,
      Theaters.TwinePeaks
    ] as string[];

    const worldInfo = new Map<World, Map<string, WorldParsedMission>>();

    function theaterExists(theaterId: string) {
      return !!rawWorldInfo[theaterId];
    }

    for (const theater of worldInfoData.theaters) {
      const isValidWorld = validWorlds.includes(theater.uniqueId) || theater.missionRewardNamedWeightsRowName === 'Theater.Phoenix';
      if (!isValidWorld) continue;

      for (const region of theater.regions) {
        const isValidRegion = !['mission', 'outpost'].includes(region.uniqueId.toLowerCase());
        if (!isValidRegion) continue;

        if (!rawWorldInfo[theater.uniqueId]) {
          worldInfo.set(theater.uniqueId as World, new Map());
          rawWorldInfo[theater.uniqueId] = {
            alerts: {},
            missions: {},
            zones: {}
          };
        }

        const rawZone = region.missionData?.difficultyWeights?.[0]?.difficultyInfo?.rowName?.trim();
        if (!rawZone) continue;

        const zone = rawZone
          .replace('Theater_', '')
          .replace('_Group', '');

        const newZone =
          zone === WorldStormKingZones.CannyValley
            ? 'Hard_Zone5'
            : zone === WorldStormKingZones.TwinePeaks
              ? 'Endgame_Zone5'
              : zone;

        if (!rawWorldInfo[theater.uniqueId].zones[newZone]) {
          rawWorldInfo[theater.uniqueId].alerts[newZone] = [];
          rawWorldInfo[theater.uniqueId].missions[newZone] = [];
          rawWorldInfo[theater.uniqueId].zones[newZone] = [];
        }

        rawWorldInfo[theater.uniqueId].zones[newZone] = [
          ...new Set([
            ...rawWorldInfo[theater.uniqueId].zones[newZone],
            ...region.tileIndices
          ])
        ];
      }
    }

    for (const mission of worldInfoData.missions) {
      if (!theaterExists(mission.theaterId) || !mission.availableMissions?.length) continue;

      for (const currentMission of mission.availableMissions) {
        for (const [zone, tileIndices] of Object.entries(rawWorldInfo[mission.theaterId].zones)) {
          if (tileIndices.includes(currentMission.tileIndex)) {
            rawWorldInfo[mission.theaterId].missions[zone].push(currentMission);
          }
        }
      }
    }

    for (const missionAlert of worldInfoData.missionAlerts) {
      if (!theaterExists(missionAlert.theaterId) || !missionAlert.availableMissionAlerts?.length) continue;

      for (const currentMissionAlert of missionAlert.availableMissionAlerts) {
        for (const [zone, tileIndices] of Object.entries(rawWorldInfo[missionAlert.theaterId].zones)) {
          if (tileIndices.includes(currentMissionAlert.tileIndex)) {
            rawWorldInfo[missionAlert.theaterId].alerts[zone].push(currentMissionAlert);
          }
        }
      }
    }

    for (const [theaterId, data] of Object.entries(rawWorldInfo)) {
      for (const [zone, missions] of Object.entries(data.missions)) {
        const theater = worldInfo.get(theaterId as World);
        if (!theater) continue;

        for (const mission of missions) {
          const zoneInfo = WorldInfoManager.parseZone(mission.missionGenerator);
          const currentAlert = rawWorldInfo[theaterId].alerts[zone].find((alert) => mission.tileIndex === alert.tileIndex);

          const zoneLetter = (WorldLettersByTheaters as any)[theaterId] || WorldLetters.Ventures;
          const modifiers = currentAlert?.missionAlertModifiers?.items.map((modifier) => WorldInfoManager.parseModifier(modifier.itemType)) || null;
          const powerLevel = (WorldPowerLevels as any)[theaterId]?.[zone] ?? (WorldPowerLevels.ventures as any)?.[zone] ?? -1;

          const filters: string[] = [];

          const alertRewards = currentAlert?.missionAlertRewards.items
            .reduce<typeof currentAlert.missionAlertRewards.items>((acc, crr) => {
              const itemIndex = acc.findIndex((item) => item.itemType === crr.itemType);

              if (itemIndex >= 0) {
                acc[itemIndex].quantity += crr.quantity;
              } else {
                acc.push(crr);
              }

              return acc;
            }, [])
            .map((item) => {
              const parsedResource = WorldInfoManager.parseResource(item.itemType, item.quantity);

              filters.push(item.itemType);

              if (item.attributes?.Alteration?.LootTierGroup) {
                filters.push(item.attributes?.Alteration?.LootTierGroup);
              }

              return {
                imageUrl: parsedResource.imageUrl,
                itemId: item.itemType,
                quantity: item.quantity ?? 1,
                rarity: parsedResource.rarity,
                type: parsedResource.type
              } satisfies NonNullable<WorldParsedMission['alert']>['rewards'][number];
            });

          const missionRewards = mission.missionRewards.items
            .reduce<typeof mission.missionRewards.items>((acc, crr) => {
              const itemIndex = acc.findIndex((item) => item.itemType === crr.itemType);

              if (itemIndex >= 0) {
                acc[itemIndex].quantity += crr.quantity;
              } else {
                acc.push(crr);
              }

              return acc;
            }, [])
            .map((item) => {
              const parsedResource = WorldInfoManager.parseResource(item.itemType, item.quantity);

              let isHard = false;

              filters.push(item.itemType);

              if (
                WorldInfoManager.isEvolutionMaterial(parsedResource.itemType) &&
                WorldPowerLevels[Theaters.TwinePeaks].Endgame_Zone6 === powerLevel
              ) {
                isHard = !(
                  parsedResource.itemType.endsWith('_veryhigh') ||
                  parsedResource.itemType.endsWith('_extreme')
                );
              }

              return {
                isHard,
                imageUrl: parsedResource.imageUrl,
                itemId: item.itemType,
                key: parsedResource.key,
                quantity: item.quantity ?? 1
              } satisfies WorldParsedMission['rewards'][number];
            });

          theater.set(mission.missionGuid, {
            filters,
            guid: mission.missionGuid,
            generator: mission.missionGenerator,
            tileIndex: mission.tileIndex,
            modifiers,
            rewards: missionRewards,
            zone: {
              color: (WorldColorsByTheater as any)[theaterId] ?? WorldColors.Ventures,
              letter: zoneLetter,
              theme: worldInfoData.theaters.find(x => x.uniqueId === theaterId)!.tiles[mission.tileIndex].zoneTheme,
              type: {
                id: zoneInfo.type as keyof typeof ZoneCategories | undefined,
                imageUrl: zoneInfo.imageUrl
              }
            },
            powerLevel,
            alert: currentAlert && alertRewards?.length ? {
              guid: currentAlert.missionAlertGuid,
              rewards: alertRewards
            } : null
          });
        }

        worldInfo.set(
          theaterId as World,
          new Map(Array.from(theater.entries()).sort((entryA, entryB) => {
            const [, missionA] = entryA;
            const [, missionB] = entryB;

            const missionAGroup = missionA.generator.toLowerCase().includes('group') ? 1 : 0;
            const missionBGroup = missionB.generator.toLowerCase().includes('group') ? 1 : 0;

            const isGroup = missionBGroup - missionAGroup;

            const missionAAlert = !!missionA.alert ? 1 : 0;
            const missionBAlert = !!missionB.alert ? 1 : 0;
            const hasAlert = missionBAlert - missionAAlert;

            const missionAPowerLevel = missionA.powerLevel;
            const missionBPowerLevel = missionB.powerLevel;
            const comparePowerLevel = missionBPowerLevel - missionAPowerLevel;

            return comparePowerLevel || isGroup || hasAlert;
          }))
        );
      }
    }

    return worldInfo;
  }

  private static parseModifier(key: string) {
    const data: ParsedModifierData = {
      id: key,
      imageUrl: '/assets/world/question.png'
    };

    const newKey = key.replace('GameplayModifier:', '');
    if (Object.values(WorldModifiers).includes(newKey as any)) {
      data.imageUrl = `/assets/modifiers/${newKey}.png`;
    }

    return data;
  }

  private static parseZone(missionGenerator: string) {
    const category = Object.entries(ZoneCategories).find(([, patterns]) =>
      patterns.some((pattern) => missionGenerator.includes(pattern))
    );

    const key = category?.[0];
    const isGroup = missionGenerator.toLowerCase().includes('group');

    return {
      imageUrl:
        key ?
          isGroup && GroupZones.includes(key as keyof typeof ZoneCategories)
            ? `/assets/world/${key}-group.png`
            : `/assets/world/${key}.png`
          : '/assets/world/quest.png',
      type: key as keyof typeof ZoneCategories | null
    };
  }

  private static isEvolutionMaterial(key: string) {
    return (
      key.includes('reagent_c_t01') ||
      key.includes('reagent_c_t02') ||
      key.includes('reagent_c_t03') ||
      key.includes('reagent_c_t04')
    );
  }

  private static parseResource(key: string, quantity: number) {
    const newKey = key
      .replace(/_((very)?low|medium|(very)?high|extreme)$/gi, '')
      .replace('AccountResource:', '')
      .replace('CardPack:zcp_', '');

    const rarity = WorldInfoManager.parseRarity(newKey);
    const data: ParsedResourceData = {
      key,
      quantity,
      imageUrl: `/assets/rarities/${rarity.rarity}.png`,
      itemType: key,
      name: rarity.type,
      rarity: rarity.rarity,
      type: null
    };

    function getKey<T>(key: string, resource: Record<string, T>) {
      return Object.entries(resource).find(([id]) => key.includes(id));
    }

    const resource = getKey(newKey, resources);

    if (resource) {
      const [resourceId, resourceData] = resource;
      const isEventCurrency =
        (newKey !== 'eventcurrency_scaling' &&
          newKey !== 'eventcurrency_founders' &&
          newKey.startsWith('eventcurrency_')) ||
        newKey === 'campaign_event_currency';

      const unknownTickets = [
        'campaign_event_currency',
        'eventcurrency_spring',
        'eventcurrency_summer'
      ];

      const extension = unknownTickets.includes(resourceId) ? 'gif' : 'png';

      data.imageUrl = `${isEventCurrency ? '/assets/currency' : '/assets/resources'}/${resourceId}.${extension}`;
      data.name = resourceData.name;
      data.type = 'resource';

      return data;
    }

    const ingredient = getKey(newKey, ingredients);

    if (ingredient) {
      const [ingredientId, ingredientData] = ingredient;

      data.imageUrl = `/assets/ingredients/${ingredientId}.png`;
      data.name = ingredientData.name;
      data.type = 'ingredient';

      return data;
    }

    const survivor = getKey(newKey, survivors);
    const mythicSurvivor = getKey(newKey, survivorsMythicLeads);
    const isWorker = newKey.startsWith('Worker:');

    if (survivor || mythicSurvivor || isWorker) {
      if (mythicSurvivor) {
        const [survivorId] = mythicSurvivor;

        data.imageUrl = `/assets/survivors/unique-leads/${survivorId}.png`;
        data.name = `${get(RarityNames)[RarityTypes.Mythic]} Lead`;
      } else if (survivor) {
        const [survivorId, survivorData] = survivor;

        data.imageUrl = `/assets/survivors/${survivorId}.png`;
        data.name = survivorData.name || `${get(RarityNames)[rarity.rarity]} Survivor`;
      } else {
        data.imageUrl = `/assets/resources/voucher_generic_${newKey.includes('manager') ? 'manager' : 'worker'}_${rarity.rarity}.png`;
        data.name = `${get(RarityNames)[rarity.rarity]} Survivor`;
      }

      data.type = 'worker';

      return data;
    }

    const isHero = newKey.startsWith('Hero:');

    if (isHero) {
      data.imageUrl = `/assets/resources/voucher_generic_hero_${rarity.rarity}.png`;
      data.name = `${get(RarityNames)[rarity.rarity]} Hero`;
      data.type = 'hero';

      return data;
    }

    const isDefender = newKey.startsWith('Defender:');

    if (isDefender) {
      data.imageUrl = `/assets/resources/voucher_generic_defender_${rarity.rarity}.png`;
      data.name = `${get(RarityNames)[rarity.rarity]} Defender`;
      data.type = 'defender';

      return data;
    }

    const trap = getKey(newKey, traps);
    const isSchematic = newKey.startsWith('Schematic:');

    if (trap || isSchematic) {
      if (trap) {
        const [trapId, trapData] = trap;

        data.imageUrl = `/assets/traps/${trapId}.png`;
        data.name = `${get(RarityNames)[rarity.rarity]} ${trapData.name}`;
        data.type = 'trap';
      } else {
        data.imageUrl = `/assets/resources/voucher_generic_schematic_${rarity.rarity}.png`;
        data.name = `${get(RarityNames)[rarity.rarity]} Schematic`;
      }

      return data;
    }

    return data;
  }

  private static parseRarity(value: string) {
    const type = value.split(':')[0];
    const id = value.includes(':') ? value.split(':')[1] : value;
    const data = {
      type,
      name: get(RarityNames)[RarityTypes.Common],
      rarity: RarityTypes.Common as RarityType
    };

    for (const rarityType of Object.values(RarityTypes)) {
      if (id.includes(`_${rarityType}`)) {
        data.name = get(RarityNames)[rarityType];
        data.rarity = rarityType;
        break;
      }
    }

    return data;
  }
}
