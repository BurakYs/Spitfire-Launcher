import type { ParsedWorldInfo, WorldInfoData, WorldInfoMission, WorldInfoMissionAlert, WorldInfoTheater, WorldParsedMission } from '$types/game/stw/world-info';
import {
  GroupZones,
  Theaters,
  WorldColors,
  WorldColorsByTheater,
  WorldLetters,
  WorldLettersByTheaters,
  WorldModifiers,
  WorldPowerLevels,
  WorldStormKingZones,
  ZoneCategories
} from '$lib/constants/stw/world-info';
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

  static parseWorldInfo(worldInfoData: WorldInfoData): ParsedWorldInfo {
    const validWorlds: string[] = [
      Theaters.Stonewood,
      Theaters.Plankerton,
      Theaters.CannyValley,
      Theaters.TwinePeaks
    ];

    const worldInfo = new Map<World, Map<string, WorldParsedMission>>();

    const theaterData = new Map<string, {
      missions: Map<number, string>;
      theater: WorldInfoTheater
    }>();

    for (const theater of worldInfoData.theaters) {
      const isValidWorld = validWorlds.includes(theater.uniqueId) || theater.missionRewardNamedWeightsRowName === 'Theater.Phoenix';
      if (!isValidWorld) continue;

      const missions = new Map<number, string>();

      for (const region of theater.regions) {
        const isValidRegion = !['mission', 'outpost'].includes(region.uniqueId.toLowerCase());
        if (!isValidRegion) continue;

        const rawZone = region.missionData?.difficultyWeights?.[0]?.difficultyInfo?.rowName?.trim();
        if (!rawZone) continue;

        const zone = rawZone.replace('Theater_', '').replace('_Group', '');
        const newZone = zone === WorldStormKingZones.CannyValley ? 'Hard_Zone5' : zone === WorldStormKingZones.TwinePeaks ? 'Endgame_Zone5' : zone;

        for (const tileIndex of region.tileIndices) {
          missions.set(tileIndex, newZone);
        }
      }

      theaterData.set(theater.uniqueId, {
        missions,
        theater
      });

      worldInfo.set(theater.uniqueId as World, new Map());
    }

    const missionByTheater = new Map<string, WorldInfoMission>();
    const alertByTheater = new Map<string, WorldInfoMissionAlert>();

    for (const mission of worldInfoData.missions) {
      if (mission.availableMissions?.length) {
        missionByTheater.set(mission.theaterId, mission);
      }
    }

    for (const alert of worldInfoData.missionAlerts) {
      if (alert.availableMissionAlerts?.length) {
        alertByTheater.set(alert.theaterId, alert);
      }
    }

    for (const [theaterId, data] of theaterData) {
      const theater = worldInfo.get(theaterId as World)!;
      const missions = missionByTheater.get(theaterId);
      const alerts = alertByTheater.get(theaterId);
      if (!missions) continue;

      const alertByTile = new Map<number, WorldInfoMissionAlert['availableMissionAlerts'][number]>();
      if (alerts) {
        for (const alert of alerts.availableMissionAlerts) {
          alertByTile.set(alert.tileIndex, alert);
        }
      }

      for (const mission of missions.availableMissions) {
        const zone = data.missions.get(mission.tileIndex);
        if (!zone) continue;

        const zoneInfo = WorldInfoManager.parseZone(mission.missionGenerator);
        const currentAlert = alertByTile.get(mission.tileIndex);

        const zoneLetter = (WorldLettersByTheaters as any)[theaterId] || WorldLetters.Ventures;
        const modifiers = currentAlert?.missionAlertModifiers?.items.map((modifier) => WorldInfoManager.parseModifier(modifier.itemType)) || null;
        const powerLevel = (WorldPowerLevels as any)[theaterId]?.[zone] ?? (WorldPowerLevels.ventures as any)?.[zone] ?? -1;
        const filters: string[] = [];

        const alertRewards = currentAlert?.missionAlertRewards.items
          .reduce<typeof currentAlert.missionAlertRewards.items>((acc, crr) => {
            const item = acc.find((item) => item.itemType === crr.itemType);
            if (!item) {
              acc.push(crr);
            } else {
              item.quantity += crr.quantity;
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
            const item = acc.find((item) => item.itemType === crr.itemType);
            if (!item) {
              acc.push(crr);
            } else {
              item.quantity += crr.quantity;
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

      const parsedMissions = new Map(Array.from(theater.entries()).sort((entryA, entryB) => {
        const a = entryA[1];
        const b = entryB[1];

        const missionAGroup = a.generator.toLowerCase().includes('group') ? 1 : 0;
        const missionBGroup = b.generator.toLowerCase().includes('group') ? 1 : 0;

        const missionAAlert = a.alert ? 1 : 0;
        const missionBAlert = b.alert ? 1 : 0;

        return b.powerLevel - a.powerLevel
          || missionBGroup - missionAGroup
          || missionBAlert - missionAAlert;
      }));

      worldInfo.set(theaterId as World, parsedMissions);
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