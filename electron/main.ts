import { app, BrowserWindow, ipcMain, shell } from "electron";
import { autoUpdater } from "electron-updater";
import fs from "node:fs";
import path from "node:path";
import { createTelemetryRuntime } from "../server/runtime";
import type { AppState } from "../src/types/telemetry";

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let runtime: ReturnType<typeof createTelemetryRuntime> | null = null;

function rendererEntry() {
  if (process.env.VITE_DEV_SERVER_URL) {
    return process.env.VITE_DEV_SERVER_URL;
  }

  return `file://${path.join(__dirname, "..", "dist", "index.html")}`;
}

function startTelemetryRuntime() {
  runtime = createTelemetryRuntime({
    dbPath: path.join(app.getPath("userData"), "telemetry.sqlite"),
    simulate: process.env.SIMULATE === "1"
  });
  runtime.onState((state) => {
    mainWindow?.webContents.send("telemetry:state", state);
  });
  runtime.start();
  runtime.logStartup();
}

function setupTelemetryIpc() {
  ipcMain.handle("telemetry:snapshot", () => runtime?.snapshot());
  ipcMain.handle("telemetry:sessions", () => runtime?.listSessions().sessions ?? []);
  ipcMain.handle("telemetry:session-detail", (_event, sessionId: string) => runtime?.getSessionDetail(sessionId) ?? null);
  ipcMain.handle("telemetry:new-session", () => Boolean(runtime?.createNewSession().currentSessionId));
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#09090b",
    title: "",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error(`Renderer process exited: ${details.reason}`);
  });

  mainWindow.webContents.once("did-finish-load", () => {
    mainWindow?.webContents.send("telemetry:state", runtime?.snapshot() satisfies AppState | undefined);
  });

  await mainWindow.loadURL(rendererEntry());

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

function setupAutoUpdates() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (error) => {
    mainWindow?.webContents.send("update:error", error.message);
  });
  autoUpdater.on("update-available", () => {
    mainWindow?.webContents.send("update:available");
  });
  autoUpdater.on("update-downloaded", () => {
    mainWindow?.webContents.send("update:downloaded");
  });

  ipcMain.handle("app:check-for-updates", async () => {
    if (!canCheckForUpdates()) return { skipped: true };
    try {
      const result = await autoUpdater.checkForUpdatesAndNotify();
      return { updateInfo: result?.updateInfo ?? null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  });
}

function canCheckForUpdates() {
  return app.isPackaged && fs.existsSync(path.join(process.resourcesPath, "app-update.yml"));
}

app.whenReady().then(async () => {
  setupAutoUpdates();
  setupTelemetryIpc();
  startTelemetryRuntime();
  await createMainWindow();

  if (canCheckForUpdates()) {
    void autoUpdater.checkForUpdatesAndNotify().catch(() => undefined);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on("before-quit", () => {
  runtime?.stop();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
