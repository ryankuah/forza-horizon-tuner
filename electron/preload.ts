import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("telemetryApp", {
  getSnapshot: () => ipcRenderer.invoke("telemetry:snapshot"),
  getSessions: () => ipcRenderer.invoke("telemetry:sessions"),
  getRunDetail: (runId: string) => ipcRenderer.invoke("telemetry:run-detail", runId),
  onTelemetryState: (callback: (_event: unknown, state: unknown) => void) => {
    ipcRenderer.on("telemetry:state", callback);
    return () => ipcRenderer.off("telemetry:state", callback);
  },
  checkForUpdates: () => ipcRenderer.invoke("app:check-for-updates"),
  onUpdateAvailable: (callback: () => void) => {
    ipcRenderer.on("update:available", callback);
  },
  onUpdateDownloaded: (callback: () => void) => {
    ipcRenderer.on("update:downloaded", callback);
  },
  onUpdateError: (callback: (_event: unknown, message: string) => void) => {
    ipcRenderer.on("update:error", callback);
  }
});
