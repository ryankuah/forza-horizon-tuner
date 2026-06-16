import type {
  CarCatalogQuery,
  RunSampleWindowQuery,
  RunSectionPageQuery,
  RunSectionSamplesQuery,
  RunsPageQuery
} from "@/types/telemetry";

export const queryKeys = {
  runs: {
    all: ["runs"] as const,
    pages: (limit = 50, version = 0) => [...queryKeys.runs.all, "pages", { limit, version }] as const,
    page: (query: RunsPageQuery = {}) => [...queryKeys.runs.all, "page", normalizeRunsPageQuery(query)] as const,
    path: (runId: string) => [...queryKeys.runs.all, "path", runId] as const,
    sampleWindow: (query: RunSampleWindowQuery) => [...queryKeys.runs.all, "sample-window", normalizeSampleWindowQuery(query)] as const,
    sectionPage: (query: RunSectionPageQuery) => [...queryKeys.runs.all, "section-page", normalizeSectionPageQuery(query)] as const,
    sectionSamples: (query: RunSectionSamplesQuery) => [...queryKeys.runs.all, "section-samples", normalizeSectionSamplesQuery(query)] as const
  },
  cars: {
    all: ["cars"] as const,
    catalog: (query: CarCatalogQuery = {}) => [...queryKeys.cars.all, "catalog", normalizeCarCatalogQuery(query)] as const
  }
};

export async function fetchRunsPage(query: RunsPageQuery = {}) {
  const normalized = normalizeRunsPageQuery(query);
  return window.telemetryApp.listRunsPage(normalized);
}

export async function fetchRunPath(runId: string) {
  return window.telemetryApp.getRunPath(runId);
}

export async function fetchRunSampleWindow(query: RunSampleWindowQuery) {
  const normalized = normalizeSampleWindowQuery(query);
  return window.telemetryApp.getRunSampleWindow(normalized);
}

export async function fetchRunSections(query: RunSectionPageQuery) {
  const normalized = normalizeSectionPageQuery(query);
  return window.telemetryApp.listRunSections(normalized);
}

export async function fetchRunSectionSamples(query: RunSectionSamplesQuery) {
  return window.telemetryApp.getRunSectionSamples(normalizeSectionSamplesQuery(query));
}

export async function queryCars(query: CarCatalogQuery) {
  return window.telemetryApp.queryCars(normalizeCarCatalogQuery(query));
}

export function normalizeRunsPageQuery(query: RunsPageQuery): Required<RunsPageQuery> {
  return {
    cursor: query.cursor ?? null,
    direction: query.direction ?? "next",
    limit: query.limit ?? 50
  };
}

export function normalizeSampleWindowQuery(query: RunSampleWindowQuery): Required<RunSampleWindowQuery> {
  return {
    runId: query.runId,
    start: Math.max(0, Math.round(query.start ?? 0)),
    limit: query.limit ?? 3000
  };
}

export function normalizeSectionPageQuery(query: RunSectionPageQuery): Required<RunSectionPageQuery> {
  return {
    runId: query.runId,
    type: query.type,
    page: Math.max(0, Math.round(query.page ?? 0)),
    limit: query.limit ?? 8
  };
}

export function normalizeSectionSamplesQuery(query: RunSectionSamplesQuery): RunSectionSamplesQuery {
  return {
    runId: query.runId,
    sectionId: query.sectionId
  };
}

export function normalizeCarCatalogQuery(query: CarCatalogQuery = {}): Required<CarCatalogQuery> {
  return {
    search: query.search ?? "",
    sortBy: query.sortBy ?? "make",
    sortDirection: query.sortDirection ?? "asc"
  };
}
