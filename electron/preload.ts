import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("telemetryApp", {
  getSnapshot: () => ipcRenderer.invoke("telemetry:snapshot"),
  getSessions: () => ipcRenderer.invoke("telemetry:sessions"),
  getSessionDetail: (sessionId: string) => ipcRenderer.invoke("telemetry:session-detail", sessionId),
  createNewSession: () => ipcRenderer.invoke("telemetry:new-session"),
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
