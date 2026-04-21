import { PROBE_TIMEOUT } from "./config";

export function getPort(): string {
  return window.__eucPort ?? "8080";
}

export function candidateUrls(): string[] {
  const port = getPort();
  const pcIp = window.location.hostname;
  return [
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
    `http://10.0.2.2:${port}`,
    `http://${pcIp}:${port}`,
  ];
}

export function xhrGet(url: string, timeoutMs = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.timeout = timeoutMs;
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve(xhr.responseText)
        : reject(new Error(`HTTP ${xhr.status}`));
    xhr.onerror = () => reject(new Error("onerror"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.send();
  });
}

export function probeUrl(baseUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const url = `${baseUrl}/api/values`;
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.timeout = PROBE_TIMEOUT;
    xhr.onload = () => {
      console.log(`[EUC] probe ${url} -> HTTP ${xhr.status} body: ${xhr.responseText.slice(0, 60)}`);
      resolve(xhr.status >= 200 && xhr.status < 300);
    };
    xhr.onerror = () => {
      console.warn(`[EUC] probe ${url} -> onerror`);
      resolve(false);
    };
    xhr.ontimeout = () => {
      console.warn(`[EUC] probe ${url} -> timeout`);
      resolve(false);
    };
    xhr.send();
  });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function parseLooseNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const exact = Number(trimmed);
  if (Number.isFinite(exact)) return exact;

  const match = trimmed.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
  if (!match) return undefined;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function fmt(v: number | undefined, decimals = 1, fallback = "--"): string {
  if (v == null || isNaN(v)) return fallback;
  return v.toFixed(decimals);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function fmtInt(v: number | undefined, fallback = "--"): string {
  if (v == null || isNaN(v)) return fallback;
  return String(Math.round(v));
}

export function shortStatus(status: string): string {
  return status
    .replace(/^Live\s+/i, "")
    .replace(/\s+\(tick.*$/i, "")
    .slice(0, 24);
}

export function getTime(): string {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
