export {};

import type { AppState, SessionDetail, SessionSummary } from "./telemetry";

declare global {
  interface Window {
    telemetryApp: {
      getSnapshot: () => Promise<AppState>;
      getSessions: () => Promise<SessionSummary[]>;
      getSessionDetail: (sessionId: string) => Promise<SessionDetail | null>;
      createNewSession: () => Promise<boolean>;
      onTelemetryState: (callback: (_event: unknown, state: AppState) => void) => () => void;
      checkForUpdates: () => Promise<unknown>;
      onUpdateAvailable: (callback: () => void) => void;
      onUpdateDownloaded: (callback: () => void) => void;
      onUpdateError: (callback: (_event: unknown, message: string) => void) => void;
    };
  }
}
