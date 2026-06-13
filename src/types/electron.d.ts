export {};

import type { AppState, CarCatalogQuery, CarCatalogResult, RunDetail, SessionWithRuns } from "./telemetry";

declare global {
  interface Window {
    telemetryApp: {
      getSnapshot: () => Promise<AppState>;
      setUdpListening: (isListening: boolean) => Promise<AppState>;
      getSessions: () => Promise<SessionWithRuns[]>;
      getRunDetail: (runId: string) => Promise<RunDetail | null>;
      queryCars: (query: CarCatalogQuery) => Promise<CarCatalogResult>;
      onTelemetryState: (callback: (_event: unknown, state: AppState) => void) => () => void;
      checkForUpdates: () => Promise<unknown>;
      onUpdateAvailable: (callback: () => void) => void;
      onUpdateDownloaded: (callback: () => void) => void;
      onUpdateError: (callback: (_event: unknown, message: string) => void) => void;
    };
  }
}
