export type ItemId =
  | 'solar'
  | 'battery'
  | 'reactor'
  | 'o2gen'
  | 'o2tank'
  | 'recycler'
  | 'watertank'
  | 'food'
  | 'greenhouse'
  | 'shield'
  | 'excavator'
  | 'shelter'
  | 'spare';

export type Cargo = Partial<Record<ItemId, number>>;

/** Systems the player can switch on/off (priority order after the base). */
export type SystemId = 'o2gen' | 'recycler' | 'greenhouse' | 'excavator';
export const SYSTEM_ORDER: SystemId[] = ['o2gen', 'recycler', 'greenhouse', 'excavator'];

export type EventId =
  | 'darkness'
  | 'storm'
  | 'recycler_break'
  | 'meteoroid'
  | 'dust'
  | 'leak'
  | 'mold'
  | 'rock'
  | 'home'
  | 'tired';

export type Protection = 'shelter' | 'hide' | 'none';
export type Status = 'running' | 'success' | 'evacuated';
export type EndReason = 'success' | 'oxygen' | 'medical' | 'radiation';

export interface ItemDef {
  id: ItemId;
  mass: number;
  max: number;
  power?: number;
  capacity?: number;
  oxygen?: number;
  water?: number;
  food?: number;
  powerUse?: number;
  waterUse?: number;
  recovery?: number;
  growDays?: number;
  shieldLevel?: number;
  daysPerLevel?: number;
}

export interface EventDef {
  id: EventId;
  kind: 'fixed' | 'random';
  requires: ItemId[];
  choices: string[];
  default: string;
  hands: boolean;
  fact: string;
}

export interface Params {
  missionDays: number;
  massBudget: number;
  secondsPerDay: number;
  stormCountdownSeconds: number;
  crewSize: number;
  startOxygen: number;
  startWater: number;
  startFood: number;
  startMorale: number;
  perCrewPerDay: { oxygen: number; food: number; water: number };
  baseLoad: number;
  sunZeroDays: number[];
  darknessEventDays: number[];
  dailyDoseMSv: number;
  doseLimitMSv: number;
  stormDoseMSv: number;
  shieldFactors: number[];
  maxShieldLevel: number;
  cosmicShieldEffectiveness: number;
  stormProtection: Record<Protection, number>;
  stormDayRange: [number, number];
  randomEventCount: [number, number];
  randomEventDayRange: [number, number];
  randomEventMinGap: number;
  health: { noFood: number; noWater: number; cold: number; recover: number; max: number };
  morale: { shortage: number; cold: number; calmDay: number; max: number };
  effects: {
    dustOutputFactor: number;
    meteoroidOutputFactor: number;
    rationDays: number;
    rationWaterFactor: number;
    rationMorale: number;
    leakOxygenPerDay: number;
    leakDays: number;
    patchMorale: number;
    moldFoodFactor: number;
    moldDays: number;
    airflowExtraPower: number;
    powerSaveBaseCut: number;
    powerSaveDays: number;
    powerSaveMoralePerDay: number;
    videoCallPower: number;
    videoCallMorale: number;
    restHealth: number;
    workMorale: number;
    cleanMorale: number;
    rockEvaDoseMSv: number;
    rockIgnoreMorale: number;
  };
  stars: {
    successBase: number;
    minHealth: number;
    maxDose: number;
    minMorale: number;
    lateEvacuationDay: number;
  };
}

export interface Config {
  params: Params;
  items: Record<ItemId, ItemDef>;
  events: Record<EventId, EventDef>;
}

export interface CrewMember {
  id: string;
  health: number;
}

export interface SystemState {
  present: boolean;
  on: boolean;
  broken: boolean;
  /** Was this system actually running in the last tick? */
  running: boolean;
}

export interface Effects {
  dust: boolean;
  meteoroid: boolean;
  rationDays: number;
  recyclerRepairIn: number;
  leakDays: number;
  moldCutDays: number;
  airflowDays: number;
  powerSaveDays: number;
  restDay: boolean;
  videoCall: boolean;
  stormProtection: Protection | null;
}

export interface Schedule {
  stormDay: number;
  /** day -> event id (at most one per day) */
  events: Record<number, EventId>;
}

export interface Decision {
  day: number;
  event: EventId;
  choice: string;
}

export type AlertCode =
  | 'shutdown'
  | 'battery_empty'
  | 'base_cold'
  | 'no_food'
  | 'no_water'
  | 'low_oxygen';

export interface Alert {
  day: number;
  code: AlertCode;
  system?: SystemId;
}

export interface DayLog {
  day: number;
  sun: number;
  produced: number;
  used: number;
  battery: number;
  oxygen: number;
  water: number;
  food: number;
  dose: number;
  health: number;
  morale: number;
  shieldLevel: number;
  shed: SystemId[];
  baseCold: boolean;
  foodShort: boolean;
  waterShort: boolean;
  o2genStarved: boolean;
  storm: boolean;
  alerts: AlertCode[];
}

export interface MissionState {
  seed: number;
  cargo: Cargo;
  day: number;
  status: Status;
  endReason: EndReason | null;
  endDay: number | null;
  battery: number;
  batteryCap: number;
  oxygen: number;
  water: number;
  food: number;
  spares: number;
  crew: CrewMember[];
  dose: number;
  shieldLevel: number;
  shieldProgress: number;
  morale: number;
  science: number;
  systems: Record<SystemId, SystemState>;
  greenhouseGrowth: number;
  effects: Effects;
  schedule: Schedule;
  pending: EventId | null;
  decisions: Decision[];
  alerts: Alert[];
  log: DayLog[];
}
