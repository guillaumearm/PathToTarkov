import type { DatabaseServer } from '@spt/servers/DatabaseServer';
import type { ConfigServer } from '@spt/servers/ConfigServer';
import type { ConfigTypes } from '@spt/models/enums/ConfigTypes';
import { checkAccessVia } from './helpers';

export class FleaController{

	constructor(
		private readonly db: DatabaseServer,
		private readonly configServer: ConfigServer,
	) {};

	initFlea(config: Config): void {
	
		if (config.flea && config.flea.min_level)
		{
			const fleaConfig = this.db.getTables().globals.config.RagFair;
			fleaConfig.minUserLevel = config.flea.min_level;
		}
		
	};

	updateFlea(
		access_via: string | string[],
		offraidPosition: string,
	): void {

		const fleaConfig = this.db.getTables().globals.config.RagFair;		
		fleaConfig.enabled = checkAccessVia(access_via, offraidPosition);

	}

}