export {};

import type {
  AppState,
  CarCatalogQuery,
  CarCatalogResult,
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
} from "./telemetry";

declare global {
  interface Window {
    telemetryApp: {
      getSnapshot: () => Promise<AppState>;
      setUdpListening: (isListening: boolean) => Promise<AppState>;
      listRunsPage: (query: RunsPageQuery) => Promise<RunsPage>;
      getRunSummary: (runId: string) => Promise<RunSummary | null>;
      getRunSampleWindow: (query: RunSampleWindowQuery) => Promise<RunSampleWindow>;
      getRunPath: (runId: string) => Promise<PathSample[]>;
      listRunSections: (query: RunSectionPageQuery) => Promise<RunSectionPage>;
      getRunSectionSamples: (query: RunSectionSamplesQuery) => Promise<RunSectionSamples | null>;
      queryCars: (query: CarCatalogQuery) => Promise<CarCatalogResult>;
      onTelemetryState: (callback: (_event: unknown, state: AppState) => void) => () => void;
      checkForUpdates: () => Promise<unknown>;
      onUpdateAvailable: (callback: () => void) => void;
      onUpdateDownloaded: (callback: () => void) => void;
      onUpdateError: (callback: (_event: unknown, message: string) => void) => void;
    };
  }
}
