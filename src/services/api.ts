import type { RunDetail } from "@/types/telemetry";

export async function fetchSessions() {
  return window.telemetryApp.getSessions();
}


export async function fetchRunDetail(runId: string) {
  return window.telemetryApp.getRunDetail(runId) as Promise<RunDetail | null>;
}
