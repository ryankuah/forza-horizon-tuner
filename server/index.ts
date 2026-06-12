import dgram from "node:dgram";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import express from "express";
import { WebSocketServer } from "ws";
import { createTelemetryDatabase } from "./database";
import { enrichTelemetry, parseForzaPacket, type RawTelemetry } from "./forzaPacket";
import { buildTuningAdvice, TelemetryWindow } from "./tuning";
import type { Advice, AppState, Summary, Telemetry } from "../src/types/telemetry";

const UDP_PORT = Number(process.env.FORZA_UDP_PORT || 9999);
const HTTP_PORT = Number(process.env.HTTP_PORT || 3001);
const WS_PORT = Number(process.env.WS_PORT || 8765);
const SIMULATE = process.env.SIMULATE === "1";
type ServerState = {
  connected: boolean;
  packets: number;
  badPackets: number;
  lastPacketAt: number | null;
  lastSource: string | null;
  last: Telemetry | null;
  summary: Summary | null;
  advice: Advice[];
};

type PendingSession = {
  id: string;
  startedAt: number;
  persisted: boolean;
};

type TelemetryInput = {
  telemetry: Telemetry;
  receivedAt: number;
  source: string;
  rawPacket?: Buffer | null;
};

const state: ServerState = {
  connected: false,
  packets: 0,
  badPackets: 0,
  lastPacketAt: null,
  lastSource: null,
  last: null,
  summary: null,
  advice: []
};

let telemetryWindow = new TelemetryWindow();
const database = createTelemetryDatabase();
const removedEmptySessions = database.deleteEmptySessions();
let currentSession = createPendingSession();
const udp = dgram.createSocket("udp4");
const app = express();
const wss = new WebSocketServer({ port: WS_PORT });

app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get("/api/status", (_req, res) => {
  res.json(snapshot());
});

app.get("/api/sessions", (_req, res) => {
  res.json({
    currentSessionId: currentSession.id,
    sessions: database.listSessions()
  });
});

app.get("/api/sessions/:id", (req, res) => {
  const session = database.getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const samples = database.getSamples(req.params.id, clampSampleLimit(req.query.limit));
  res.json({
    session,
    samples,
    summary: summarizeSamples(samples)
  });
});

app.get("/api/sessions/:id/stream", async (req, res) => {
  const session = database.getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const writeLine = async (value: unknown) => {
    if (res.destroyed) return false;
    if (!res.write(`${JSON.stringify(value)}\n`)) {
      await once(res, "drain");
    }
    return !res.destroyed;
  };

  const sessionWindow = new TelemetryWindow();
  let sampleCount = 0;

  try {
    if (!await writeLine({ type: "session", session })) return;

    for (const row of database.iterateSampleJson(req.params.id)) {
      const telemetry = JSON.parse(row.telemetryJson) as Telemetry;
      sessionWindow.add(telemetry);
      sampleCount += 1;

      if (!await writeLine({ type: "sample", telemetry })) return;
    }

    await writeLine({
      type: "done",
      sampleCount,
      summary: sessionWindow.summary()
    });
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to stream session" });
      return;
    }

    await writeLine({
      type: "error",
      error: error instanceof Error ? error.message : String(error)
    });
    res.end();
  }
});

app.post("/api/sessions/new", (_req, res) => {
  startNewSession("manual", Date.now());
  broadcast();
  res.json({
    currentSessionId: currentSession.id,
    session: database.getSession(currentSession.id)
  });
});

app.listen(HTTP_PORT, "0.0.0.0", () => {
  logStartup();
});

udp.on("message", (message, remote) => {
  const receivedAt = Date.now();
  const source = `${remote.address}:${remote.port}`;

  try {
    const telemetry = enrichTelemetry(parseForzaPacket(message), receivedAt);
    maybeStartNewSessionForTelemetry(telemetry, receivedAt);
    handleTelemetry({ telemetry, receivedAt, source, rawPacket: message });
    } catch (error) {
      state.badPackets += 1;
      if (currentSession.persisted) {
        database.recordBadPacket({
          sessionId: currentSession.id,
          receivedAt,
          source,
          rawPacket: message,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    console.error(`Failed to parse UDP packet: ${error instanceof Error ? error.message : String(error)}`);
  }
});

udp.bind(UDP_PORT, "0.0.0.0");

wss.on("connection", (socket) => {
  socket.send(JSON.stringify(snapshot()));
});

setInterval(() => {
  if (state.lastPacketAt && Date.now() - state.lastPacketAt > 2500) {
    state.connected = false;
    state.advice = buildTuningAdvice(null, state.summary);
  }
  broadcast();
}, 1000);

if (SIMULATE) {
  startSimulator();
}

function snapshot(): AppState {
  return {
    connected: state.connected,
    packets: state.packets,
    badPackets: state.badPackets,
    lastPacketAt: state.lastPacketAt,
    lastSource: state.lastSource,
    udpPort: UDP_PORT,
    httpPort: HTTP_PORT,
    wsPort: WS_PORT,
    sessionId: currentSession.id,
    localIps: localIps(),
    telemetry: state.last,
    summary: state.summary,
    advice: state.advice
  };
}

function broadcast() {
  const payload = JSON.stringify(snapshot());
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}

function localIps() {
  const ips: string[] = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const iface of interfaces || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

function logStartup() {
  console.log("");
  console.log("Forza Horizon Tuner");
  console.log(`Session DB:     ${database.path}`);
  console.log(`Session ID:     ${currentSession.id} (pending)`);
  if (removedEmptySessions > 0) {
    console.log(`Cleaned empty sessions: ${removedEmptySessions}`);
  }
  console.log(`UDP telemetry: 0.0.0.0:${UDP_PORT}`);
  console.log(`HTTP status:   http://localhost:${HTTP_PORT}/api/status`);
  console.log(`WebSocket:     ws://localhost:${WS_PORT}`);
  console.log("Mac LAN IPs:");
  for (const ip of localIps()) {
    console.log(`  ${ip}`);
  }
  console.log("");
  console.log("Forza setup on Steam Deck:");
  console.log("  Data Out: On");
  console.log(`  Data Out IP Address: one of the Mac LAN IPs above`);
  console.log(`  Data Out IP Port: ${UDP_PORT}`);
  console.log("");
}

function maybeStartNewSessionForTelemetry(telemetry: Telemetry, receivedAt: number) {
  if (telemetry.IsRaceOn === 1 && state.last?.IsRaceOn === 1 && carIdentityChanged(state.last, telemetry)) {
    startNewSession("car_change", receivedAt);
  }
}

function startNewSession(reason: string, startedAt = Date.now()) {
  if (currentSession.persisted) {
    database.endSession(currentSession.id, startedAt);
  }
  currentSession = createPendingSession(startedAt);
  telemetryWindow = new TelemetryWindow();
  state.connected = false;
  state.packets = 0;
  state.badPackets = 0;
  state.lastPacketAt = null;
  state.lastSource = reason;
  state.last = null;
  state.summary = null;
  state.advice = buildTuningAdvice(null, null);
  console.log(`Prepared telemetry session ${currentSession.id} (${reason})`);
}

function createPendingSession(startedAt = Date.now()): PendingSession {
  return {
    id: randomUUID(),
    startedAt,
    persisted: false
  };
}

function ensureCurrentSession(receivedAt: number) {
  if (!currentSession.persisted) {
    database.startSession(currentSession.startedAt, currentSession.id);
    currentSession.persisted = true;
    console.log(`Started telemetry session ${currentSession.id}`);
  }
  return currentSession;
}

function carIdentityChanged(previous: Telemetry, telemetry: Telemetry) {
  return previous.CarOrdinal !== telemetry.CarOrdinal
    || previous.CarPerformanceIndex !== telemetry.CarPerformanceIndex
    || previous.DrivetrainType !== telemetry.DrivetrainType;
}

function handleTelemetry({ telemetry, receivedAt, source, rawPacket = null }: TelemetryInput) {
  state.connected = true;
  state.lastPacketAt = receivedAt;
  state.lastSource = source;
  state.last = telemetry;

  if (telemetry.IsRaceOn !== 1) {
    state.advice = buildTuningAdvice(null, state.summary);
    broadcast();
    return;
  }

  state.packets += 1;
  telemetryWindow.add(telemetry);
  state.summary = telemetryWindow.summary();
  state.advice = buildTuningAdvice(state.last, state.summary);
  const session = ensureCurrentSession(receivedAt);
  database.recordValidPacket({
    sessionId: session.id,
    receivedAt,
    source,
    rawPacket,
    telemetry
  });
  broadcast();
}

function summarizeSamples(samples: Telemetry[]) {
  const sessionWindow = new TelemetryWindow();
  for (const sample of samples) {
    sessionWindow.add(sample);
  }
  return sessionWindow.summary();
}

function clampSampleLimit(value: unknown) {
  const limit = Number(value || 5000);
  if (!Number.isFinite(limit)) return 5000;
  return Math.min(250000, Math.max(1, Math.round(limit)));
}

function startSimulator() {
  let tick = 0;
  setInterval(() => {
    tick += 1;
    const phase = tick / 20;
    const routePhase = tick / 38;
    const routeRadius = 360 + Math.sin(routePhase / 3) * 90;
    const positionX = Math.cos(routePhase) * routeRadius + Math.sin(routePhase / 2) * 140;
    const positionZ = Math.sin(routePhase) * 260 + Math.cos(routePhase / 4) * 120;
    const previousRoutePhase = (tick - 1) / 38;
    const previousRouteRadius = 360 + Math.sin(previousRoutePhase / 3) * 90;
    const previousPositionX = Math.cos(previousRoutePhase) * previousRouteRadius + Math.sin(previousRoutePhase / 2) * 140;
    const previousPositionZ = Math.sin(previousRoutePhase) * 260 + Math.cos(previousRoutePhase / 4) * 120;
    const velocityX = (positionX - previousPositionX) * 20;
    const velocityZ = (positionZ - previousPositionZ) * 20;
    const frontBias = Math.sin(phase / 3) * 0.18;
    const rearBias = Math.cos(phase / 4) * 0.16;
    const rawTelemetry: RawTelemetry = {
      IsRaceOn: 1,
      TimestampMS: tick * 50,
      EngineMaxRpm: 8200,
      EngineIdleRpm: 900,
      CurrentEngineRpm: 2400 + Math.abs(Math.sin(phase)) * 5200,
      AccelerationX: Math.sin(phase) * 4,
      AccelerationY: 0,
      AccelerationZ: Math.cos(phase / 2) * 6,
      VelocityX: velocityX,
      VelocityY: 0,
      VelocityZ: velocityZ,
      AngularVelocityX: 0,
      AngularVelocityY: Math.sin(phase) * 0.6,
      AngularVelocityZ: 0,
      Yaw: 0,
      Pitch: 0,
      Roll: 0,
      NormalizedSuspensionTravelFrontLeft: 0.42 + Math.max(0, Math.sin(phase)) * 0.52,
      NormalizedSuspensionTravelFrontRight: 0.48 + Math.max(0, Math.sin(phase + 0.8)) * 0.42,
      NormalizedSuspensionTravelRearLeft: 0.38 + Math.max(0, Math.cos(phase)) * 0.48,
      NormalizedSuspensionTravelRearRight: 0.44 + Math.max(0, Math.cos(phase + 0.5)) * 0.4,
      TireSlipRatioFrontLeft: 0.1 + frontBias,
      TireSlipRatioFrontRight: 0.11 + frontBias,
      TireSlipRatioRearLeft: 0.12 + rearBias,
      TireSlipRatioRearRight: 0.1 + rearBias,
      WheelRotationSpeedFrontLeft: 80,
      WheelRotationSpeedFrontRight: 80,
      WheelRotationSpeedRearLeft: 82,
      WheelRotationSpeedRearRight: 82,
      WheelOnRumbleStripFrontLeft: 0,
      WheelOnRumbleStripFrontRight: 0,
      WheelOnRumbleStripRearLeft: 0,
      WheelOnRumbleStripRearRight: 0,
      WheelInPuddleFrontLeft: 0,
      WheelInPuddleFrontRight: 0,
      WheelInPuddleRearLeft: 0,
      WheelInPuddleRearRight: 0,
      SurfaceRumbleFrontLeft: 0,
      SurfaceRumbleFrontRight: 0,
      SurfaceRumbleRearLeft: 0,
      SurfaceRumbleRearRight: 0,
      TireSlipAngleFrontLeft: 0.13 + frontBias,
      TireSlipAngleFrontRight: 0.12 + frontBias,
      TireSlipAngleRearLeft: 0.1 + rearBias,
      TireSlipAngleRearRight: 0.1 + rearBias,
      TireCombinedSlipFrontLeft: 0.25 + frontBias,
      TireCombinedSlipFrontRight: 0.22 + frontBias,
      TireCombinedSlipRearLeft: 0.2 + rearBias,
      TireCombinedSlipRearRight: 0.2 + rearBias,
      SuspensionTravelMetersFrontLeft: 0.08,
      SuspensionTravelMetersFrontRight: 0.08,
      SuspensionTravelMetersRearLeft: 0.09,
      SuspensionTravelMetersRearRight: 0.09,
      CarOrdinal: 0,
      CarClass: 5,
      CarPerformanceIndex: 812,
      DrivetrainType: 2,
      NumCylinders: 6,
      CarGroup: 0,
      SmashableVelDiff: 0,
      SmashableMass: 0,
      PositionX: positionX,
      PositionY: 0,
      PositionZ: positionZ,
      Speed: 42 + Math.sin(phase / 2) * 12,
      Power: 240000 + Math.sin(phase) * 90000,
      Torque: 420 + Math.cos(phase) * 120,
      TireTempFrontLeft: 88 + frontBias * 55,
      TireTempFrontRight: 89 + frontBias * 55,
      TireTempRearLeft: 86 + rearBias * 50,
      TireTempRearRight: 87 + rearBias * 50,
      Boost: 8 + Math.sin(phase) * 4,
      Fuel: 0.7,
      DistanceTraveled: tick * 2,
      BestLap: 0,
      LastLap: 0,
      CurrentLap: tick / 20,
      CurrentRaceTime: tick / 20,
      LapNumber: 1,
      RacePosition: 1,
      Accel: Math.round(130 + Math.max(0, Math.sin(phase)) * 125),
      Brake: Math.round(Math.max(0, Math.cos(phase * 0.7)) * 120),
      Clutch: 0,
      HandBrake: 0,
      Gear: 4,
      Steer: Math.round(Math.sin(phase / 1.5) * 80),
      NormalizedDrivingLine: 0,
      NormalizedAIBrakeDifference: 0
    };
    const telemetry = enrichTelemetry(rawTelemetry);

    handleTelemetry({
      telemetry,
      receivedAt: telemetry.receivedAt ?? Date.now(),
      source: "simulator"
    });
  }, 50);
}
