import { missions, theaters } from '$lib/constants/stw/resources';
import { language } from '$lib/core/data-storage';
import { t } from '$lib/utils/util';
import { derived } from 'svelte/store';

export const Theaters = Object.freeze({
  Stonewood: '33A2311D4AE64B361CCE27BC9F313C8B',
  Plankerton: 'D477605B4FA48648107B649CE97FCF27',
  CannyValley: 'E6ECBD064B153234656CB4BDE6743870',
  TwinePeaks: 'D9A801C5444D1C74D1B7DAB5C7C12C5B',

  Dungeons: '394D85EF40B2BF401E6F32B587D7672B',
  SurviveTheHorde: 'DB73FE4C445040F5886B5FB337BC8C83',

  BlastedBadlands: '25D86CC64F0F3EE1831CFD9B2DF6D68C',
  FlannelFalls: 'FF97186D4741CB5F2A980BB0164081D4',
  FrozenFjords: 'D61659064BED28BEA91FD2A343C126B7',
  Hexsylvania: 'DBB6E92A4EDE30B76C94C7BA3852C473',
  ScurvyShoals: '243870C643F8611F25D24287814E1DA4'
} as const);

export const TheaterNames = derived(language, ($language) => ({
  [Theaters.Stonewood]: theaters[Theaters.Stonewood].names[$language],
  [Theaters.Plankerton]: theaters[Theaters.Plankerton].names[$language],
  [Theaters.CannyValley]: theaters[Theaters.CannyValley].names[$language],
  [Theaters.TwinePeaks]: theaters[Theaters.TwinePeaks].names[$language],

  [Theaters.Dungeons]: theaters[Theaters.Dungeons].names[$language],
  [Theaters.SurviveTheHorde]: theaters[Theaters.SurviveTheHorde].names[$language],

  [Theaters.BlastedBadlands]: theaters[Theaters.BlastedBadlands].names[$language],
  [Theaters.FlannelFalls]: theaters[Theaters.FlannelFalls].names[$language],
  [Theaters.FrozenFjords]: theaters[Theaters.FrozenFjords].names[$language],
  [Theaters.Hexsylvania]: theaters[Theaters.Hexsylvania].names[$language],
  [Theaters.ScurvyShoals]: theaters[Theaters.ScurvyShoals].names[$language]
}));

export const WorldColors = Object.freeze({
  Stonewood: '#34D375',
  Plankerton: '#4DA2DD',
  CannyValley: '#DFA12A',
  TwinePeaks: '#9C72F7',
  Ventures: '#3CD8E3'
} as const);

export const WorldColorsByTheater = Object.freeze({
  [Theaters.Stonewood]: WorldColors.Stonewood,
  [Theaters.Plankerton]: WorldColors.Plankerton,
  [Theaters.CannyValley]: WorldColors.CannyValley,
  [Theaters.TwinePeaks]: WorldColors.TwinePeaks
} as const);

export const WorldLetters = Object.freeze({
  Stonewood: 'S',
  Plankerton: 'P',
  CannyValley: 'C',
  TwinePeaks: 'T',
  Ventures: 'V'
} as const);

export const WorldLettersByTheaters = Object.freeze({
  [Theaters.Stonewood]: WorldLetters.Stonewood,
  [Theaters.Plankerton]: WorldLetters.Plankerton,
  [Theaters.CannyValley]: WorldLetters.CannyValley,
  [Theaters.TwinePeaks]: WorldLetters.TwinePeaks
} as const);

export const WorldStormKingZones = Object.freeze({
  CannyValley: 'Hard_Zone5_Dudebro',
  TwinePeaks: 'Nightmare_Zone10_Dudebro'
} as const);

export const WorldPowerLevels = Object.freeze({
  [Theaters.Stonewood]: {
    Start_Zone1: 1,
    Start_Zone2: 3,
    Start_Zone3: 5,
    Start_Zone4: 9,
    Start_Zone5: 15,
    Normal_Zone1: 19
  },
  [Theaters.Plankerton]: {
    Normal_Zone1: 19,
    Normal_Zone2: 23,
    Normal_Zone3: 28,
    Normal_Zone4: 34,
    Normal_Zone5: 40,
    Hard_Zone1: 46
  },
  [Theaters.CannyValley]: {
    Hard_Zone1: 46,
    Hard_Zone2: 52,
    Hard_Zone3: 58,
    Hard_Zone4: 64,
    Hard_Zone5: 70
  },
  [Theaters.TwinePeaks]: {
    Nightmare_Zone1: 76,
    Nightmare_Zone2: 82,
    Nightmare_Zone3: 88,
    Nightmare_Zone4: 94,
    Nightmare_Zone5: 100,
    Endgame_Zone1: 108,
    Endgame_Zone2: 116,
    Endgame_Zone3: 124,
    Endgame_Zone4: 132,
    Endgame_Zone5: 140,
    Endgame_Zone6: 160
  },
  ventures: {
    Phoenix_Zone02: 3,
    Phoenix_Zone03: 5,
    Phoenix_Zone05: 15,
    Phoenix_Zone07: 23,
    Phoenix_Zone09: 34,
    Phoenix_Zone11: 46,
    Phoenix_Zone13: 58,
    Phoenix_Zone15: 70,
    Phoenix_Zone17: 82,
    Phoenix_Zone19: 94,
    Phoenix_Zone21: 108,
    Phoenix_Zone23: 124,
    Phoenix_Zone25: 140
  }
} as const);

export const ZoneCategories = Object.freeze({
  quest: [
    '1stTrapTheStorm',
    'BuildOff',
    'Day1_C',
    'Day18257',
    'DeployTheProbe',
    'DtM',
    'FightTheGunslinger',
    'HotelHuskEscape',
    'Kidnapped',
    'Landmark',
    'MerryHellMaze',
    'PlankHarbor3Gate',
    'PtS',
    'StabilizeTheRift',
    'StC',
    'StormQuest2018Landmark',
    'TestTheSuit',
    'VindermanMansion',
    'WatchTheSkies'
  ],
  atlas: ['1Gate', 'Cat1FtS', 'GateSingle'],
  'atlas-c2': ['2Gates'],
  'atlas-c3': ['3Gates'],
  'atlas-c4': ['4Gates'],
  dtb: ['DtB'],
  dte: ['DestroyTheEncampments', 'DtE'],
  eac: ['EliminateAndCollect'],
  ets: ['EtS_C', 'EtShelter', 'EvacuateTheSurvivors'],
  'mini-boss': ['DUDEBRO'],
  htm: ['HTM_C'],
  htr: ['HitTheRoad', 'Mayday'],
  ptp: ['ProtectThePresents'],
  radar: ['BuildtheRadarGrid'],
  refuel: ['RefuelTheBase'],
  rescue: ['EtSurvivors'],
  resupply: ['Resupply'],
  rocket: ['LtR'],
  rtd: ['RetrieveTheData', 'RtD'],
  rtl: ['LaunchTheBalloon', 'LtB', 'RideTheLightning', 'RtL'],
  rts: ['PowerTheStormShield', 'RtS'],
  stn: ['SurviveTheNight'], 'storm-shield': ['Outpost'],
  tts: ['TrapTheStorm']
} as const);

export const ZoneNames = derived([language, t], ([$language, $t]) => ({
  atlas: missions.fightTheStorm.names[$language],
  'atlas-c2': missions.fightCategory2Storm.names[$language],
  'atlas-c3': missions.fightCategory3Storm.names[$language],
  'atlas-c4': missions.fightCategory4Storm.names[$language],
  dtb: missions.deliverTheBomb.names[$language],
  dte: missions.destroyTheEncampments.names[$language],
  eac: missions.eliminateAndCollect.names[$language],
  ets: missions.evacuateTheShelter.names[$language],
  htm: missions.huntTheTitan.names[$language],
  htr: missions.hitTheRoad.names[$language],
  ptp: missions.protectThePresents.names[$language],
  radar: missions.buildTheRadarGrid.names[$language],
  refuel: missions.refuelTheHomebase.names[$language],
  rescue: missions.rescueTheSurvivors.names[$language],
  resupply: missions.resupply.names[$language],
  rocket: missions.launchTheRocket.names[$language],
  rtd: missions.retrieveTheData.names[$language],
  rtl: missions.rideTheLightning.names[$language],
  rts: missions.repairTheShelter.names[$language],
  stn: missions.surviveTheStorm.names[$language],
  'storm-shield': missions.homebaseStormShield.names[$language],
  tts: missions.trapTheStorm.names[$language],
  quest: $t('quest')
} as Record<string, string>));

export const GroupZones = Object.freeze([
  'atlas',
  'atlas-c2',
  'atlas-c3',
  'atlas-c4',
  'dtb',
  'ets',
  'rtd',
  'rtl',
  'rts'
] as Array<keyof typeof ZoneCategories>);

export const WorldModifiers = Object.freeze({
  FireStorm: 'elementalzonefireenableitem',
  NatureStorm: 'elementalzonenatureenableitem',
  IceStorm: 'elementalzonewaterenableitem',

  ExplodingDeathbomb: 'gm_basehusk_ondeath_explode',
  MetalCorrosion: 'gm_basehusk_ondmgdealt_metalcorrosion',
  UnchartedEnemies: 'gm_enemy_hideonminimap',
  FrenziedDeathburst: 'gm_enemy_ondeath_applyspeedmods',
  HealingDeathburst: 'gm_enemy_ondeath_areaheal',
  AcidPools: 'gm_enemy_ondeath_spawndamagepool',
  SmokeScreens: 'gm_enemy_ondeath_spawnenemyrangeresistpool',
  SlowingPools: 'gm_enemy_ondeath_spawnplayerslowpool',
  SlowingAttacks: 'gm_enemy_ondmgdealt_slowdownfoe',
  LifeLeechAttacks: 'gm_enemy_ondmgdealt_lifeleech',
  Quickened: 'gm_enemy_ondmgreceived_speedbuff',
  WallWeakening: 'gm_enemy_onhitweakenbuildings',
  EpicMiniBoss: 'minibossenableprimarymissionitem',

  BuildingConstructors: 'gm_constructor_buildcost_buff',
  AdeptConstructors: 'gm_constructor_damage_buff',
  FocusedNinjas: 'gm_ninja_abilityrate_buff',
  AdeptNinjas: 'gm_ninja_damage_buff',
  LeapingNinjas: 'gm_ninja_jumpheight_buff',
  SwordNinjas: 'gm_ninja_sword_damagebuff',
  AdeptOutlander: 'gm_outlander_damage_buff',
  UpgradedOutlanders: 'gm_outlander_tech_buff',
  WellDrilledSoldiers: 'gm_soldier_abilityrate_buff',
  HeadshotSoldiers: 'gm_soldier_assaultrifle_buff',
  AdepSoldier: 'gm_soldier_damage_buff',
  AdeptAbilities: 'gm_hero_tech_buff',
  PowerfulTraps: 'gm_trap_buff',

  PowerfulAssaultRiffles: 'gm_player_assaultrifle_damage_buff',
  PowerfulAxesAndScythes: 'gm_player_axesscythesdamage_buff',
  PowerfulClubsAndHardware: 'gm_player_bluntdamage_buff',
  PowerfulEnergyAttacks: 'gm_player_energy_damagebuff',
  PowerfulExplosives: 'gm_player_explosive_damagebuff',
  KnockbackMeleeAttacks: 'gm_player_meleeknockback_buff',
  MeleeLifeLeech: 'gm_player_ondmgdealt_lifeleech',
  ConcussiveShieldbreak: 'gm_player_onshielddestroyed_aoe',
  PowerfulPistols: 'gm_player_pistol_damagebuff',
  PowerfulShotguns: 'gm_player_shotgun_damagebuff',
  PowerfulSMGs: 'gm_player_smg_damage_buff',
  PowerfulSniperRifles: 'gm_player_sniperrifle_damagebuff',
  PowerfulSwordsAndSpears: 'gm_player_spearsworddamage_buff'
} as const);
