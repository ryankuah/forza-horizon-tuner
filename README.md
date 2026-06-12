# Forza Horizon Tuner

Local telemetry dashboard and early setup advisor for Forza Horizon 6.

Frontend stack: Vite, React, TypeScript, and Tailwind CSS.

Desktop stack: Electron, electron-builder, and electron-updater.

## Run

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually:

```text
http://localhost:5173
```

## Run The Desktop App

```bash
npm run dev:electron
```

Electron starts the local telemetry backend automatically. Session data is stored in the app user-data directory in packaged builds.

To test with simulated telemetry in Electron:

```bash
npm run simulate:electron
```

## Steam Deck / Forza Setup

In Forza Horizon 6, open `Settings > HUD and Gameplay`:

- `Data Out`: `On`
- `Data Out IP Address`: your Mac LAN IP shown by the server
- `Data Out IP Port`: `9999`

The server listens on UDP port `9999`. Avoid ports `5200` through `5300`; Forza uses that range for its own outgoing socket.

## Test Without The Game

Run the backend simulator:

```bash
npm run simulate
```

## Checks

```bash
npm run typecheck
npm run build
```

## Desktop Builds And Releases

Build local installers:

```bash
npm run dist
```

Create a GitHub release by pushing a version tag:

```bash
npm version patch
git push origin main --follow-tags
```

The release workflow builds macOS, Windows, and Linux artifacts. `electron-updater` checks GitHub Releases when the packaged app starts. GitHub-hosted auto updates require public release artifacts; private repositories need a separate public update feed or hosted update server.

## What It Does Now

- Receives the official 324-byte FH6 Data Out UDP packet.
- Streams live telemetry to the browser over WebSocket.
- Shows speed, RPM, controls, tire temperatures, combined slip, and packet status.
- Shows the live car position and travelled session path from `PositionX` and `PositionZ` over the official FH6 map reveal image.
- Builds first-pass tuning advice from slip balance, tire temperature balance, suspension compression, and throttle wheelspin.

## Map Alignment

The map base image lives at `public/fh6-map-reveal.jpg`.

The app includes a hard-coded FH6 world-to-map projection in `src/features/map/mapGeometry.ts`. The current default uses a single linked scale with zero cross-axis shear:

```text
mapX = PositionX * 0.13158 + 1160.32838497
mapY = PositionZ * -0.13158 + 1321.0827332
```
