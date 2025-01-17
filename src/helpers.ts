import type { RouteAction } from '@spt/di/Router';
import type { IExit, ISpawnPointParam } from '@spt/models/eft/common/ILocationBase';
import type { IHideoutArea } from '@spt/models/eft/hideout/IHideoutArea';
import type { DatabaseServer } from '@spt/servers/DatabaseServer';
import type { StaticRouterModService } from '@spt/services/mod/staticRouter/StaticRouterModService';

import type { AccessVia, Config, PositionXYZ, Profile, SpawnPoint, StashConfig } from './config';
import { EMPTY_STASH, SLOT_ID_HIDEOUT, SLOT_ID_LOCKED_STASH, VANILLA_STASH_IDS } from './config';
import type { IItem } from '@spt/models/eft/common/tables/IItem';
import type { AllLocalesInDb } from './services/LocaleResolver';

export const isWildcardAccessVia = (access_via: AccessVia): boolean =>
  access_via === '*' || access_via[0] === '*';

export function checkAccessVia(access_via: AccessVia, value: string): boolean {
  return isWildcardAccessVia(access_via) || access_via.includes(value);
}

const getPosition = (pos: SpawnPoint['Position']): PositionXYZ => {
  // work with Lua-CustomSpawnPointPointMaker format
  if (Array.isArray(pos)) {
    const [x, y, z] = pos;
    return { x, y, z };
  }

  return pos;
};

// Note: this value will be lower-cased by the client (especially in `EligibleEntryPoints` exfil client property)
export const PTT_INFILTRATION = 'ptt_infiltration';

export const isPlayerSpawnPoint = (spawnPoint: ISpawnPointParam): boolean => {
  return Boolean(spawnPoint.Categories.find(cat => cat === 'Player'));
};

export const rejectPlayerCategory = (spawn: ISpawnPointParam): ISpawnPointParam => {
  return {
    ...spawn,
    Categories: spawn.Categories.filter(cat => cat !== 'Player'),
  };
};

export const createSpawnPoint = (
  pos: SpawnPoint['Position'],
  rot: number,
  spawnId: string,
): ISpawnPointParam => {
  return {
    Id: spawnId,
    Position: getPosition(pos),
    Rotation: rot || 0.0,
    Sides: ['All'],
    Categories: ['Player'],
    Infiltration: PTT_INFILTRATION,
    DelayToCanSpawnSec: 3,
    ColliderParams: {
      _parent: 'SpawnSphereParams',
      _props: {
        Center: {
          x: 0,
          y: 0,
          z: 0,
        },
        Radius: 0.0,
      },
    },
    CorePointId: 0,
    BotZoneName: '',
  };
};

type ExitProps = {
  Id: string;
  PassageRequirement: string;
  ExfiltrationType: string;
  RequirementTip: string;
  Count: number;
  MaxTime: number;
  MinTime: number;
  PlayersCount: number;
  Chance: number;
  ExfiltrationTime: number;
};

// TODO: default_exfiltration_time_seconds field in config ?
const DEFAULT_EXFILTRATION_TIME_IN_SECONDS = 30;

const getDefaultExitProps = (): ExitProps => ({
  Id: '',
  PassageRequirement: 'None',
  ExfiltrationType: 'Individual',
  RequirementTip: '',
  Count: 0,
  MinTime: 0,
  MaxTime: 0,
  PlayersCount: 0,
  Chance: 100,
  ExfiltrationTime: DEFAULT_EXFILTRATION_TIME_IN_SECONDS,
});

const getExitProps = (originalExit: IExit | undefined): ExitProps => {
  const newExitProps = getDefaultExitProps();

  if (!originalExit) {
    return newExitProps;
  }

  if (originalExit.PassageRequirement === 'WorldEvent') {
    newExitProps.PassageRequirement = originalExit.PassageRequirement;
    newExitProps.ExfiltrationType = originalExit.ExfiltrationType;
    newExitProps.RequirementTip = originalExit.RequirementTip;
  } else if (originalExit.PassageRequirement === 'Train') {
    newExitProps.PassageRequirement = originalExit.PassageRequirement;
    newExitProps.ExfiltrationType = originalExit.ExfiltrationType;
    newExitProps.RequirementTip = originalExit.RequirementTip;
    newExitProps.Id = originalExit.Id;
    newExitProps.Count = originalExit.Count;
    newExitProps.MinTime = originalExit.MinTime;
    newExitProps.MaxTime = originalExit.MaxTime;
  }

  return newExitProps;
};

export const createExitPoint = (name: string, originalExit: IExit | undefined): IExit => {
  const {
    Id,
    Count,
    MinTime,
    MaxTime,
    ExfiltrationType,
    PassageRequirement,
    RequirementTip,
    PlayersCount,
    Chance,
    ExfiltrationTime,
  } = getExitProps(originalExit);

  return {
    Id,
    Name: name,
    EntryPoints: PTT_INFILTRATION,
    Chance,
    Count,
    MinTime,
    MaxTime,
    ExfiltrationTime,
    PlayersCount,
    ExfiltrationType,
    PassageRequirement,
    RequirementTip,
    EventAvailable: false,
    ChancePVE: Chance,
    CountPVE: Count,
    ExfiltrationTimePVE: ExfiltrationTime,
    MinTimePVE: MinTime,
    MaxTimePVE: MaxTime,
    PlayersCountPVE: PlayersCount,
  };
};

export type EntryPoints = Record<string, string[]>;

export const changeRestrictionsInRaid = (config: Config, db: DatabaseServer): void => {
  const globals = db.getTables().globals;

  const restrictionsConfig = config.restrictions_in_raid || {};

  globals?.config.RestrictionsInRaid.forEach(payload => {
    if (restrictionsConfig[payload.TemplateId]) {
      payload.MaxInRaid = restrictionsConfig[payload.TemplateId].Value;
      payload.MaxInLobby = Math.max(payload.MaxInRaid, payload.MaxInLobby);
    }
  });
};

export const disableRunThrough = (db: DatabaseServer): void => {
  const database = db.getTables();

  if (!database.globals) {
    throw new Error('Unable to retrive globals settings in db');
  }

  const runThroughDB = database.globals.config.exp.match_end;
  runThroughDB.survived_exp_requirement = 0;
  runThroughDB.survived_seconds_requirement = 0;
};

// more infos on areas here: https://hub.sp-tarkov.com/doc/entry/4-resources-hideout-areas-ids/
export const isIgnoredArea = (area: IHideoutArea): boolean => {
  if (typeof area.type !== 'number') {
    // invalid area
    return true;
  }

  if (area.type === 4) {
    // generator (prevent a crash at start)
    return true;
  } else if (area.type === 6) {
    // water collector (prevent infinite loading menu at start)
    return true;
  } else if (area.type === 10) {
    // workbench
    return true;
  } else if (area.type === 16) {
    // place of fame
    return true;
  } else if (area.type === 17) {
    // air filtering unit (prevent a crash at start)
    return true;
  } else if (area.type === 21) {
    // christmas tree
    return true;
  } else if (area.type === 27) {
    // circle of cultist
    return true;
  }

  return false;
};

type StaticRouteCallback = (url: string, info: any, sessionId: string, output: string) => void;

export type StaticRoutePeeker = {
  register: (name?: string) => void;
  watchRoute: (url: string, cb: StaticRouteCallback) => void;
};

export const createStaticRoutePeeker = (
  staticRouter: StaticRouterModService,
): StaticRoutePeeker => {
  const routeActions: RouteAction[] = [];

  const watchRoute = (url: string, cb: StaticRouteCallback): void => {
    routeActions.push({
      url,
      action: async (url, info, sessionId, output) => {
        cb(url, info, sessionId, output);
        return output;
      },
    });
  };

  const register = (name = 'Trap-PathToTarkov-StaticRoutePeeking') => {
    staticRouter.registerStaticRouter(name, routeActions, 'spt');
  };

  return {
    register,
    watchRoute,
  };
};

export const getMainStashId = (profile: Profile): string => {
  return profile.PathToTarkov?.mainStashId ?? profile.characters.pmc.Inventory.stash;
};

type IndexedStashByIds = Record<string, true | undefined>;

const getAllStashByIds = (
  profile: Profile,
  stashConfigs: Omit<StashConfig, 'access_via'>[],
): IndexedStashByIds => {
  const initialAcc: IndexedStashByIds = { [getMainStashId(profile)]: true };

  return stashConfigs.reduce((acc, stashConfig) => {
    return {
      ...acc,
      [stashConfig.mongoId]: true,
    };
  }, initialAcc);
};

export const setInventorySlotIds = (
  profile: Profile,
  stashId: string,
  stashConfigs: StashConfig[],
): void => {
  const inventory = profile.characters.pmc.Inventory;
  const secondaryStashes = [EMPTY_STASH, ...stashConfigs];
  const stashByIds = getAllStashByIds(profile, secondaryStashes);

  inventory.items.forEach(item => {
    if (item.slotId === SLOT_ID_HIDEOUT || item.slotId === SLOT_ID_LOCKED_STASH) {
      if (item.parentId === stashId) {
        item.slotId = SLOT_ID_HIDEOUT;
      } else if (stashByIds[item.parentId ?? '']) {
        item.slotId = SLOT_ID_LOCKED_STASH;
      }
    }
  });
};

const isStashLink = (item: IItem): boolean => {
  return (
    Boolean(item._id) &&
    Boolean(item._tpl) &&
    Object.keys(item).length === 2 &&
    VANILLA_STASH_IDS.includes(item._tpl)
  );
};

const isPTTMongoId = (id: string, stashes: StashConfig[]): boolean => {
  const foundId = stashes.find(stash => {
    return id === stash.mongoId || id === stash.mongoTemplateId || id === stash.mongoGridId;
  });

  return Boolean(foundId);
};

export const retrieveMainStashIdFromItems = (
  items: IItem[],
  stashes: StashConfig[],
): string | null => {
  for (const item of items) {
    if (isStashLink(item) && !isPTTMongoId(item._id, stashes)) {
      return item._id;
    }
  }

  return null;
};

export type LocalesMutationReport = {
  nbLocalesImpacted: number;
  nbTotalValuesUpdated: number;
};

export function mutateLocales(
  allLocales: AllLocalesInDb,
  partialLocales: Partial<AllLocalesInDb>,
): LocalesMutationReport {
  const report: LocalesMutationReport = {
    nbLocalesImpacted: 0,
    nbTotalValuesUpdated: 0,
  };

  void Object.keys(allLocales).forEach(localeName => {
    if (partialLocales[localeName]) {
      const values = allLocales[localeName];
      const newValues = partialLocales[localeName] ?? {};
      const nbNewValues = Object.keys(newValues).length;

      if (nbNewValues > 0) {
        void Object.assign(values, newValues); // mutation here
        report.nbLocalesImpacted += 1;
        report.nbTotalValuesUpdated += nbNewValues;
      }
    }
  });

  return report;
}
