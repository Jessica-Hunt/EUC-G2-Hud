import {
  CreateStartUpPageContainer,
  RebuildPageContainer,
  waitForEvenAppBridge,
  type EvenAppBridge,
} from "@evenrealities/even_hub_sdk";

import {
  CAPTURE_DOUBLE_CLICK_MS,
  FAST_TILE_ROLES,
  HEARTBEAT_MS,
  INFO_REFRESH_MS,
  POLL_MS,
  SIMULATOR_GLASSES_BATTERY,
  SIMULATOR_URL,
  TOGGLE_COOLDOWN_MS,
  type HudLayoutMode,
} from "./config";
import {
  blankSlowTextState,
  buildFastReadoutState,
  buildSlowTextState,
  getCaptureEventType,
  getTime,
  isSingleToggleEvent,
  pushFastReadoutState,
  pushHudTiles,
  pushSlowTextState,
  resetHudTileSignatures,
  summarizeEvenHubEvent,
} from "./hud";
import { buildHudPageDefinition, getHudLayoutMode, setHudLayoutMode } from "./layout";
import { fetchWheelData, findWorkingUrl, pickConnectedBatteryLevel } from "./telemetry";
import type { BrowserBatteryManager, HudAuxData, RenderState, WheelData } from "./types";
import { clamp } from "./utils";

export async function startPlugin(bridge: EvenAppBridge): Promise<void> {
  setHudLayoutMode("compact");
  const pageResult = await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer(buildHudPageDefinition())
  );

  if (pageResult !== 0) {
    window.__setStatus?.(`Page creation failed (code ${pageResult})`, "error");
    return;
  }

  resetHudTileSignatures();
  let renderState: RenderState = { heartbeatOn: false, showHeartbeat: false };
  let latestAuxData: HudAuxData = {};
  let criticalOnlyMode = false;
  let lastCaptureClickAt = 0;
  let lastToggleAt = 0;
  const lastFastReadoutSignature = { current: "" };
  const lastSlowTextSignatures = new Map<number, string>();
  const kickHudTask = (promise: Promise<unknown>, label: string) => {
    void promise.catch((error) => {
      console.warn(`[HUD] ${label} failed:`, error);
    });
  };
  const resetHudSignatures = () => {
    resetHudTileSignatures();
    lastSlowTextSignatures.clear();
    lastFastReadoutSignature.current = "";
  };
  window.__setCleanMode?.(criticalOnlyMode);
  window.__setEventDebug?.("Waiting for EvenHub events…");
  const primeHud = (status: string, state: RenderState) => {
    kickHudTask(
      pushHudTiles(bridge, {}, undefined, true),
      `${status} image push`
    );
    kickHudTask(
      pushFastReadoutState(
        bridge,
        buildFastReadoutState({}, status, state),
        lastFastReadoutSignature,
        true
      ),
      `${status} fast text push`
    );
    kickHudTask(
      pushSlowTextState(
        bridge,
        criticalOnlyMode ? blankSlowTextState() : buildSlowTextState({}, latestAuxData),
        lastSlowTextSignatures,
        true
      ),
      `${status} slow text push`
    );
  };
  const rebuildHudPage = async (): Promise<boolean> => {
    const rebuilt = await bridge.rebuildPageContainer(
      new RebuildPageContainer(buildHudPageDefinition())
    );
    if (!rebuilt) {
      return false;
    }
    resetHudSignatures();
    return true;
  };
  const forceHudLayout = async (mode: HudLayoutMode): Promise<boolean> => {
    const previousMode = getHudLayoutMode();
    setHudLayoutMode(mode);
    const rebuilt = await rebuildHudPage();
    if (rebuilt) return true;

    setHudLayoutMode(previousMode);
    console.warn(`[HUD] failed to rebuild layout ${mode}, restoring ${previousMode}`);
    return false;
  };
  const ensureHudLayout = async (mode: HudLayoutMode): Promise<boolean> => {
    if (getHudLayoutMode() === mode) return true;
    return forceHudLayout(mode);
  };
  const applyPreferredHudLayout = async (url: string, status: string, state: RenderState): Promise<string | null> => {
    if (url !== SIMULATOR_URL) {
      const switched = await ensureHudLayout("full");
      if (switched) primeHud(status, state);
      return status;
    }

    if (!await ensureHudLayout("compact")) {
      window.__setStatus?.("HUD rebuild failed", "error");
      return null;
    }

    primeHud(status, state);
    return status;
  };

  resetHudSignatures();
  primeHud("Searching for EUC World", renderState);

  let workingUrl = await findWorkingUrl();

  if (!workingUrl) {
    window.__setStatus?.(
      "No URL worked. Is EUC World web server on? Check port in Settings.",
      "error"
    );
    renderState = { heartbeatOn: false, showHeartbeat: false };
    resetHudSignatures();
    primeHud("EUC World not found", renderState);
  } else {
    await applyPreferredHudLayout(workingUrl, "Connected", renderState);
    window.__setWorkingUrl?.(workingUrl);
    window.__setStatus?.(`Connected: ${workingUrl}`, "connected");
  }

  let latestData: WheelData = {};
  let latestStatus = "Waiting for data";
  let fails = 0;
  let ticks = 0;
  let pollIntervalId: ReturnType<typeof setInterval> | null = null;
  let infoIntervalId: ReturnType<typeof setInterval> | null = null;
  let phoneBatteryManager: BrowserBatteryManager | null = null;
  let lastHeartbeatToggleAt = 0;
  let fetchInFlight = false;
  let imageQueueRunning = false;
  let textQueueRunning = false;
  let pendingFastRender = false;
  let pendingFastTextRender = false;
  let pendingTextRender = false;
  let pendingFastForce = false;
  let pendingFastTextForce = false;
  let pendingTextForce = false;

  const updatePhoneBatteryFromManager = () => {
    if (!phoneBatteryManager) return;
    latestAuxData = {
      ...latestAuxData,
      phoneBattery: Math.round(phoneBatteryManager.level * 100),
    };
    requestInfoRender(true);
  };

  async function refreshAuxData() {
    try {
      const device = await bridge.getDeviceInfo();
      const glassesBattery = pickConnectedBatteryLevel(
        device?.status?.connectType,
        device?.status?.batteryLevel,
        latestAuxData.glassesBattery
      );
      latestAuxData = {
        ...latestAuxData,
        ...(glassesBattery !== undefined ? { glassesBattery } : {}),
      };
    } catch (error) {
      console.warn("[HUD] glasses battery unavailable:", error);
    }

    if (navigator.getBattery && !phoneBatteryManager) {
      try {
        phoneBatteryManager = await navigator.getBattery();
        phoneBatteryManager.addEventListener("levelchange", updatePhoneBatteryFromManager);
        updatePhoneBatteryFromManager();
      } catch (error) {
        console.warn("[HUD] phone battery unavailable:", error);
      }
    }

    requestInfoRender(true);
  }

  bridge.onDeviceStatusChanged((deviceStatus) => {
    const glassesBattery = pickConnectedBatteryLevel(
      deviceStatus.connectType,
      deviceStatus.batteryLevel,
      latestAuxData.glassesBattery
    );
    if (glassesBattery === undefined) return;
    latestAuxData = {
      ...latestAuxData,
      glassesBattery,
    };
    requestInfoRender(true);
  });

  const toggleCriticalOnlyMode = () => {
    const now = Date.now();
    if (now - lastToggleAt < TOGGLE_COOLDOWN_MS) return;
    lastToggleAt = now;
    criticalOnlyMode = !criticalOnlyMode;
    window.__setCleanMode?.(criticalOnlyMode);
    window.__setEventDebug?.(
      JSON.stringify(
        {
          at: new Date().toISOString(),
          kind: "manualToggle",
          criticalOnlyMode,
        },
        null,
        2
      )
    );
    requestInfoRender(true);
  };

  window.__toggleCleanMode = toggleCriticalOnlyMode;

  bridge.onEvenHubEvent((event) => {
    window.__setEventDebug?.(summarizeEvenHubEvent(event));
    const eventType = getCaptureEventType(event);
    if (eventType === undefined) return;

    if (eventType === 3) {
      lastCaptureClickAt = 0;
      toggleCriticalOnlyMode();
      return;
    }

    if (!isSingleToggleEvent(eventType)) {
      lastCaptureClickAt = 0;
      return;
    }

    const now = Date.now();
    if (now - lastCaptureClickAt <= CAPTURE_DOUBLE_CLICK_MS) {
      lastCaptureClickAt = 0;
      toggleCriticalOnlyMode();
      return;
    }

    lastCaptureClickAt = now;
  });

  async function flushTextQueue() {
    if (textQueueRunning) return;
    textQueueRunning = true;

    try {
      while (pendingFastTextRender || pendingTextRender) {
        if (pendingFastTextRender) {
          const force = pendingFastTextForce;
          pendingFastTextRender = false;
          pendingFastTextForce = false;
          await pushFastReadoutState(
            bridge,
            buildFastReadoutState(latestData, latestStatus, renderState),
            lastFastReadoutSignature,
            force
          );
          continue;
        }

        if (pendingTextRender) {
          const force = pendingTextForce;
          pendingTextRender = false;
          pendingTextForce = false;
          await pushSlowTextState(
            bridge,
            criticalOnlyMode
              ? blankSlowTextState()
              : buildSlowTextState(latestData, latestAuxData),
            lastSlowTextSignatures,
            force
          );
        }
      }
    } finally {
      textQueueRunning = false;
      if (pendingFastTextRender || pendingTextRender) void flushTextQueue();
    }
  }

  async function flushRenderQueue() {
    if (imageQueueRunning) return;
    imageQueueRunning = true;

    try {
      while (pendingFastRender) {
        if (pendingFastRender) {
          const force = pendingFastForce;
          pendingFastRender = false;
          pendingFastForce = false;
          await pushHudTiles(bridge, latestData, FAST_TILE_ROLES, force);
        }
      }
    } finally {
      imageQueueRunning = false;
      if (pendingFastRender) void flushRenderQueue();
    }
  }

  function requestFastRender(force = false) {
    pendingFastRender = true;
    pendingFastForce = pendingFastForce || force;
    void flushRenderQueue();
  }

  function requestFastTextRender(force = false) {
    pendingFastTextRender = true;
    pendingFastTextForce = pendingFastTextForce || force;
    void flushTextQueue();
  }

  function requestInfoRender(force = false) {
    pendingTextRender = true;
    pendingTextForce = pendingTextForce || force;
    void flushTextQueue();
  }

  function stopLoops() {
    if (pollIntervalId) clearInterval(pollIntervalId);
    if (infoIntervalId) clearInterval(infoIntervalId);
    pollIntervalId = null;
    infoIntervalId = null;
    lastHeartbeatToggleAt = 0;
    fetchInFlight = false;
    pendingFastRender = false;
    pendingFastTextRender = false;
    pendingTextRender = false;
    pendingFastForce = false;
    pendingFastTextForce = false;
    pendingTextForce = false;
  }

  function startLoops() {
    pollIntervalId = setInterval(() => { void tick(); }, POLL_MS);
    infoIntervalId = setInterval(() => { requestInfoRender(); }, INFO_REFRESH_MS);
    void refreshAuxData();
    void tick();
    requestInfoRender(true);
  }

  async function tick() {
    if (fetchInFlight) return;
    fetchInFlight = true;

    try {
      ticks++;
      window.__setTickCount?.(ticks);

      const fetchResult = await fetchWheelData(workingUrl!, ticks);
      const { data, ok, error } = fetchResult;

      if (ok) {
        const wasLive = renderState.showHeartbeat;
        const prevShownSpeed = latestData.speed == null && latestData.speedKph == null
          ? undefined
          : Math.round(latestData.speed ?? latestData.speedKph ?? 0);
        const prevShownSafety = latestData.safetyMargin == null
          ? undefined
          : Math.round(clamp(latestData.safetyMargin, 0, 100));
        const nextShownSpeed = data.speed == null && data.speedKph == null
          ? undefined
          : Math.round(data.speed ?? data.speedKph ?? 0);
        const nextShownSafety = data.safetyMargin == null
          ? undefined
          : Math.round(clamp(data.safetyMargin, 0, 100));
        const now = Date.now();
        let heartbeatOn = renderState.heartbeatOn;
        if (now - lastHeartbeatToggleAt >= HEARTBEAT_MS) {
          heartbeatOn = !heartbeatOn;
          lastHeartbeatToggleAt = now;
        }
        fails = 0;
        latestData = data;
        if (workingUrl === SIMULATOR_URL && latestAuxData.glassesBattery == null) {
          latestAuxData = {
            ...latestAuxData,
            glassesBattery: SIMULATOR_GLASSES_BATTERY,
          };
        }
        latestStatus = `Live ${getTime()}`;
        renderState = {
          heartbeatOn,
          showHeartbeat: true,
        };
        window.__setStatus?.(`Live • ${getTime()} (tick ${ticks})`, "connected");
        if (!wasLive || prevShownSpeed !== nextShownSpeed || prevShownSafety !== nextShownSafety) {
          requestFastRender();
        }
        requestFastTextRender();
        if (!wasLive) requestInfoRender(true);
      } else {
        fails++;
        if (fails === 5) {
          window.__setStatus?.("Lost signal, re-probing...", "error");
          const found = await findWorkingUrl();
          if (found) {
            workingUrl = found;
            await applyPreferredHudLayout(workingUrl, "Connected", renderState);
            window.__setWorkingUrl?.(found);
            fails = 0;
          }
        }
        latestData = {};
        latestStatus = `No signal ${fails}s`;
        renderState = { heartbeatOn: false, showHeartbeat: false };
        lastHeartbeatToggleAt = 0;
        window.__setStatus?.(
          `Fetch failed (${fails}): ${error}`,
          "error"
        );
        requestFastRender(true);
        requestFastTextRender(true);
        requestInfoRender(true);
      }
    } catch (e) {
      console.error("[EUC] tick threw:", e);
      latestData = {};
      latestStatus = "Tick error";
      renderState = { heartbeatOn: false, showHeartbeat: false };
      lastHeartbeatToggleAt = 0;
      window.__setStatus?.(`Tick error: ${String(e)}`, "error");
      requestFastRender(true);
      requestFastTextRender(true);
      requestInfoRender(true);
    } finally {
      fetchInFlight = false;
    }
  }

  if (workingUrl) startLoops();

  window.__reconnect = async () => {
    stopLoops();
    resetHudSignatures();
    window.__setStatus?.("Reconnecting...", "");
    renderState = { heartbeatOn: false, showHeartbeat: false };
    if (!await forceHudLayout("compact")) {
      window.__setStatus?.("HUD rebuild failed", "error");
      return;
    }
    primeHud("Reconnecting", renderState);
    const found = await findWorkingUrl();
    if (found) {
      workingUrl = found;
      await applyPreferredHudLayout(workingUrl, "Connected", renderState);
      window.__setWorkingUrl?.(found);
      fails = 0;
      latestData = {};
      latestStatus = "Waiting for data";
      startLoops();
    }
  };

  window.__forceUrl = async (url: string) => {
    stopLoops();
    resetHudSignatures();
    workingUrl = url;
    fails = 0;
    latestData = {};
    latestStatus = "Waiting for data";
    renderState = { heartbeatOn: false, showHeartbeat: false };
    window.__setStatus?.(`Forced URL: ${url}`, "connected");
    window.__setWorkingUrl?.(url);
    const hudStatus = await applyPreferredHudLayout(
      url,
      url === SIMULATOR_URL ? "Simulator ready" : "Forced URL",
      renderState
    );
    if (!hudStatus) {
      return;
    }
    startLoops();
  };
}

export async function main() {
  window.__setStatus?.("Connecting to glasses...", "");
  let bridge: EvenAppBridge;
  try {
    bridge = await waitForEvenAppBridge();
  } catch (e) {
    window.__setStatus?.(`Bridge failed: ${String(e)}`, "error");
    return;
  }
  window.__setStatus?.("Glasses connected - searching EUC World...", "connected");
  await startPlugin(bridge);
}
