/** HTTP paths for runtime-loaded game data (served from repo `data/`, not the release asset zip). */
export const ASSETS_BASE_URL = '/assets';

export const DATA_BASE_URL = '/data';

export const RuntimePaths = {
  assetsBase: ASSETS_BASE_URL,
  dataBase: DATA_BASE_URL,
  assetManifest: `${DATA_BASE_URL}/manifest.json`,
  weaponsManifest: `${DATA_BASE_URL}/weapons/manifest.json`,
  combatConfig: `${DATA_BASE_URL}/combat.json`,
  npcBehaviorConfig: `${DATA_BASE_URL}/npc-behavior.json`,
  renderConfig: `${DATA_BASE_URL}/render.json`,
  audioManifest: `${DATA_BASE_URL}/audio/manifest.json`,
  audioConfigBase: `${DATA_BASE_URL}/audio`,
} as const;
