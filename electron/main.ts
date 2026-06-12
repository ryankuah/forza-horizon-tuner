import { app, BrowserWindow, dialog, ipcMain, shell, utilityProcess, type UtilityProcess } from "electron";
import { autoUpdater } from "electron-updater";
import path from "node:path";

const HTTP_PORT = Number(process.env.HTTP_PORT || 3001);
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let serverProcess: UtilityProcess | null = null;
let isQuitting = false;

function serverEntryPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "server", "index.cjs")
    : path.join(__dirname, "..", "dist-server", "index.cjs");
}

function rendererEntry() {
  if (process.env.VITE_DEV_SERVER_URL) {
    return process.env.VITE_DEV_SERVER_URL;
  }

  return `file://${path.join(__dirname, "..", "dist", "index.html")}`;
}

function startTelemetryServer() {
  const dbPath = path.join(app.getPath("userData"), "telemetry.sqlite");
  serverProcess = utilityProcess.fork(serverEntryPath(), [], {
    env: {
      ...process.env,
      HTTP_PORT: String(HTTP_PORT),
      WS_PORT: String(process.env.WS_PORT || 8765),
      FORZA_UDP_PORT: String(process.env.FORZA_UDP_PORT || 9999),
      TELEMETRY_DB_PATH: dbPath
    },
    serviceName: "telemetry-server"
  });

  serverProcess.stdout?.on("data", (data) => {
    console.log(`[telemetry-server] ${data.toString().trimEnd()}`);
  });
  serverProcess.stderr?.on("data", (data) => {
    console.error(`[telemetry-server] ${data.toString().trimEnd()}`);
  });
  serverProcess.once("exit", (code) => {
    serverProcess = null;
    if (!isQuitting && code !== 0) {
      dialog.showErrorBox("Telemetry server stopped", `The local telemetry server exited with code ${code}.`);
    }
  });
}

async function waitForTelemetryServer(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://localhost:${HTTP_PORT}/api/status`);
      if (response.ok) return;
    } catch {
      // Server is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#09090b",
    title: "Forza Horizon Tuner",
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

  await waitForTelemetryServer();
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
    if (!app.isPackaged) return { skipped: true };
    const result = await autoUpdater.checkForUpdatesAndNotify();
    return { updateInfo: result?.updateInfo ?? null };
  });
}

app.whenReady().then(async () => {
  setupAutoUpdates();
  startTelemetryServer();
  await createMainWindow();

  if (app.isPackaged) {
    void autoUpdater.checkForUpdatesAndNotify();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  serverProcess?.kill();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
