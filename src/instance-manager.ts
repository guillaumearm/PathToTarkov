import * as path from 'node:path';

import type { ILogger } from '@spt/models/spt/utils/ILogger';
import type { ProfileController } from '@spt/controllers/ProfileController';
import type { ProfileCallbacks } from '@spt/callbacks/ProfileCallbacks';
import type { EventOutputHolder } from '@spt/routers/EventOutputHolder';
import type { DatabaseServer } from '@spt/servers/DatabaseServer';
import type { IDatabaseTables } from '@spt/models/spt/server/IDatabaseTables';
import type { StaticRouterModService } from '@spt/services/mod/staticRouter/StaticRouterModService';
import type { DynamicRouterModService } from '@spt/services/mod/dynamicRouter/DynamicRouterModService';
import type { TraderAssortService } from '@spt/services/TraderAssortService';
import type { DependencyContainer } from 'tsyringe';
import type { CustomItemService } from '@spt/services/mod/CustomItemService';
import type { ImageRouter } from '@spt/routers/ImageRouter';
import type { PreSptModLoader } from '@spt/loaders/PreSptModLoader';
import type { ConfigServer } from '@spt/servers/ConfigServer';
import type { JsonUtil } from '@spt/utils/JsonUtil';
import type { ProfileHelper } from '@spt/helpers/ProfileHelper';
import type { RagfairPriceService } from '@spt/services/RagfairPriceService';
import type { ImporterUtil } from '@spt/utils/ImporterUtil';
import type { SaveServer } from '@spt/servers/SaveServer';
import type { ItemHelper } from '@spt/helpers/ItemHelper';
import { RouterService } from './router-service';
import type { TraderAssortHelper } from '@spt/helpers/TraderAssortHelper';
import type { RagfairOfferGenerator } from '@spt/generators/RagfairOfferGenerator';

export class InstanceManager {
  //#region Accessible in or after preSptLoad
  public modName: string;
  public debug: boolean;
  // Useful Paths
  public modPath: string = path.join(process.cwd(), '\\user\\mods\\PathToTarkov\\');
  public profilePath: string = path.join(process.cwd(), '\\user\\profiles');

  // Instances
  public container: DependencyContainer;
  public preSptModLoader: PreSptModLoader;
  public configServer: ConfigServer;
  public saveServer: SaveServer;
  public itemHelper: ItemHelper;
  public logger: ILogger;
  public staticRouter: StaticRouterModService;
  public dynamicRouter: DynamicRouterModService;
  public profileController: ProfileController;
  public profileCallbacks: ProfileCallbacks;
  //#endregion

  //#region Acceessible in or after postDBLoad
  public database: IDatabaseTables;
  public customItem: CustomItemService;
  public imageRouter: ImageRouter;
  public jsonUtil: JsonUtil;
  public profileHelper: ProfileHelper;
  public eventOutputHolder: EventOutputHolder;
  public ragfairPriceService: RagfairPriceService;
  public importerUtil: ImporterUtil;
  public traderAssortService: TraderAssortService;
  public traderAssortHelper: TraderAssortHelper;
  public ragfairOfferGenerator: RagfairOfferGenerator;
  private routerService: RouterService = new RouterService();
  //#endregion

  // Call at the start of the mods postDBLoad method
  public preSptLoad(container: DependencyContainer, mod: string): void {
    this.modName = mod;

    this.container = container;
    this.preSptModLoader = container.resolve<PreSptModLoader>('PreSptModLoader');
    this.imageRouter = container.resolve<ImageRouter>('ImageRouter');
    this.configServer = container.resolve<ConfigServer>('ConfigServer');
    this.saveServer = container.resolve<SaveServer>('SaveServer');
    this.itemHelper = container.resolve<ItemHelper>('ItemHelper');
    this.eventOutputHolder = container.resolve<EventOutputHolder>('EventOutputHolder');
    this.profileController = container.resolve<ProfileController>('ProfileController');
    this.profileCallbacks = container.resolve<ProfileCallbacks>('ProfileCallbacks');
    this.logger = container.resolve<ILogger>('WinstonLogger');
    this.staticRouter = container.resolve<StaticRouterModService>('StaticRouterModService');
    this.dynamicRouter = container.resolve<DynamicRouterModService>('DynamicRouterModService');
    this.traderAssortService = container.resolve<TraderAssortService>('TraderAssortService');
    this.traderAssortHelper = container.resolve<TraderAssortHelper>('TraderAssortHelper');
    this.ragfairOfferGenerator = container.resolve<RagfairOfferGenerator>('RagfairOfferGenerator');

    this.routerService.preSptLoad(this);
  }

  public postDBLoad(container: DependencyContainer): void {
    this.database = container.resolve<DatabaseServer>('DatabaseServer').getTables();
    this.customItem = container.resolve<CustomItemService>('CustomItemService');
    this.jsonUtil = container.resolve<JsonUtil>('JsonUtil');
    this.profileHelper = container.resolve<ProfileHelper>('ProfileHelper');
    this.ragfairPriceService = container.resolve<RagfairPriceService>('RagfairPriceService');
    this.importerUtil = container.resolve<ImporterUtil>('ImporterUtil');
  }
}
