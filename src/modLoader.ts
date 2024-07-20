import { PreSptModLoader } from "@spt/loaders/PreSptModLoader";
import { IPackageJsonData } from "@spt/models/spt/mod/IPackageJsonData";
import { DependencyContainer } from "tsyringe";

export type ModLoader = PreSptModLoader & {
  imported: Record<string, IPackageJsonData>;
};

export function getModLoader(container: DependencyContainer): ModLoader {
  const modLoader = container.resolve<ModLoader>("PreAkiModLoader");

  if (!modLoader.imported || typeof modLoader.imported !== "object") {
    throw new Error("Invalid ModLoader -> 'imported' object is missing");
  }

  return modLoader;
}
