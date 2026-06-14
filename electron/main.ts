import { app, BrowserWindow, dialog, ipcMain, shell, type MessageBoxOptions } from "electron";
import { autoUpdater } from "electron-updater";
import fs from "node:fs";
import path from "node:path";
import { createCarCatalog } from "../server/carCatalog";
import { createTelemetryRuntime } from "../server/runtime";
import type { AppState, CarCatalogQuery } from "../src/types/telemetry";

let mainWindow: BrowserWindow | null = null;
let runtime: ReturnType<typeof createTelemetryRuntime> | null = null;
let carCatalog: ReturnType<typeof createCarCatalog> | null = null;
let isInstallingUpdate = false;

function rendererEntry() {
  return `file://${path.join(__dirname, "..", "dist", "index.html")}`;
}

function appIconPath() {
  const candidates = [
    path.join(__dirname, "..", "build", "icon.png"),
    path.join(process.resourcesPath, "icon.png")
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function carCatalogPath() {
  const candidates = [
    path.join(__dirname, "..", "data", "fh6-cars.sqlite"),
    path.join(process.resourcesPath, "data", "fh6-cars.sqlite")
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

function startTelemetryRuntime() {
  runtime = createTelemetryRuntime({
    dbPath: path.join(app.getPath("userData"), "telemetry.sqlite")
  });
  runtime.onState((state) => {
    mainWindow?.webContents.send("telemetry:state", state);
  });
  runtime.start();
  runtime.logStartup();
}

function startCarCatalog() {
  carCatalog = createCarCatalog(carCatalogPath());
}

function setupTelemetryIpc() {
  ipcMain.handle("telemetry:snapshot", () => runtime?.snapshot());
  ipcMain.handle("telemetry:set-udp-listening", (_event, isListening: boolean) => runtime?.setUdpListening(isListening));
  ipcMain.handle("telemetry:run-groups", () => runtime?.listRunGroups().runGroups ?? []);
  ipcMain.handle("telemetry:run-detail", (_event, runId: string) => runtime?.getRunDetail(runId) ?? null);
  ipcMain.handle("cars:query", (_event, query: CarCatalogQuery) => carCatalog?.queryCars(query) ?? { cars: [], total: 0, matched: 0 });
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#09090b",
    icon: appIconPath(),
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
    void promptToInstallUpdate();
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

async function promptToInstallUpdate() {
  const options: MessageBoxOptions = {
    type: "info",
    buttons: ["Restart now", "Later"],
    defaultId: 0,
    cancelId: 1,
    message: "A Forza Horizon Tuner update is ready.",
    detail: "Restart the app to install the update."
  };
  const result = mainWindow
    ? await dialog.showMessageBox(mainWindow, options)
    : await dialog.showMessageBox(options);

  if (result.response !== 0) return;

  isInstallingUpdate = true;
  runtime?.stop();
  autoUpdater.quitAndInstall(false, true);
}

app.whenReady().then(async () => {
  setupAutoUpdates();
  setupTelemetryIpc();
  startCarCatalog();
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
  if (!isInstallingUpdate) runtime?.stop();
  carCatalog?.close();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
