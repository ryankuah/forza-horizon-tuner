export {};

import type { AppState, RunDetail, SessionWithRuns } from "./telemetry";

declare global {
  interface Window {
    telemetryApp: {
      getSnapshot: () => Promise<AppState>;
      getSessions: () => Promise<SessionWithRuns[]>;
      getRunDetail: (runId: string) => Promise<RunDetail | null>;
      onTelemetryState: (callback: (_event: unknown, state: AppState) => void) => () => void;
      checkForUpdates: () => Promise<unknown>;
      onUpdateAvailable: (callback: () => void) => void;
      onUpdateDownloaded: (callback: () => void) => void;
      onUpdateError: (callback: (_event: unknown, message: string) => void) => void;
    };
  }
}
