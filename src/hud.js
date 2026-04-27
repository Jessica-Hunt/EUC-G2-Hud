import { EventSourceType, ImageRawDataUpdate, OsEventTypeList, TextContainerUpgrade, readNumber, } from "@evenrealities/even_hub_sdk";
import { CAPTURE_ID, CAPTURE_NAME, DIM_DIAL_ACTIVE, DIM_DIAL_FG, FAST_TILE_ROLES, HIDDEN_TEXT, HUD_FG, IMAGE_TILES, SPEED_DIAL_MAX, TILE_HEIGHT, TILE_WIDTH, } from "./config";
import { currentDialHeartbeatContainer, currentFastReadoutContainer, currentSlowTextContainers } from "./layout";
import { clamp, fmt, fmtInt, getTime, isRecord, normalizeKey, shortStatus } from "./utils";
export function buildSlowTextState(d, aux) {
    const battery = d.battery ?? d.batteryPercent;
    const temp = d.temperature ?? d.boardTemp;
    const phoneBattery = d.phoneBattery ?? aux.phoneBattery;
    const glassesBattery = aux.glassesBattery;
    return {
        trip: `TRIP ${fmt(d.trip_distance, 2)} km`,
        odo: `ODO ${fmt(d.total_distance, 0)} km`,
        batteryTemp: `BAT ${fmtInt(battery)}%   TEMP ${fmtInt(temp)}C`,
        electrical: `VOLT ${fmt(d.voltage, 1)}V   CURR ${fmt(d.current, 1)}A`,
        deviceBattery: `PHONE ${fmtInt(phoneBattery)}%   GLASSES ${fmtInt(glassesBattery)}%`,
        summary: [
            `TRIP ${fmt(d.trip_distance, 2)} km`,
            `ODO ${fmt(d.total_distance, 0)} km`,
            `BAT ${fmtInt(battery)}%   TEMP ${fmtInt(temp)}C`,
            `VOLT ${fmt(d.voltage, 1)}V   CURR ${fmt(d.current, 1)}A`,
            `PHONE ${fmtInt(phoneBattery)}%   GLASSES ${fmtInt(glassesBattery)}%`,
        ].join("\n"),
    };
}
export function blankSlowTextState() {
    return {
        trip: HIDDEN_TEXT,
        odo: HIDDEN_TEXT,
        batteryTemp: HIDDEN_TEXT,
        electrical: HIDDEN_TEXT,
        deviceBattery: HIDDEN_TEXT,
        summary: HIDDEN_TEXT,
    };
}
function osEventTypeLabel(eventType) {
    switch (eventType) {
        case OsEventTypeList.CLICK_EVENT:
            return "CLICK_EVENT";
        case OsEventTypeList.SCROLL_TOP_EVENT:
            return "SCROLL_TOP_EVENT";
        case OsEventTypeList.SCROLL_BOTTOM_EVENT:
            return "SCROLL_BOTTOM_EVENT";
        case OsEventTypeList.DOUBLE_CLICK_EVENT:
            return "DOUBLE_CLICK_EVENT";
        case OsEventTypeList.FOREGROUND_ENTER_EVENT:
            return "FOREGROUND_ENTER_EVENT";
        case OsEventTypeList.FOREGROUND_EXIT_EVENT:
            return "FOREGROUND_EXIT_EVENT";
        case OsEventTypeList.ABNORMAL_EXIT_EVENT:
            return "ABNORMAL_EXIT_EVENT";
        case OsEventTypeList.SYSTEM_EXIT_EVENT:
            return "SYSTEM_EXIT_EVENT";
        case OsEventTypeList.IMU_DATA_REPORT:
            return "IMU_DATA_REPORT";
        default:
            return undefined;
    }
}
function eventSourceLabel(eventSource) {
    switch (eventSource) {
        case EventSourceType.TOUCH_EVENT_FROM_GLASSES_R:
            return "TOUCH_EVENT_FROM_GLASSES_R";
        case EventSourceType.TOUCH_EVENT_FROM_GLASSES_L:
            return "TOUCH_EVENT_FROM_GLASSES_L";
        case EventSourceType.TOUCH_EVENT_FROM_RING:
            return "TOUCH_EVENT_FROM_RING";
        default:
            return undefined;
    }
}
export function summarizeEvenHubEvent(event) {
    const summary = {
        at: new Date().toISOString(),
    };
    if (event.textEvent) {
        summary.kind = "textEvent";
        summary.containerID = event.textEvent.containerID;
        summary.containerName = event.textEvent.containerName;
        summary.eventType = osEventTypeLabel(event.textEvent.eventType) ?? event.textEvent.eventType;
    }
    else if (event.listEvent) {
        summary.kind = "listEvent";
        summary.containerID = event.listEvent.containerID;
        summary.containerName = event.listEvent.containerName;
        summary.eventType = osEventTypeLabel(event.listEvent.eventType) ?? event.listEvent.eventType;
        summary.currentSelectItemIndex = event.listEvent.currentSelectItemIndex;
        summary.currentSelectItemName = event.listEvent.currentSelectItemName;
    }
    else if (event.sysEvent) {
        summary.kind = "sysEvent";
        summary.eventType = osEventTypeLabel(event.sysEvent.eventType) ?? event.sysEvent.eventType;
        summary.eventSource = eventSourceLabel(event.sysEvent.eventSource) ?? event.sysEvent.eventSource;
    }
    else {
        summary.kind = "unknown";
    }
    if (event.jsonData) {
        summary.jsonData = event.jsonData;
    }
    return JSON.stringify(summary, null, 2);
}
function readEventSource(payload) {
    const numericEventSource = readNumber(payload, "eventSource", "EventSource");
    if (numericEventSource === EventSourceType.TOUCH_EVENT_FROM_GLASSES_R
        || numericEventSource === EventSourceType.TOUCH_EVENT_FROM_GLASSES_L
        || numericEventSource === EventSourceType.TOUCH_EVENT_FROM_RING) {
        return numericEventSource;
    }
    const rawEventSource = payload.eventSource ?? payload.EventSource;
    if (typeof rawEventSource !== "string")
        return undefined;
    switch (normalizeKey(rawEventSource)) {
        case "toucheventfromglassesr":
            return EventSourceType.TOUCH_EVENT_FROM_GLASSES_R;
        case "toucheventfromglassesl":
            return EventSourceType.TOUCH_EVENT_FROM_GLASSES_L;
        case "toucheventfromring":
            return EventSourceType.TOUCH_EVENT_FROM_RING;
        default:
            return undefined;
    }
}
function readOsEventType(payload) {
    const numericEventType = readNumber(payload, "eventType", "Event_Type");
    if (numericEventType === OsEventTypeList.CLICK_EVENT
        || numericEventType === OsEventTypeList.DOUBLE_CLICK_EVENT
        || numericEventType === OsEventTypeList.SCROLL_TOP_EVENT
        || numericEventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
        return numericEventType;
    }
    const rawEventType = payload.eventType ?? payload.Event_Type;
    if (typeof rawEventType === "string") {
        switch (normalizeKey(rawEventType)) {
            case "click":
            case "clickevent":
                return OsEventTypeList.CLICK_EVENT;
            case "doubleclick":
            case "doubleclickevent":
                return OsEventTypeList.DOUBLE_CLICK_EVENT;
            case "scrolltop":
            case "scrolltopevent":
                return OsEventTypeList.SCROLL_TOP_EVENT;
            case "scrollbottom":
            case "scrollbottomevent":
                return OsEventTypeList.SCROLL_BOTTOM_EVENT;
        }
    }
    const eventSource = readEventSource(payload);
    if (eventSource !== undefined) {
        return OsEventTypeList.CLICK_EVENT;
    }
    return undefined;
}
export function isSingleToggleEvent(eventType) {
    return (eventType === OsEventTypeList.CLICK_EVENT
        || eventType === OsEventTypeList.SCROLL_TOP_EVENT
        || eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT);
}
function readCaptureEventType(payload) {
    if (!isRecord(payload))
        return undefined;
    const containerID = readNumber(payload, "containerID", "Container_ID");
    const rawContainerName = payload.containerName ?? payload.Container_Name;
    const containerName = typeof rawContainerName === "string" ? rawContainerName : undefined;
    if (containerID === CAPTURE_ID || containerName === CAPTURE_NAME) {
        return readOsEventType(payload);
    }
    for (const key of ["textEvent", "listEvent", "jsonData", "data", "payload"]) {
        const nestedEventType = readCaptureEventType(payload[key]);
        if (nestedEventType !== undefined)
            return nestedEventType;
    }
    return undefined;
}
function readSystemToggleEventType(payload) {
    if (!isRecord(payload))
        return undefined;
    const eventType = readOsEventType(payload);
    if (eventType !== undefined)
        return eventType;
    for (const key of ["sysEvent", "jsonData", "data", "payload"]) {
        const nestedEventType = readSystemToggleEventType(payload[key]);
        if (nestedEventType !== undefined)
            return nestedEventType;
    }
    return undefined;
}
export function getCaptureEventType(event) {
    return (event.listEvent ? readOsEventType(event.listEvent) ?? OsEventTypeList.CLICK_EVENT : undefined)
        ?? (event.textEvent ? readOsEventType(event.textEvent) ?? OsEventTypeList.CLICK_EVENT : undefined)
        ?? readCaptureEventType(event.jsonData)
        ?? readSystemToggleEventType(event.sysEvent)
        ?? readSystemToggleEventType(event.jsonData);
}
export function buildFastReadoutState(d, status, state) {
    const safety = d.safetyMargin;
    const { voltage, current } = d;
    const power = d.power ?? (voltage && current ? voltage * current : undefined);
    const hasSeparateDialHeartbeat = currentDialHeartbeatContainer() !== null;
    const inlineHeartbeat = state.showHeartbeat && state.heartbeatOn ? " ." : "";
    return {
        readout: state.showHeartbeat
            ? `MRG ${fmtInt(safety)}%   PWR ${fmtInt(power)}W${inlineHeartbeat}`
            : shortStatus(status) || "WAITING",
        dialHeartbeat: hasSeparateDialHeartbeat && state.showHeartbeat && state.heartbeatOn
            ? "."
            : "",
    };
}
export async function pushFastReadoutState(bridge, state, signatureRef, force = false) {
    const fastReadoutContainer = currentFastReadoutContainer();
    const dialHeartbeatContainer = currentDialHeartbeatContainer();
    const signature = `${state.readout}|${state.dialHeartbeat}`;
    if (!force && signatureRef.current === signature)
        return;
    await bridge.textContainerUpgrade(new TextContainerUpgrade({
        containerID: fastReadoutContainer.id,
        containerName: fastReadoutContainer.name,
        content: state.readout,
        contentLength: state.readout.length,
        contentOffset: 0,
    }));
    if (dialHeartbeatContainer) {
        await bridge.textContainerUpgrade(new TextContainerUpgrade({
            containerID: dialHeartbeatContainer.id,
            containerName: dialHeartbeatContainer.name,
            content: state.dialHeartbeat,
            contentLength: state.dialHeartbeat.length,
            contentOffset: 0,
        }));
    }
    signatureRef.current = signature;
}
export async function pushSlowTextState(bridge, state, signatures, force = false) {
    for (const container of currentSlowTextContainers()) {
        const content = state[container.role];
        if (!force && signatures.get(container.id) === content)
            continue;
        await bridge.textContainerUpgrade(new TextContainerUpgrade({
            containerID: container.id,
            containerName: container.name,
            content,
            contentLength: content.length,
            contentOffset: 0,
        }));
        signatures.set(container.id, content);
    }
}
function makeCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx)
        throw new Error("Canvas 2D context unavailable");
    return ctx;
}
function decodeBase64Image(dataUrl) {
    const base64 = dataUrl.split(",")[1];
    if (!base64)
        throw new Error("Failed to encode HUD image");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++)
        bytes[i] = binary.charCodeAt(i);
    return bytes;
}
function encodeCanvas(canvas) {
    return decodeBase64Image(canvas.toDataURL("image/png"));
}
function initTileContext() {
    const ctx = makeCanvas(TILE_WIDTH, TILE_HEIGHT);
    ctx.clearRect(0, 0, TILE_WIDTH, TILE_HEIGHT);
    ctx.fillStyle = HUD_FG;
    ctx.strokeStyle = HUD_FG;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
}
function drawDynamicTile(d) {
    const ctx = initTileContext();
    const rawSpeed = d.speed ?? d.speedKph;
    const rawSafety = d.safetyMargin;
    const speed = rawSpeed == null ? 0 : Math.round(rawSpeed);
    const safety = rawSafety == null ? undefined : Math.round(clamp(rawSafety, 0, 100));
    const gaugeCenterX = 96;
    const gaugeCenterY = 58;
    const gaugeRadius = 42;
    const gaugeStart = Math.PI * 0.82;
    const gaugeEnd = Math.PI * 2.18;
    const speedRatio = speed == null ? 0 : clamp(speed, 0, SPEED_DIAL_MAX) / SPEED_DIAL_MAX;
    const valueAngle = gaugeStart + (gaugeEnd - gaugeStart) * speedRatio;
    const safetyRatio = safety == null ? 0 : clamp(safety, 0, 100) / 100;
    const safetyAngle = gaugeStart + (gaugeEnd - gaugeStart) * safetyRatio;
    ctx.save();
    ctx.strokeStyle = DIM_DIAL_FG;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(gaugeCenterX, gaugeCenterY, gaugeRadius, gaugeStart, gaugeEnd);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = DIM_DIAL_ACTIVE;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(gaugeCenterX, gaugeCenterY, gaugeRadius, gaugeStart, valueAngle);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(gaugeCenterX + Math.cos(valueAngle) * gaugeRadius, gaugeCenterY + Math.sin(valueAngle) * gaugeRadius, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (safety != null) {
        ctx.save();
        ctx.strokeStyle = HUD_FG;
        ctx.fillStyle = HUD_FG;
        ctx.lineWidth = 4;
        const marginOuter = gaugeRadius - 8;
        const marginInner = gaugeRadius - 22;
        const marginX = gaugeCenterX + Math.cos(safetyAngle) * marginOuter;
        const marginY = gaugeCenterY + Math.sin(safetyAngle) * marginOuter;
        const marginBaseX = gaugeCenterX + Math.cos(safetyAngle) * marginInner;
        const marginBaseY = gaugeCenterY + Math.sin(safetyAngle) * marginInner;
        ctx.beginPath();
        ctx.moveTo(marginBaseX, marginBaseY);
        ctx.lineTo(marginX, marginY);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(marginX, marginY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = HUD_FG;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 54px sans-serif";
    ctx.fillText(fmtInt(speed), gaugeCenterX, 54);
    ctx.font = "700 14px sans-serif";
    ctx.fillText("km/h", gaugeCenterX, 76);
    ctx.restore();
    return encodeCanvas(ctx.canvas);
}
function renderTile(role, d) {
    switch (role) {
        case "dynamic":
            return drawDynamicTile(d);
    }
}
const lastTileSignatures = new Map();
export function resetHudTileSignatures() {
    lastTileSignatures.clear();
}
function tileSignature(role, d) {
    const speed = d.speed ?? d.speedKph;
    const shownSpeed = speed == null ? 0 : Math.round(speed);
    const shownSafety = d.safetyMargin == null ? undefined : Math.round(clamp(d.safetyMargin, 0, 100));
    switch (role) {
        case "dynamic":
            return `${fmtInt(shownSpeed)}|${fmtInt(shownSafety)}`;
    }
}
async function pushHudTile(bridge, tile, d, force = false) {
    const signature = tileSignature(tile.role, d);
    if (!force && lastTileSignatures.get(tile.id) === signature)
        return;
    await bridge.updateImageRawData(new ImageRawDataUpdate({
        containerID: tile.id,
        containerName: tile.name,
        imageData: renderTile(tile.role, d),
    }));
    lastTileSignatures.set(tile.id, signature);
}
export async function pushHudTiles(bridge, d, roles, force = false) {
    const allowedRoles = roles ? new Set(roles) : null;
    for (const tile of IMAGE_TILES) {
        if (allowedRoles && !allowedRoles.has(tile.role))
            continue;
        await pushHudTile(bridge, tile, d, force);
    }
}
export { FAST_TILE_ROLES, getTime };
