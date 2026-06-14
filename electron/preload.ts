import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("telemetryApp", {
  getSnapshot: () => ipcRenderer.invoke("telemetry:snapshot"),
  setUdpListening: (isListening: boolean) => ipcRenderer.invoke("telemetry:set-udp-listening", isListening),
  getRunGroups: () => ipcRenderer.invoke("telemetry:run-groups"),
  getRunDetail: (runId: string) => ipcRenderer.invoke("telemetry:run-detail", runId),
  queryCars: (query: unknown) => ipcRenderer.invoke("cars:query", query),
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
