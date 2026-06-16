import type {
  CarCatalogQuery,
  PathSample,
  RunSampleWindow,
  RunSampleWindowQuery,
  RunSectionPage,
  RunSectionPageQuery,
  RunSectionSamples,
  RunSectionSamplesQuery,
  RunsPage,
  RunsPageQuery,
  RunSummary
} from "@/types/telemetry";

type CacheEntry<T> = {
  value?: T;
  promise?: Promise<T>;
};

const runsPageCache = new Map<string, CacheEntry<RunsPage>>();
const runSummaryCache = new Map<string, CacheEntry<RunSummary | null>>();
const runPathCache = new Map<string, CacheEntry<PathSample[]>>();
const sampleWindowCache = new Map<string, CacheEntry<RunSampleWindow>>();
const sectionPageCache = new Map<string, CacheEntry<RunSectionPage>>();
const sectionSamplesCache = new Map<string, CacheEntry<RunSectionSamples | null>>();

export async function fetchRunsPage(query: RunsPageQuery = {}) {
  const normalized = normalizeRunsPageQuery(query);
  const page = await cached(runsPageCache, stableKey(normalized), () => window.telemetryApp.listRunsPage(normalized));
  prefetchRunsPage({ cursor: page.nextCursor, direction: "next", limit: normalized.limit });
  if (page.previousCursor) prefetchRunsPage({ cursor: page.previousCursor, direction: "previous", limit: normalized.limit });
  return page;
}

export function prefetchRunsPage(query: RunsPageQuery = {}) {
  const normalized = normalizeRunsPageQuery(query);
  void cached(runsPageCache, stableKey(normalized), () => window.telemetryApp.listRunsPage(normalized)).catch(() => undefined);
}

export async function fetchRunSummary(runId: string) {
  return cached(runSummaryCache, runId, () => window.telemetryApp.getRunSummary(runId));
}

export async function fetchRunPath(runId: string) {
  return cached(runPathCache, runId, () => window.telemetryApp.getRunPath(runId));
}

export async function fetchRunSampleWindow(query: RunSampleWindowQuery) {
  const normalized = normalizeSampleWindowQuery(query);
  const sampleWindow = await cached(sampleWindowCache, stableKey(normalized), () => window.telemetryApp.getRunSampleWindow(normalized));
  const limit = normalized.limit ?? 3000;
  prefetchRunSampleWindow({ runId: normalized.runId, start: Math.max(0, sampleWindow.start - limit), limit });
  if (sampleWindow.start + limit < sampleWindow.total) prefetchRunSampleWindow({ runId: normalized.runId, start: sampleWindow.start + limit, limit });
  return sampleWindow;
}

export function prefetchRunSampleWindow(query: RunSampleWindowQuery) {
  const normalized = normalizeSampleWindowQuery(query);
  void cached(sampleWindowCache, stableKey(normalized), () => window.telemetryApp.getRunSampleWindow(normalized)).catch(() => undefined);
}

export async function fetchRunSections(query: RunSectionPageQuery) {
  const normalized = normalizeSectionPageQuery(query);
  const page = await cached(sectionPageCache, stableKey(normalized), () => window.telemetryApp.listRunSections(normalized));
  if (page.page > 0) prefetchRunSections({ ...normalized, page: page.page - 1 });
  if ((page.page + 1) * page.limit < page.total) prefetchRunSections({ ...normalized, page: page.page + 1 });
  return page;
}

export function prefetchRunSections(query: RunSectionPageQuery) {
  const normalized = normalizeSectionPageQuery(query);
  void cached(sectionPageCache, stableKey(normalized), () => window.telemetryApp.listRunSections(normalized)).catch(() => undefined);
}

export async function fetchRunSectionSamples(query: RunSectionSamplesQuery) {
  return cached(sectionSamplesCache, stableKey(query), () => window.telemetryApp.getRunSectionSamples(query));
}

export async function queryCars(query: CarCatalogQuery) {
  return window.telemetryApp.queryCars(query);
}

export function invalidateRunCaches() {
  runsPageCache.clear();
  runSummaryCache.clear();
  runPathCache.clear();
  sampleWindowCache.clear();
  sectionPageCache.clear();
  sectionSamplesCache.clear();
}

function cached<T>(cache: Map<string, CacheEntry<T>>, key: string, loader: () => Promise<T>) {
  const existing = cache.get(key);
  if (existing?.value !== undefined) return Promise.resolve(existing.value);
  if (existing?.promise) return existing.promise;

  const entry: CacheEntry<T> = {};
  entry.promise = loader()
    .then((value) => {
      entry.value = value;
      entry.promise = undefined;
      return value;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });
  cache.set(key, entry);
  return entry.promise;
}

function normalizeRunsPageQuery(query: RunsPageQuery): RunsPageQuery {
  return {
    cursor: query.cursor ?? null,
    direction: query.direction ?? "next",
    limit: query.limit ?? 50
  };
}

function normalizeSampleWindowQuery(query: RunSampleWindowQuery): RunSampleWindowQuery {
  return {
    runId: query.runId,
    start: Math.max(0, Math.round(query.start ?? 0)),
    limit: query.limit ?? 3000
  };
}

function normalizeSectionPageQuery(query: RunSectionPageQuery): RunSectionPageQuery {
  return {
    runId: query.runId,
    type: query.type,
    page: Math.max(0, Math.round(query.page ?? 0)),
    limit: query.limit ?? 8
  };
}

function stableKey(value: unknown) {
  return JSON.stringify(value);
}
