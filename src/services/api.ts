import type { CarCatalogQuery, RunDetail } from "@/types/telemetry";

export async function fetchRunGroups() {
  return window.telemetryApp.getRunGroups();
}


export async function fetchRunDetail(runId: string) {
  return window.telemetryApp.getRunDetail(runId) as Promise<RunDetail | null>;
}

export async function queryCars(query: CarCatalogQuery) {
  return window.telemetryApp.queryCars(query);
}
