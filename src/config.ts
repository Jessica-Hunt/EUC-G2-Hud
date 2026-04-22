export const POLL_MS = 100;
export const INFO_REFRESH_MS = 2000;
export const PROBE_TIMEOUT = 1500;

export const CAPTURE_ID = 2;
export const CAPTURE_NAME = "capture";
export const CAPTURE_CONTENT = "\u200b";
export const CAPTURE_DOUBLE_CLICK_MS = 450;
export const TOGGLE_COOLDOWN_MS = 700;

export const SIMULATOR_URL = "simulator://euc-world";
export const SIMULATOR_GLASSES_BATTERY = 82;

export const FAST_READOUT_ID = 8;
export const FAST_READOUT_NAME = "mrgpwrtxt";
export const DIAL_HEARTBEAT_ID = 9;
export const DIAL_HEARTBEAT_NAME = "dialhb";

export const TILE_WIDTH = 192;
export const TILE_HEIGHT = 112;
export const HUD_WIDTH = 576;
export const HUD_HEIGHT = 288;
export const SPEED_DIAL_MAX = 80;
export const HEARTBEAT_MS = 400;

export const HUD_FG = "#fff";
export const DIM_DIAL_FG = "#1a1a1a";
export const DIM_DIAL_ACTIVE = "#3f3f3f";

export const BLANK_TEXT = "";
export const HIDDEN_TEXT = "\u200b";

export const IMAGE_TILES = [
  { id: 1, name: "hud-dial", x: 0, y: 0, role: "dynamic" },
] as const;

export type ImageTile = (typeof IMAGE_TILES)[number];
export type TileRole = ImageTile["role"];

export const FAST_TILE_ROLES: TileRole[] = ["dynamic"];

export const FAST_READOUT_CONTAINER = {
  id: FAST_READOUT_ID,
  name: FAST_READOUT_NAME,
  x: 0,
  y: 114,
  width: 224,
  height: 24,
} as const;

export const DIAL_HEARTBEAT_CONTAINER = {
  id: DIAL_HEARTBEAT_ID,
  name: DIAL_HEARTBEAT_NAME,
  x: 198,
  y: 8,
  width: 16,
  height: 16,
} as const;

export const COMPACT_FAST_READOUT_CONTAINER = {
  id: 3,
  name: "simfast",
  x: 0,
  y: 114,
  width: 224,
  height: 24,
} as const;

export const COMPACT_SLOW_TEXT_CONTAINERS = [
  { id: 4, name: "siminfo", x: 232, y: 12, width: 334, height: 192, role: "summary" },
] as const;

export const SLOW_TEXT_CONTAINERS = [
  { id: 3, name: "triptxt", x: 298, y: 14, width: 268, height: 32, role: "trip" },
  { id: 4, name: "odotxt", x: 298, y: 54, width: 268, height: 32, role: "odo" },
  { id: 5, name: "batttemp", x: 298, y: 94, width: 268, height: 32, role: "batteryTemp" },
  { id: 6, name: "electxt", x: 10, y: 166, width: 268, height: 36, role: "electrical" },
  { id: 7, name: "devbatt", x: 298, y: 166, width: 268, height: 36, role: "deviceBattery" },
] as const;

export type SlowTextContainer = (typeof SLOW_TEXT_CONTAINERS)[number];
export type CompactSlowTextContainer = (typeof COMPACT_SLOW_TEXT_CONTAINERS)[number];
export type HudLayoutMode = "full" | "compact";
