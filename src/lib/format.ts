import type { Advice, SessionSummary, TelemetryValue } from "@/types/telemetry";

export function formatSignedPercent(value: number) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}


export function formatGear(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "0";
  if (value === 0) return "R";
  if (value === 1) return "N";
  return String(value - 1);
}


export function drivetrainLabel(value: number | undefined) {
  if (value === 0) return "FWD";
  if (value === 1) return "RWD";
  if (value === 2) return "AWD";
  return "Unknown";
}


export function formatSessionLabel(session: SessionSummary) {
  const started = new Date(session.startedAt).toLocaleString();
  const packets = `${session.packetCount.toLocaleString()} packets`;
  const car = session.carPerformanceIndex ? ` PI ${session.carPerformanceIndex}` : "";
  return `${started} - ${packets}${car} - ${shortSessionId(session.id)}`;
}


export function shortSessionId(sessionId: string) {
  return sessionId.slice(0, 8);
}


export function tuningStatusLabel(advice: Advice[]) {
  if (advice.some((item) => item.level === "alert")) return "Needs setup change";
  if (advice.some((item) => item.level === "warn")) return "Watch balance";
  if (advice.some((item) => item.level === "note")) return "Minor notes";
  if (advice.some((item) => item.level === "ok")) return "Settled";
  return "Collecting data";
}


export function temperatureTone(value: number): "ok" | "warn" | "alert" {
  const magnitude = Math.abs(value);
  if (magnitude > 18) return "alert";
  if (magnitude > 10) return "warn";
  return "ok";
}


export function temperatureSplitLabel(value: number | undefined) {
  if (value === undefined) return "Even";
  if (value > 10) return "Front hot";
  if (value < -10) return "Rear hot";
  return "Even";
}


export function slipAmountTone(value: number | undefined): "default" | "ok" | "warn" | "alert" {
  if (value === undefined) return "default";
  if (value > 0.9) return "alert";
  if (value > 0.65) return "warn";
  return "ok";
}


export function compressionTone(value: number | undefined): "default" | "ok" | "warn" | "alert" {
  if (value === undefined) return "default";
  if (value > 0.96) return "alert";
  if (value > 0.9) return "warn";
  return "ok";
}


export function formatValue(value: number | string | null | undefined, options: { precision?: number; boolean?: boolean } = {}) {
  if (value === undefined || value === null) return "0";
  if (options.boolean) return Number(value) === 1 ? "true" : "false";
  if (typeof value === "string") return value;
  if (Number.isNaN(value)) return "0";
  return Number(value).toFixed(options.precision ?? 0);
}

