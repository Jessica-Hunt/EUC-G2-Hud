import { readNumber } from "@evenrealities/even_hub_sdk";
import { PROBE_TIMEOUT, SIMULATOR_URL } from "./config";
import { candidateUrls, clamp, isRecord, normalizeKey, parseLooseNumber, xhrGet } from "./utils";
const WRAPPER_KEYS = [
    "data",
    "values",
    "result",
    "payload",
    "response",
    "state",
    "wheel",
    "telemetry",
    "stats",
];
export function pickConnectedBatteryLevel(connectType, batteryLevel, previousLevel) {
    if (connectType !== "connected")
        return previousLevel;
    if (typeof batteryLevel !== "number" || !Number.isFinite(batteryLevel))
        return previousLevel;
    const rounded = clamp(Math.round(batteryLevel), 0, 100);
    if (rounded === 0)
        return previousLevel;
    return rounded;
}
function unwrapPayload(raw) {
    let current = isRecord(raw) ? raw : {};
    for (;;) {
        const wrapped = WRAPPER_KEYS
            .map((key) => current[key])
            .find(isRecord);
        if (wrapped) {
            current = wrapped;
            continue;
        }
        const objectValues = Object.values(current).filter(isRecord);
        if (objectValues.length === 1) {
            current = objectValues[0];
            continue;
        }
        return current;
    }
}
function readMetric(source, ...keys) {
    const queue = [source];
    const visited = new Set();
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || visited.has(current))
            continue;
        visited.add(current);
        const value = readNumber(current, ...keys);
        if (value !== undefined)
            return value;
        for (const nested of Object.values(current)) {
            if (isRecord(nested))
                queue.push(nested);
        }
    }
    return undefined;
}
function buildCodeMap(raw) {
    const source = isRecord(raw) ? raw : {};
    const entries = Array.isArray(source.values) ? source.values : [];
    const map = {};
    for (const item of entries) {
        if (!isRecord(item))
            continue;
        const value = item.v ?? item.value ?? item.s ?? item.n ?? item.val ?? item.data;
        for (const alias of [item.w, item.key, item.name, item.code, item.id, item.k]) {
            if (typeof alias !== "string")
                continue;
            map[normalizeKey(alias)] = value;
        }
    }
    return map;
}
function pickCodeValue(source, codeMap, ...codes) {
    for (const code of codes) {
        const direct = parseLooseNumber(codeMap[normalizeKey(code)]);
        if (direct !== undefined)
            return direct;
    }
    return readMetric(source, ...codes);
}
function pickFuzzyCodeValue(codeMap, ...needles) {
    const entries = Object.entries(codeMap);
    for (const group of needles) {
        const normalized = group.map(normalizeKey);
        for (const [key, value] of entries) {
            if (normalized.every((needle) => key.includes(needle))) {
                const parsed = parseLooseNumber(value);
                if (parsed !== undefined)
                    return parsed;
            }
        }
    }
    return undefined;
}
export async function findWorkingUrl() {
    const candidates = candidateUrls();
    window.__setStatus?.(`Probing ${candidates.length} URLs in parallel…`, "");
    console.log("[EUC] probing candidates:", candidates);
    return new Promise((resolve) => {
        let settled = false;
        let completed = 0;
        candidates.forEach((baseUrl) => {
            const url = `${baseUrl}/api/values`;
            const xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.timeout = PROBE_TIMEOUT;
            const done = (success) => {
                completed++;
                if (success && !settled) {
                    settled = true;
                    console.log("[EUC] found working URL:", baseUrl);
                    resolve(baseUrl);
                }
                else if (completed === candidates.length && !settled) {
                    console.warn("[EUC] all candidates failed");
                    resolve(null);
                }
            };
            xhr.onload = () => {
                console.log(`[EUC] probe ${url} -> HTTP ${xhr.status} body: ${xhr.responseText.slice(0, 60)}`);
                done(xhr.status >= 200 && xhr.status < 300);
            };
            xhr.onerror = () => {
                console.warn(`[EUC] probe ${url} -> onerror`);
                done(false);
            };
            xhr.ontimeout = () => {
                console.warn(`[EUC] probe ${url} -> timeout`);
                done(false);
            };
            xhr.send();
        });
    });
}
export function normalize(raw) {
    const source = isRecord(raw) ? raw : unwrapPayload(raw);
    const codeMap = buildCodeMap(raw);
    const speed = pickCodeValue(source, codeMap, "vsp", "speed", "speedKph", "speedKmh")
        ?? pickFuzzyCodeValue(codeMap, ["speed"], ["kph"], ["kmh"]);
    const battery = pickCodeValue(source, codeMap, "vbf", "vba", "vbm", "vbx", "battery", "batteryPercent");
    const phoneBattery = pickCodeValue(source, codeMap, "pba", "phoneBattery", "phone_battery", "phone battery", "mobileBattery", "mobile_battery", "mobile battery", "smartphoneBattery", "smartphone_battery", "hostBattery", "host_battery", "appBattery", "app_battery") ?? pickFuzzyCodeValue(codeMap, ["phone", "battery"], ["mobile", "battery"], ["smartphone", "battery"], ["host", "battery"], ["app", "battery"]);
    const safetyMargin = pickCodeValue(source, codeMap, "vsmg", "vsmn", "safetyMargin", "safety_margin", "margin") ?? pickFuzzyCodeValue(codeMap, ["safety", "margin"], ["margin", "percent"]);
    const temperature = pickCodeValue(source, codeMap, "vte", "vtn", "vtx", "temperature", "temp", "boardTemp");
    const voltage = pickCodeValue(source, codeMap, "vvo", "vvn", "vvx", "voltage", "packVoltage", "batteryVoltage");
    const current = pickCodeValue(source, codeMap, "vcu", "vcn", "vcx", "current", "amps", "batteryCurrent");
    const power = pickCodeValue(source, codeMap, "vpo", "vpn", "vpx", "power", "watts");
    const tripDistance = pickCodeValue(source, codeMap, "vdi", "vdv", "vdu", "trip_distance", "tripDistance", "trip");
    const totalDistance = pickCodeValue(source, codeMap, "vdt", "vdv", "vdu", "total_distance", "totalDistance", "odometer");
    const speedKph = speed ?? pickCodeValue(source, codeMap, "xhu");
    const batteryPercent = battery ?? pickCodeValue(source, codeMap, "gbe", "vbm");
    const boardTemp = temperature ?? pickCodeValue(source, codeMap, "xhu");
    return {
        speed,
        speedKph,
        battery,
        batteryPercent,
        phoneBattery,
        safetyMargin,
        temperature,
        boardTemp,
        voltage,
        current,
        power,
        trip_distance: tripDistance,
        total_distance: totalDistance,
    };
}
export async function fetchWheelData(baseUrl, sampleIndex = 0) {
    if (baseUrl === SIMULATOR_URL) {
        const t = sampleIndex / 10;
        const speed = clamp(24 + Math.sin(t * 0.7) * 10 + Math.sin(t * 1.9) * 4, 0, 55);
        const safetyMargin = clamp(100 - speed * 1.2 + Math.sin(t * 0.35) * 8, 12, 100);
        const voltage = 82.4 - speed * 0.05 + Math.sin(t * 0.18) * 0.4;
        const current = clamp(1.8 + speed * 0.18 + Math.sin(t * 1.6) * 1.2, 0, 28);
        const power = voltage * current;
        const battery = clamp(68 - t * 0.02, 52, 68);
        const phoneBattery = 46;
        const temperature = 31 + Math.sin(t * 0.25) * 4;
        const tripDistance = 12.4 + t * 0.025;
        const totalDistance = 1842 + tripDistance;
        const data = {
            speed,
            speedKph: speed,
            battery,
            batteryPercent: battery,
            phoneBattery,
            safetyMargin,
            temperature,
            boardTemp: temperature,
            voltage,
            current,
            power,
            trip_distance: tripDistance,
            total_distance: totalDistance,
        };
        window.__setRaw?.({
            simulator: true,
            values: [
                { w: "vsp", v: speed },
                { w: "vsmg", v: safetyMargin },
                { w: "vpo", v: power },
                { w: "vvo", v: voltage },
                { w: "vcu", v: current },
                { w: "vbf", v: battery },
                { w: "pba", v: phoneBattery },
                { w: "vte", v: temperature },
                { w: "vdi", v: tripDistance },
                { w: "vdt", v: totalDistance },
            ],
        });
        return { data, ok: true };
    }
    try {
        const text = await xhrGet(`${baseUrl}/api/values`);
        const json = JSON.parse(text);
        window.__setRaw?.(json);
        return { data: normalize(json), ok: true };
    }
    catch (e) {
        return { data: {}, ok: false, error: String(e) };
    }
}
