import { IMod } from "@spt-aki/models/external/mod";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { DependencyContainer } from "tsyringe";
import { getModDisplayName, PackageJson, readPackageJson } from "./utils";



class Mod implements IMod {
  private logger: ILogger;
  private packageJson: PackageJson;

  public load(container: DependencyContainer): void {
    this.logger = container.resolve<ILogger>("WinstonLogger");
    this.packageJson = readPackageJson();

    this.logger.info(`===> Loading ${getModDisplayName(this.packageJson, true)}`);
  }

  public delayedLoad(container: DependencyContainer): void {
    this.logger.success(`===> Successfully loaded ${getModDisplayName(this.packageJson, true)}`);
  }

}

module.exports = { mod: new Mod() }