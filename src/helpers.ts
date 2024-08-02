import type { RouteAction } from '@spt/di/Router';
import type { Exit, SpawnPointParam } from '@spt/models/eft/common/ILocationBase';
import type { IHideoutArea } from '@spt/models/eft/hideout/IHideoutArea';
import type { DatabaseServer } from '@spt/servers/DatabaseServer';
import type { StaticRouterModService } from '@spt/services/mod/staticRouter/StaticRouterModService';

import type { AccessVia, Config, MapName, PositionXYZ, Profile, SpawnPoint } from './config';
import { JAEGER_INTRO_QUEST, MAPLIST, STANDARD_STASH_ID } from './config';
import type { IQuestStatus } from '@spt/models/eft/common/tables/IBotBase';
import { isDigit, isLetter } from './utils';

export function checkAccessVia(access_via: AccessVia, value: string): boolean {
  return access_via === '*' || access_via[0] === '*' || access_via.includes(value);
}

const getPosition = (pos: SpawnPoint['Position']): PositionXYZ => {
  // work with Lua-CustomSpawnPointPointMaker format
  if (Array.isArray(pos)) {
    const [x, y, z] = pos;
    return { x, y, z };
  }

  return pos;
};

export const createSpawnPoint = (
  pos: SpawnPoint['Position'],
  rot: number,
  entrypoints: string[],
  spawnId: string,
): SpawnPointParam => {
  return {
    Id: spawnId,
    Position: getPosition(pos),
    Rotation: rot || 0.0,
    Sides: ['All'],
    Categories: ['Player'],
    Infiltration: entrypoints[0] || '',
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

export const createExitPoint =
  (entrypoints: string[]) =>
  (name: string): Exit => {
    const Chance = 100;
    const Count = 0;
    const ExfiltrationTime = 10;
    const MinTime = 0;
    const MaxTime = 0;
    const PlayersCount = 0;
    const ExfiltrationType = 'Individual';
    const PassageRequirement = 'None';
    const RequirementTip = '';

    return {
      Id: '',
      Name: name,
      EntryPoints: entrypoints.join(','),
      Chance,
      Count,
      MinTime,
      MaxTime,
      ExfiltrationTime,
      PlayersCount,
      ExfiltrationType,
      PassageRequirement,
      RequirementTip,
      EventAvailable: true,
      // the following properties are not used but needed to make TypeScript happy
      ChancePVE: Chance,
      CountPVE: Count,
      ExfiltrationTimePVE: ExfiltrationTime,
      MinTimePVE: MinTime,
      MaxTimePVE: MaxTime,
      PlayersCountPVE: PlayersCount,
    };
  };

export type EntryPoints = Record<string, string[]>;

export const getEntryPointsForMaps = (db: DatabaseServer): EntryPoints => {
  const locations = db.getTables().locations;

  const result: EntryPoints = {};

  MAPLIST.forEach(mapName => {
    result[mapName] = [];
    const location = locations?.[mapName as MapName];

    location?.base.exits.forEach(exitPayload => {
      const entrypoints = exitPayload.EntryPoints.split(',')
        .map(x => x.trim())
        .filter(x => !!x);
      result[mapName] = [...result[mapName], ...entrypoints];
    });
  });

  return result;
};

export const changeRestrictionsInRaid = (config: Config, db: DatabaseServer): void => {
  const globals = db.getTables().globals;

  const restrictionsConfig = config.restrictions_in_raid || {};

  globals?.config.RestrictionsInRaid.forEach(payload => {
    if (restrictionsConfig[payload.TemplateId]) {
      payload.Value = restrictionsConfig[payload.TemplateId].Value;
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
export const isIgnoredArea = (area: IHideoutArea, config: Config): boolean => {
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
  } else if (config.workbench_always_enabled && area.type === 10) {
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

const QUEST_STATUS_SUCCESS = 4;

export const isJaegerIntroQuestCompleted = (quests: IQuestStatus[]): boolean => {
  return Boolean(
    quests.find(
      quest =>
        quest.qid === JAEGER_INTRO_QUEST &&
        (quest.status === QUEST_STATUS_SUCCESS || (quest as any).status === 'Success'), // compatibility with aki 3.1.x
    ),
  );
};

export const getMainStashId = (profile: Profile): string => {
  return profile.PathToTarkov?.mainStashId ?? profile.characters.pmc.Inventory.stash;
};

// the length should be 24
const SPT_ID_LENGTH = STANDARD_STASH_ID.length;

export const isValidSptId = (id: string): boolean => {
  if (id.length !== SPT_ID_LENGTH) {
    return false;
  }

  for (const char of id) {
    const isValidChar = isLetter(char) || isDigit(char);

    if (!isValidChar) {
      return false;
    }
  }

  return true;
};
