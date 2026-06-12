import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("telemetryApp", {
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

