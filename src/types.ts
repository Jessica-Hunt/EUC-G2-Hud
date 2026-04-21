export interface BrowserBatteryManager extends EventTarget {
  level: number;
}

declare global {
  interface Window {
    __eucPort?: string;
    __reconnect?: () => void;
    __forceUrl?: (url: string) => void;
    __toggleCleanMode?: () => void;
    __setCleanMode?: (enabled: boolean) => void;
    __setEventDebug?: (message: string) => void;
    __setStatus?: (msg: string, type?: "connected" | "error" | "") => void;
    __setRaw?: (data: object) => void;
    __setTickCount?: (n: number) => void;
    __setWorkingUrl?: (url: string) => void;
  }

  interface Navigator {
    getBattery?: () => Promise<BrowserBatteryManager>;
  }
}

export interface WheelData {
  speed?: number;
  battery?: number;
  phoneBattery?: number;
  safetyMargin?: number;
  temperature?: number;
  voltage?: number;
  current?: number;
  power?: number;
  trip_distance?: number;
  total_distance?: number;
  speedKph?: number;
  batteryPercent?: number;
  boardTemp?: number;
}

export interface ApiResponse {
  data?: WheelData;
  values?: unknown[];
  [key: string]: unknown;
}

export interface TelemetryEntry {
  w?: unknown;
  v?: unknown;
  s?: unknown;
  value?: unknown;
  key?: unknown;
  name?: unknown;
}

export interface RenderState {
  heartbeatOn: boolean;
  showHeartbeat: boolean;
}

export interface HudAuxData {
  glassesBattery?: number;
  phoneBattery?: number;
}

export interface FastReadoutState {
  readout: string;
  dialHeartbeat: string;
}

export interface SlowTextState {
  trip: string;
  odo: string;
  batteryTemp: string;
  electrical: string;
  deviceBattery: string;
  summary: string;
}
