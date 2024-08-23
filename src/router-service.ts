import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
// WTT imports
import type { InstanceManager } from "./instance-manager";
import { CustomExtracts } from "./custom-extracts";

export class RouterService 
{
    // eslint-disable-next-line @typescript-eslint/naming-convention
    private instanceManager: InstanceManager;
    private customExtracts: CustomExtracts = new CustomExtracts();

    public preSptLoad(instance: InstanceManager): void
    {
        this.instanceManager = instance;
        this.registerGetAllCustomExtractsRoute();
        this.instanceManager.logger.log(`[${this.instanceManager.modName}] WTTRouter: Initialized and registered routes.`, LogTextColor.GREEN);
    }

    private registerGetAllCustomExtractsRoute(): void 
    {
        this.instanceManager.staticRouter.registerStaticRouter(
            "CustomExtracts",
            [
                {
                    url: "/PathToTarkov/CustomExtracts",
                    action: async (url, info, sessionId) => 
                    {
                    // Call the method to load all custom extracts
                        const allCustomExtracts = this.customExtracts.loadAllCustomExtractConfigs();

                        if (!allCustomExtracts || allCustomExtracts.length === 0) 
                        {
                            this.instanceManager.logger.log(`[${this.instanceManager.modName}] No custom extracts found.`, LogTextColor.RED);
                            return JSON.stringify({ success: false, message: "No custom extracts found" });
                        }

                        // Send all custom extracts data to the client
                        this.instanceManager.logger.log(`[${this.instanceManager.modName}] All custom extracts sent.`, LogTextColor.GREEN);
                        return JSON.stringify({ success: true, data: allCustomExtracts });
                    }
                }
            ],
            ""
        );
    }

}
