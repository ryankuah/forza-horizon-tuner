import dgram from "node:dgram";
import os from "node:os";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { createTelemetryDatabase } from "./database";
import { enrichTelemetry, parseForzaPacket, type RawTelemetry } from "./forzaPacket";
import { buildTuningAdvice, TelemetryWindow } from "./tuning";
import type {
  Advice,
  AppState,
  RunSampleWindowQuery,
  RunSectionPageQuery,
  RunSectionSamplesQuery,
  RunsPageQuery,
  RunType,
  Summary,
  Telemetry
} from "../src/types/telemetry";

type RuntimeState = {
  connected: boolean;
  packets: number;
  badPackets: number;
  lastPacketAt: number | null;
  lastSource: string | null;
  last: Telemetry | null;
  summary: Summary | null;
  advice: Advice[];
  completedRunsVersion: number;
};

type PendingRun = {
  id: string;
  startedAt: number;
  persisted: boolean;
  splitReason: string;
  runType: RunType | null;
};

type TelemetryInput = {
  telemetry: Telemetry;
  receivedAt: number;
  source: string;
};

type RuntimeOptions = {
  udpPort?: number;
  dbPath?: string;
  rawDbPath?: string;
  simulate?: boolean;
};

export function createTelemetryRuntime(options: RuntimeOptions = {}) {
  const udpPort = options.udpPort ?? Number(process.env.FORZA_UDP_PORT || 9999);
  const database = createTelemetryDatabase(options.dbPath, options.rawDbPath);
  const removedIncompleteRuns = database.deleteIncompleteRuns();
  const events = new EventEmitter();
  const state: RuntimeState = {
    connected: false,
    packets: 0,
    badPackets: 0,
    lastPacketAt: null,
    lastSource: null,
    last: null,
    summary: null,
    advice: buildTuningAdvice(null, null),
    completedRunsVersion: 0
  };

  let currentRun = createPendingRun(Date.now(), "connection");
  let telemetryWindow = new TelemetryWindow();
  let udp: dgram.Socket | null = null;
  let udpListening = false;
  let staleTimer: NodeJS.Timeout | null = null;
  let simulatorTimer: NodeJS.Timeout | null = null;

  function start() {
    staleTimer = setInterval(markStaleConnections, 1000);

    if (options.simulate) {
      simulatorTimer = startSimulator(handleTelemetry);
    }

    return snapshot();
  }

  function stop() {
    if (staleTimer) clearInterval(staleTimer);
    if (simulatorTimer) clearInterval(simulatorTimer);
    finalizeCurrentRun("app_quit");
    stopUdpListening({ broadcastState: false, finalizeRun: false });
    database.close();
  }

  function startUdpListening() {
    if (udpListening || udp) return snapshot();

    const socket = dgram.createSocket("udp4");
    udp = socket;
    socket.on("message", handleUdpMessage);
    socket.on("error", (error) => {
      console.error(`UDP listener error: ${error instanceof Error ? error.message : String(error)}`);
      udpListening = false;
      state.connected = false;
      state.advice = buildTuningAdvice(null, state.summary);
      if (udp === socket) udp = null;
      socket.close();
      broadcast();
    });
    socket.bind(udpPort, "0.0.0.0", () => {
      if (udp !== socket) {
        socket.close();
        return;
      }
      udpListening = true;
      broadcast();
    });

    return snapshot();
  }

  function stopUdpListening({ broadcastState = true, finalizeRun = true } = {}) {
    if (finalizeRun) finalizeCurrentRun("listener_stop");
    if (!udp) {
      udpListening = false;
      state.connected = false;
      if (broadcastState) broadcast();
      return snapshot();
    }

    const socket = udp;
    udp = null;
    udpListening = false;
    state.connected = false;
    state.advice = buildTuningAdvice(null, state.summary);
    socket.off("message", handleUdpMessage);
    socket.close();
    if (broadcastState) broadcast();
    return snapshot();
  }

  function setUdpListening(nextUdpListening: boolean) {
    return nextUdpListening ? startUdpListening() : stopUdpListening();
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
      localIps: localIps(),
      telemetry: state.last,
      summary: state.summary,
      advice: state.advice,
      udpListening,
      runId: currentRun.persisted ? currentRun.id : undefined,
      completedRunsVersion: state.completedRunsVersion
    };
  }

  function listRunsPage(query?: RunsPageQuery) {
    return database.listRunsPage(query);
  }

  function getRunSummary(runId: string) {
    return database.getRunSummary(runId);
  }

  function getRunSampleWindow(query: RunSampleWindowQuery) {
    return database.getRunSampleWindow(query);
  }

  function getRunPath(runId: string) {
    return database.getRunPath(runId);
  }

  function listRunSections(query: RunSectionPageQuery) {
    return database.listRunSections(query);
  }

  function getRunSectionSamples(query: RunSectionSamplesQuery) {
    return database.getRunSectionSamples(query);
  }

  function logStartup() {
    console.log("");
    console.log("Forza Horizon Tuner");
    console.log(`Telemetry DB:   ${database.path}`);
    console.log(`Raw packet DB:  ${database.rawPath}`);
    console.log(`Run ID:         ${currentRun.id} (pending)`);
    if (removedIncompleteRuns > 0) {
      console.log(`Cleaned incomplete runs: ${removedIncompleteRuns}`);
    }
    console.log(`UDP telemetry: 0.0.0.0:${udpPort} (paused)`);
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
      database.recordRawPacket({ receivedAt, source, rawPacket: message });
    } catch (error) {
      console.error(`Failed to save raw UDP packet: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const telemetry = enrichTelemetry(parseForzaPacket(message), receivedAt);
      handleTelemetry({ telemetry, receivedAt, source });
    } catch (error) {
      state.badPackets += 1;
      state.lastPacketAt = receivedAt;
      state.lastSource = source;
      console.error(`Failed to parse UDP packet: ${error instanceof Error ? error.message : String(error)}`);
      broadcast();
    }
  }

  function handleTelemetry({ telemetry, receivedAt, source }: TelemetryInput) {
    const previousTelemetry = state.last;
    const previousPacketAt = state.lastPacketAt;
    const wasConnected = state.connected;

    state.connected = true;
    state.lastPacketAt = receivedAt;
    state.lastSource = source;

    if (telemetry.IsRaceOn !== 1) {
      state.connected = false;
      state.last = null;
      finalizeCurrentRun("menu");
      state.advice = buildTuningAdvice(null, state.summary);
      broadcast();
      return;
    }

    maybeSplitRunForTelemetry(telemetry, receivedAt, previousTelemetry, previousPacketAt, wasConnected);
    const run = ensureCurrentRun(telemetry, receivedAt, source);

    state.last = telemetry;
    state.packets += 1;
    telemetryWindow.add(telemetry);
    state.summary = telemetryWindow.summary();
    state.advice = buildTuningAdvice(state.last, state.summary);
    database.recordValidPacket({
      runId: run.id,
      receivedAt,
      source,
      telemetry
    });
    broadcast();
  }

  function maybeSplitRunForTelemetry(
    telemetry: Telemetry,
    receivedAt: number,
    previousTelemetry: Telemetry | null,
    previousPacketAt: number | null,
    wasConnected: boolean
  ) {
    if (!previousTelemetry || previousTelemetry.IsRaceOn !== 1) return;

    if (previousPacketAt && receivedAt - previousPacketAt > 15000) {
      startNewRun("long_gap", receivedAt);
      return;
    }

    if (!wasConnected && previousPacketAt && receivedAt - previousPacketAt > 2500) {
      startNewRun("udp_reconnect", receivedAt);
      return;
    }

    const nextRunType = classifyRunType(telemetry);
    if (currentRun.persisted && currentRun.runType && currentRun.runType !== nextRunType) {
      startNewRun("run_type_change", receivedAt);
      return;
    }

    if (carIdentityChanged(previousTelemetry, telemetry)) {
      startNewRun("car_change", receivedAt);
      return;
    }

    if (quickTravelDetected(previousTelemetry, telemetry, previousPacketAt, receivedAt)) {
      startNewRun("quick_travel", receivedAt);
      return;
    }

    if (telemetry.TimestampMS + 100 < previousTelemetry.TimestampMS) {
      startNewRun("telemetry_reset", receivedAt);
    }
  }

  function startNewRun(reason: string, startedAt = Date.now()) {
    finalizeCurrentRun(reason, startedAt);
    currentRun = createPendingRun(startedAt, reason);
    resetCurrentRunState(reason);
    console.log(`Prepared telemetry run ${currentRun.id} (${reason})`);
  }

  function finalizeCurrentRun(reason: string, endedAt = Date.now()) {
    if (!currentRun.persisted) return null;
    const completed = database.finalizeRun(currentRun.id, endedAt, reason);
    if (completed) state.completedRunsVersion += 1;
    currentRun = createPendingRun(endedAt, reason);
    resetCurrentRunState(reason);
    return completed;
  }

  function resetCurrentRunState(reason: string) {
    telemetryWindow = new TelemetryWindow();
    state.packets = 0;
    state.badPackets = 0;
    state.lastSource = reason;
    state.last = null;
    state.summary = null;
    state.advice = buildTuningAdvice(null, null);
  }

  function ensureCurrentRun(telemetry: Telemetry, receivedAt: number, source: string) {
    const runType = classifyRunType(telemetry);
    if (!currentRun.persisted) {
      currentRun.startedAt = receivedAt;
      currentRun.runType = runType;
      database.startRun({
        id: currentRun.id,
        startedAt: receivedAt,
        splitReason: currentRun.splitReason,
        runType,
        telemetry,
        source
      });
      currentRun.persisted = true;
      console.log(`Started telemetry run ${currentRun.id}`);
    }
    return currentRun;
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
    rawDatabasePath: database.rawPath,
    start,
    stop,
    onState,
    snapshot,
    listRunsPage,
    getRunSummary,
    getRunSampleWindow,
    getRunPath,
    listRunSections,
    getRunSectionSamples,
    setUdpListening,
    logStartup
  };
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
      BestLap: tick > 300 ? 64.2 : 0,
      LastLap: 0,
      CurrentLap: tick > 300 ? tick / 20 : 0,
      CurrentRaceTime: tick > 300 ? tick / 20 : 0,
      LapNumber: tick > 300 ? 1 : 0,
      RacePosition: tick > 300 ? 1 : 0,
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

function createPendingRun(startedAt = Date.now(), splitReason = "start"): PendingRun {
  return {
    id: randomUUID(),
    startedAt,
    persisted: false,
    splitReason,
    runType: null
  };
}

function classifyRunType(telemetry: Telemetry): RunType {
  return telemetry.BestLap > 0
    || telemetry.LastLap > 0
    || telemetry.CurrentLap > 0
    || telemetry.CurrentRaceTime > 0
    || telemetry.LapNumber > 0
    || telemetry.RacePosition > 0
    ? "event"
    : "freeroam";
}

function carIdentityChanged(previous: Telemetry, telemetry: Telemetry) {
  return previous.CarOrdinal !== telemetry.CarOrdinal
    || previous.CarPerformanceIndex !== telemetry.CarPerformanceIndex
    || previous.DrivetrainType !== telemetry.DrivetrainType;
}

function quickTravelDetected(previous: Telemetry, telemetry: Telemetry, previousAt: number | null, receivedAt: number) {
  if (!previousAt) return false;
  if (!Number.isFinite(previous.PositionX) || !Number.isFinite(previous.PositionZ)) return false;
  if (!Number.isFinite(telemetry.PositionX) || !Number.isFinite(telemetry.PositionZ)) return false;

  const elapsedMs = receivedAt - previousAt;
  if (elapsedMs <= 0 || elapsedMs > 10000) return false;

  const distance = Math.hypot(telemetry.PositionX - previous.PositionX, telemetry.PositionZ - previous.PositionZ);
  return distance > 1200;
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
