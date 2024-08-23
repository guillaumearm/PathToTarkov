import type { Exit, ILocationBase } from "@spt/models/eft/common/ILocationBase";
import * as fs from "node:fs";
import * as path from "node:path";
import { CONFIGS_DIR, getUserConfig } from './config';
import type { UserConfig } from './config';

interface CustomExitConfig {
    Id: string;
    exits: { ExtractData: Exit }[];
}

const getCustomExtractsDir = (
    userConfig: UserConfig,
): string | undefined => {
    try {
        return path.join(CONFIGS_DIR, userConfig.selectedConfig, 'customExtracts');
    } catch (_err) {
        return undefined;
    }
};

export class CustomExtracts {

    public customExtractsList: { [locationId: string]: Exit[] } = {}; // Store custom extracts
    public userConfig = getUserConfig();

    public initCustomExtracts(locationBase: ILocationBase): Exit[] {
        // Load custom extracts if not already loaded
        if (!this.customExtractsList[locationBase.Id]) {
            this.loadCustomExtractsForLocation(locationBase.Id);
        }
        const allCustomExtracts = this.customExtractsList[locationBase.Id] ?? [];
        const newExits = this.mergeCustomExtracts(locationBase.exits, allCustomExtracts);

        return newExits;
    }

    public loadAllCustomExtractConfigs(): CustomExitConfig[] {
        const configDirectory = getCustomExtractsDir(this.userConfig);
        
        // Guard clause to check if configDirectory is defined
        if (!configDirectory) {
            console.error('Custom extracts directory not found.');
            return [];
        }

        const configFiles = this.getJsonFiles(configDirectory);  // Assuming getJsonFiles returns an array of filenames
        const allConfigs = this.loadConfigs(configFiles, configDirectory);

        return allConfigs;
    }

    public loadCustomExtractsForLocation(locationId: string): void {
        const allConfigs = this.loadAllCustomExtractConfigs();

        // Convert locationId to lowercase for comparison
        const lowerCaseLocationId = locationId.toLowerCase();

        // Find and load custom extracts for the specific location (compare in lowercase)
        const locationConfig = allConfigs.find(config => config.Id.toLowerCase() === lowerCaseLocationId);

        if (!locationConfig) {
            console.error(`No custom extracts found for location ${locationId}`);
            return;
        }

        if (!Array.isArray(locationConfig.exits)) {
            console.error(`No exits array found for location ${locationId}`);
            return;
        }

        // Map the custom extracts to the location's customExtracts array, preserving the original case of locationId
        this.customExtractsList[locationId] = locationConfig.exits.map(exit => exit.ExtractData);
    }

    public mergeCustomExtracts(existingExits: Exit[], customExtracts: Exit[]): Exit[] {
        const existingExitNames = new Set(existingExits.map(exit => exit.Name));

        // Merge custom extracts
        const updatedExits = [...existingExits];

        for (const customExtract of customExtracts) {
            if (!existingExitNames.has(customExtract.Name)) {
                // Log the custom extract being added
                console.log(`Adding custom extract: ${customExtract.Name}`);
                updatedExits.push(customExtract);
            } else {
                // Log if the custom extract already exists and is being skipped
                console.log(`Custom extract '${customExtract.Name}' already exists, skipping.`);
            }
        }

        return updatedExits;
    }

    public getJsonFiles(directory: string): string[] {
        try {
            return fs.readdirSync(path.resolve(__dirname, directory))
                .filter(file => file.endsWith(".json"));
        } catch (err) {
            console.error(`Error reading directory ${directory}:`, err);
            return [];
        }
    }

    public loadConfigs(files: string[], directory: string): CustomExitConfig[] {
        const configs: CustomExitConfig[] = [];

        for (const file of files) {
            try {
                const filePath = path.resolve(__dirname, directory, file);
                const rawData = fs.readFileSync(filePath, "utf8");
                configs.push(...JSON.parse(rawData));
            } catch (err) {
                console.error(`Error reading file ${file}:`, err);
            }
        }

        return configs;
    }
}
