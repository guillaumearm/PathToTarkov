import type { RouteAction } from "@spt/di/Router";
import type {
  Exit,
  SpawnPointParam,
} from "@spt/models/eft/common/ILocationBase";
import type { IHideoutArea } from "@spt/models/eft/hideout/IHideoutArea";
import type { DatabaseServer } from "@spt/servers/DatabaseServer";
import type { StaticRouterModService } from "@spt/services/mod/staticRouter/StaticRouterModService";

import type { AccessVia, Config, MapName, SpawnPoint } from "./config";
import { JAEGER_INTRO_QUEST, MAPLIST } from "./config";
import type { ModLoader } from "./modLoader";
import type { IQuestStatus } from "@spt/models/eft/common/tables/IBotBase";

// not used in theory (this is here to make TypeScript happy)
const PVE_DEFAULT_PARAMS = {
  ChancePVE: 1,
  CountPVE: 1,
  ExfiltrationTimePVE: 10,
  MinTimePVE: 1,
  MaxTimePVE: 120,
  PlayersCountPVE: 1,
};

export function checkAccessVia(access_via: AccessVia, value: string): boolean {
  return (
    access_via === "*" || access_via[0] === "*" || access_via.includes(value)
  );
}

type PositionXYZ = {
  x: number;
  y: number;
  z: number;
};

const getPosition = (pos: SpawnPoint["Position"]): PositionXYZ => {
  // work with Lua-CustomSpawnPointPointMaker format
  if (Array.isArray(pos)) {
    return { x: pos[0], y: pos[1], z: pos[2] };
  }

  return pos;
};

export const createSpawnPoint = (
  pos: SpawnPoint["Position"],
  rot: number,
  entrypoints: string[],
  spawnId: string,
): SpawnPointParam => {
  return {
    Id: spawnId,
    Position: getPosition(pos),
    Rotation: rot || 0.0,
    Sides: ["All"],
    Categories: ["Player"],
    Infiltration: entrypoints[0] || "",
    DelayToCanSpawnSec: 3,
    ColliderParams: {
      _parent: "SpawnSphereParams",
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
    BotZoneName: "",
  };
};

export const createExitPoint =
  (entrypoints: string[]) =>
  (name: string): Exit => {
    return {
      Name: name,
      EntryPoints: entrypoints.join(","),
      EventAvailable: true,
      Chance: 100,
      Count: 0,
      Id: "",
      MinTime: 0,
      MaxTime: 0,
      ExfiltrationType: "Individual",
      PassageRequirement: "None",
      PlayersCount: 0,
      ExfiltrationTime: 10,
      RequirementTip: "",
      ...PVE_DEFAULT_PARAMS,
    };
  };

export type EntryPoints = Record<string, string[]>;

export const getEntryPointsForMaps = (db: DatabaseServer): EntryPoints => {
  const locations = db.getTables().locations;

  const result: EntryPoints = {};

  MAPLIST.forEach((mapName) => {
    result[mapName] = [];
    const location = locations?.[mapName as MapName];

    location?.base.exits.forEach((exitPayload) => {
      const entrypoints = exitPayload.EntryPoints.split(",")
        .map((x) => x.trim())
        .filter((x) => !!x);
      result[mapName] = [...result[mapName], ...entrypoints];
    });
  });

  return result;
};

export const changeRestrictionsInRaid = (
  config: Config,
  db: DatabaseServer,
): void => {
  const globals = db.getTables().globals;

  const restrictionsConfig = config.restrictions_in_raid || {};

  globals?.config.RestrictionsInRaid.forEach((payload) => {
    if (restrictionsConfig[payload.TemplateId]) {
      payload.Value = restrictionsConfig[payload.TemplateId].Value;
    }
  });
};

// more infos on areas here: https://hub.sp-tarkov.com/doc/entry/4-resources-hideout-areas-ids/
export const isIgnoredArea = (area: IHideoutArea, config: Config): boolean => {
  if (typeof area.type !== "number") {
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

type StaticRouteCallback = (
  url: string,
  info: any,
  sessionId: string,
  output: string,
) => void;

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

  const register = (name = "Trap-PathToTarkov-StaticRoutePeeking") => {
    staticRouter.registerStaticRouter(name, routeActions, "spt");
  };

  return {
    register,
    watchRoute,
  };
};

const QUEST_STATUS_SUCCESS = 4;

export const isJaegerIntroQuestCompleted = (
  quests: IQuestStatus[],
): boolean => {
  return Boolean(
    quests.find(
      (quest) =>
        quest.qid === JAEGER_INTRO_QUEST &&
        (quest.status === QUEST_STATUS_SUCCESS ||
          (quest as any).status === "Success"), // compatibility with aki 3.1.x
    ),
  );
};

const isModLoaded = (modLoader: ModLoader, modId: string): boolean => {
  const loadedModName = Object.keys(modLoader.imported).find(
    (modName) => modLoader.imported[modName].name === modId,
  );

  return Boolean(loadedModName);
};

const LUAS_CSP_MOD_ID = "CustomSpawnPoints";

export const isLuasCSPModLoaded = (modLoader: ModLoader): boolean => {
  return isModLoaded(modLoader, LUAS_CSP_MOD_ID);
};
