import { ALL_DUMPED_EXFILS_FROM_SCRIPT } from './_generated/all-vanilla-exfils';

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
