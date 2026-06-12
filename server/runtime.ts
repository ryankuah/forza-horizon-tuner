import dgram from "node:dgram";
import os from "node:os";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { createTelemetryDatabase } from "./database";
import { enrichTelemetry, parseForzaPacket, type RawTelemetry } from "./forzaPacket";
import { buildTuningAdvice, TelemetryWindow } from "./tuning";
import type { Advice, AppState, SessionDetail, SessionSummary, Summary, Telemetry } from "../src/types/telemetry";

type RuntimeState = {
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

type RuntimeOptions = {
  udpPort?: number;
  dbPath?: string;
  simulate?: boolean;
};

export function createTelemetryRuntime(options: RuntimeOptions = {}) {
  const udpPort = options.udpPort ?? Number(process.env.FORZA_UDP_PORT || 9999);
  const database = createTelemetryDatabase(options.dbPath);
  const removedEmptySessions = database.deleteEmptySessions();
  const events = new EventEmitter();
  const udp = dgram.createSocket("udp4");
  const state: RuntimeState = {
    connected: false,
    packets: 0,
    badPackets: 0,
    lastPacketAt: null,
    lastSource: null,
    last: null,
    summary: null,
    advice: []
  };

  let currentSession = createPendingSession();
  let telemetryWindow = new TelemetryWindow();
  let staleTimer: NodeJS.Timeout | null = null;
  let simulatorTimer: NodeJS.Timeout | null = null;

  function start() {
    udp.on("message", handleUdpMessage);
    udp.bind(udpPort, "0.0.0.0");
    staleTimer = setInterval(markStaleConnections, 1000);

    if (options.simulate) {
      simulatorTimer = startSimulator(handleTelemetry);
    }

    return snapshot();
  }

  function stop() {
    if (staleTimer) clearInterval(staleTimer);
    if (simulatorTimer) clearInterval(simulatorTimer);
    udp.off("message", handleUdpMessage);
    udp.close();
  }

  function onState(listener: (state: AppState) => void) {
    events.on("state", listener);
    return () => events.off("state", listener);
  }

  function snapshot(): AppState {
    return {
      connected: state.connected,
      packets: state.packets,
      badPackets: state.badPackets,
      lastPacketAt: state.lastPacketAt,
      lastSource: state.lastSource,
      udpPort,
      sessionId: currentSession.id,
      localIps: localIps(),
      telemetry: state.last,
      summary: state.summary,
      advice: state.advice
    };
  }

  function listSessions(): { currentSessionId: string; sessions: SessionSummary[] } {
    return {
      currentSessionId: currentSession.id,
      sessions: database.listSessions()
    };
  }

  function getSessionDetail(sessionId: string, limit = 250000): SessionDetail | null {
    const session = database.getSession(sessionId);
    if (!session) return null;

    const samples = database.getSamples(sessionId, clampSampleLimit(limit));
    return {
      session,
      samples,
      summary: summarizeSamples(samples)
    };
  }

  function getSession(sessionId: string) {
    return database.getSession(sessionId);
  }

  function iterateSampleJson(sessionId: string) {
    return database.iterateSampleJson(sessionId);
  }

  function createNewSession() {
    startNewSession("manual", Date.now());
    broadcast();
    return {
      currentSessionId: currentSession.id,
      session: database.getSession(currentSession.id)
    };
  }

  function logStartup() {
    console.log("");
    console.log("Forza Horizon Tuner");
    console.log(`Session DB:     ${database.path}`);
    console.log(`Session ID:     ${currentSession.id} (pending)`);
    if (removedEmptySessions > 0) {
      console.log(`Cleaned empty sessions: ${removedEmptySessions}`);
    }
    console.log(`UDP telemetry: 0.0.0.0:${udpPort}`);
    console.log("LAN IPs:");
    for (const ip of localIps()) {
      console.log(`  ${ip}`);
    }
    console.log("");
    console.log("Forza setup:");
    console.log("  Data Out: On");
    console.log("  Data Out IP Address: one of the LAN IPs above");
    console.log(`  Data Out IP Port: ${udpPort}`);
    console.log("");
  }

  function handleUdpMessage(message: Buffer, remote: dgram.RemoteInfo) {
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

  function ensureCurrentSession(receivedAt: number) {
    if (!currentSession.persisted) {
      database.startSession(currentSession.startedAt, currentSession.id);
      currentSession.persisted = true;
      console.log(`Started telemetry session ${currentSession.id}`);
    }
    return currentSession;
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

  function markStaleConnections() {
    if (state.lastPacketAt && Date.now() - state.lastPacketAt > 2500) {
      state.connected = false;
      state.advice = buildTuningAdvice(null, state.summary);
    }
    broadcast();
  }

  function broadcast() {
    events.emit("state", snapshot());
  }

  return {
    databasePath: database.path,
    start,
    stop,
    onState,
    snapshot,
    listSessions,
    getSession,
    getSessionDetail,
    iterateSampleJson,
    createNewSession,
    logStartup
  };
}

function createPendingSession(startedAt = Date.now()): PendingSession {
  return {
    id: randomUUID(),
    startedAt,
    persisted: false
  };
}

function carIdentityChanged(previous: Telemetry, telemetry: Telemetry) {
  return previous.CarOrdinal !== telemetry.CarOrdinal
    || previous.CarPerformanceIndex !== telemetry.CarPerformanceIndex
    || previous.DrivetrainType !== telemetry.DrivetrainType;
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

function startSimulator(handleTelemetry: (input: TelemetryInput) => void) {
  let tick = 0;
  return setInterval(() => {
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
