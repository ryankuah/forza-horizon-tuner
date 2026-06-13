# Forza Horizon Tuner

Forza Horizon Tuner is a local desktop telemetry dashboard and setup advisor for Forza Horizon. It listens for the game's Data Out UDP stream, records driving sessions, and visualizes live and historical telemetry in an Electron app.

## Features

- Live UDP telemetry ingestion from the official 324-byte Forza Horizon Data Out packet.
- Electron desktop app with a Vite, React, TypeScript, and Tailwind CSS renderer.
- Local SQLite session storage powered by `better-sqlite3`.
- Live and saved-session playback with map path scrubbing.
- Track map projection using `PositionX` and `PositionZ` over the bundled map reveal image.
- Car, input, tire, suspension, slip, packet, and session telemetry panels.
- First-pass tuning advice based on slip balance, tire temperature balance, suspension compression, and throttle wheelspin.
- Desktop packaging with `electron-builder` and GitHub Releases support through `electron-updater`.

## Tech Stack

- Electron
- React 19
- TypeScript
- Vite
- Tailwind CSS
- SQLite / `better-sqlite3`
- `electron-builder`

## Requirements

- Node.js and npm
- Forza Horizon with Data Out support enabled
- A Mac, Windows, or Linux machine on the same network as the device running the game

## Getting Started

Install dependencies:

```bash
npm install
```

Run the Electron app:

```bash
npm start
```

The Electron main process starts the telemetry runtime automatically. The app does not require a browser dev server, WebSocket server, or external API service.

## Forza Data Out Setup

In Forza Horizon, open `Settings > HUD and Gameplay` and configure:

- `Data Out`: `On`
- `Data Out IP Address`: the LAN IP address shown in the app
- `Data Out IP Port`: `9999`

The app listens on UDP port `9999` by default. Avoid ports `5200` through `5300`; Forza uses that range for its own outgoing socket.

To use a different port, set `FORZA_UDP_PORT` before starting the app:

```bash
FORZA_UDP_PORT=9998 npm start
```

## Available Scripts

```bash
npm start
```

Builds the renderer and Electron main process, rebuilds native Electron dependencies, and starts the desktop app.

```bash
npm run typecheck
```

Runs TypeScript validation without emitting files.

```bash
npm run build
```

Builds both the Vite renderer and bundled Electron files.

```bash
npm run pack
```

Builds an unpacked local Electron app.

```bash
npm run dist
```

Builds installable desktop artifacts.

```bash
npm run release
```

Builds and publishes release artifacts with `electron-builder`.

## Session Storage

Session data is stored locally in SQLite. In packaged builds, the database is created in the Electron app user-data directory.

The runtime creates a session when race telemetry starts, records valid packets, tracks bad packets, and keeps saved sessions available for playback from the app sidebar.

## Map Alignment

The map image is stored at:

```text
public/fh6-map-reveal.jpg
```

The world-to-map projection is defined in:

```text
src/features/map/mapGeometry.ts
```

Current default projection:

```text
mapX = PositionX * 0.13158 + 1160.32838497
mapY = PositionZ * -0.13158 + 1321.0827332
```

## Desktop Builds And Releases

Packaging scripts rebuild `better-sqlite3` for the target Electron version before creating artifacts.

macOS releases must be signed and notarized to open normally after download. The release workflow requires these GitHub repository secrets before it creates release artifacts:

- `MAC_CERTIFICATE`: base64-encoded Developer ID Application certificate, exported as a `.p12`
- `MAC_CERTIFICATE_PASSWORD`: password for the exported certificate
- `APPLE_ID`: Apple Developer account email
- `APPLE_APP_SPECIFIC_PASSWORD`: app-specific password for notarization
- `APPLE_TEAM_ID`: Apple Developer Team ID

Without those secrets, the release workflow fails before creating a release because unsigned macOS downloads are blocked by Gatekeeper as damaged.

To create a tagged release:

```bash
npm version patch
git push origin main --follow-tags
```

The release workflow builds macOS, Windows, and Linux artifacts. `electron-updater` checks GitHub Releases when the packaged app starts.

GitHub-hosted auto updates require public release artifacts. Private repositories need a separate public update feed or hosted update server.
