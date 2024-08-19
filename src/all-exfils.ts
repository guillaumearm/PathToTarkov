// TODO: auto-generate `ALL_DUMPED_EXFILS_FROM_SCRIPT`
// This is copy-pasted from the output (stderr) of the 'generate-all-exfils.js' script
const ALL_DUMPED_EXFILS_FROM_SCRIPT = {
  customs: [
    'Crossroads',
    "Smuggler's Boat",
    'RUAF Roadblock',
    'ZB-1012',
    'ZB-1011',
    'Trailer Park',
    'Old Gas Station',
    'Dorms V-Ex',
    'EXFIL_ZB013',
    'Railroad To Tarkov',
    'Railroad To Port',
    'Railroad To Military Base',
    'Trailer Park Workers Shack',
    'Sniper Roadblock',
    'Warehouse 17',
    'Factory Shacks',
    'Old Road Gate',
    'Warehouse 4',
    'Old Azs Gate',
    'Beyond Fuel Tank',
    'Shack',
    'Military Checkpoint',
    'Administration Gate',
    'Factory Far Corner',
  ],
  factory: ['Cellars', 'Gate 3', 'Gate 0', 'Gate m', 'Office Window', 'Camera Bunker Door'],
  interchange: [
    'NW Exfil',
    'SE Exfil',
    'PP Exfil',
    'Saferoom Exfil',
    'Hole Exfill',
    'Interchange Cooperation',
  ],
  woods: [
    'ZB-016',
    'Outskirts',
    'UN Roadblock',
    'RUAF Gate',
    'ZB-014',
    'South V-Ex',
    'Factory Gate',
    'un-sec',
    'East Gate',
    'Outskirts Water',
    'Mountain Stash',
    'West Border',
    'Old Station',
    'Scav House',
    'The Boat',
    "Dead Man's Place",
  ],
  shoreline: [
    'Tunnel',
    'Rock Passage',
    'Pier Boat',
    'CCP Temporary',
    'Road to Customs',
    'Lighthouse_pass',
    'Road_at_railbridge',
    'Shorl_V-Ex',
    'RedRebel_alp',
    'Smugglers_Trail_coop',
    'Adm Basement',
    'RWing Gym Entrance',
    'South Fence Passage',
    'Ruined House Fence',
    'Svetliy Dead End',
    'Wrecked Road',
    'Lighthouse',
  ],
  reserve: [
    'EXFIL_Train',
    'Alpinist',
    'EXFIL_ScavCooperation',
    'EXFIL_Bunker',
    'EXFIL_vent',
    'EXFIL_Bunker_D2',
    'Exit1',
    'Exit2',
    'Exit3',
    'Exit4',
  ],
  lighthouse: [
    'EXFIL_Train',
    'Alpinist_light',
    'tunnel_shared',
    'Nothern_Checkpoint',
    'Coastal_South_Road',
    'Shorl_free',
    ' V-Ex_light',
    'SCAV_Industrial_Zone',
    'Scav_Hideout_at_the_grotto',
    'SCAV_Underboat_Hideout',
    'Scav_Coastal_South',
  ],
  streets: [
    'E1',
    'E2',
    'E3',
    'E4',
    'E5',
    'E6',
    'E7_car',
    'E8_yard',
    'E9_sniper',
    'Exit_E10_coop',
    'E7',
    'E8',
    'scav_e1',
    'scav_e2',
    'scav_e3',
    'scav_e4',
    'scav_e5',
    'scav_e6',
    'scav_e7',
    'scav_e8',
  ],
  laboratory: [
    'lab_Parking_Gate',
    'lab_Hangar_Gate',
    'lab_Elevator_Med',
    'lab_Under_Storage_Collector',
    'lab_Elevator_Main',
    'lab_Vent',
    'lab_Elevator_Cargo',
  ],
  groundzero: [
    'Unity_free_exit',
    'Sandbox_VExit',
    'Sniper_exit',
    'Scav_coop_exit',
    'Nakatani_stairs_free_exit',
  ],
};

// APPLY ALIASES FOR MAP
const ALL_EXFILS: Record<string, string[]> = {
  ...ALL_DUMPED_EXFILS_FROM_SCRIPT,
  bigmap: ALL_DUMPED_EXFILS_FROM_SCRIPT.customs,
  rezervbase: ALL_DUMPED_EXFILS_FROM_SCRIPT.reserve,
  factory4_day: ALL_DUMPED_EXFILS_FROM_SCRIPT.factory,
  factory4_night: ALL_DUMPED_EXFILS_FROM_SCRIPT.factory,
  tarkovstreets: ALL_DUMPED_EXFILS_FROM_SCRIPT.streets,
  sandbox: ALL_DUMPED_EXFILS_FROM_SCRIPT.groundzero,
  sandbox_high: ALL_DUMPED_EXFILS_FROM_SCRIPT.groundzero,
};

export const isValidExfilForMap = (mapName: string, exfilName: string): boolean => {
  const exfils = ALL_EXFILS[mapName] ?? [];
  return exfils.includes(exfilName);
};