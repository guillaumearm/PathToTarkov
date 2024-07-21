import type { PreSptModLoader } from "@spt/loaders/PreSptModLoader";
import type { IPackageJsonData } from "@spt/models/spt/mod/IPackageJsonData";
import type { DependencyContainer } from "tsyringe";

export type ModLoader = PreSptModLoader & {
  imported: Record<string, IPackageJsonData>;
};

export function getModLoader(container: DependencyContainer): ModLoader {
  const modLoader = container.resolve<ModLoader>("PreSptModLoader");

  if (!modLoader.imported || typeof modLoader.imported !== "object") {
    throw new Error("Invalid ModLoader -> 'imported' object is missing");
  }

  return modLoader;
}
