import type { SessionDetail } from "@/types/telemetry";

export async function fetchSessions() {
  return window.telemetryApp.getSessions();
}


export async function fetchSessionDetail(sessionId: string) {
  return window.telemetryApp.getSessionDetail(sessionId) as Promise<SessionDetail | null>;
}


export async function createNewSession() {
  return window.telemetryApp.createNewSession();
}
