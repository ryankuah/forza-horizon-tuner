export {};

declare global {
  interface Window {
    telemetryApp?: {
      checkForUpdates: () => Promise<unknown>;
      onUpdateAvailable: (callback: () => void) => void;
      onUpdateDownloaded: (callback: () => void) => void;
      onUpdateError: (callback: (_event: unknown, message: string) => void) => void;
    };
  }
}

