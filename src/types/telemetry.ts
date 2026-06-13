export type AdviceLevel = "idle" | "ok" | "warn" | "alert" | "note";
export type Advice = {
  level: AdviceLevel;
  title: string;
  detail: string;
};

export type Telemetry = {
  IsRaceOn: number;
  TimestampMS: number;
  EngineIdleRpm: number;
  PositionX: number;
  PositionY: number;
  PositionZ: number;
  Speed: number;
  EngineMaxRpm: number;
  CurrentEngineRpm: number;
  AccelerationX: number;
  AccelerationY: number;
  AccelerationZ: number;
  VelocityX: number;
  VelocityY: number;
  VelocityZ: number;
  AngularVelocityX: number;
  AngularVelocityY: number;
  AngularVelocityZ: number;
  Yaw: number;
  Pitch: number;
  Roll: number;
  NormalizedSuspensionTravelFrontLeft: number;
  NormalizedSuspensionTravelFrontRight: number;
  NormalizedSuspensionTravelRearLeft: number;
  NormalizedSuspensionTravelRearRight: number;
  TireSlipRatioFrontLeft: number;
  TireSlipRatioFrontRight: number;
  TireSlipRatioRearLeft: number;
  TireSlipRatioRearRight: number;
  WheelRotationSpeedFrontLeft: number;
  WheelRotationSpeedFrontRight: number;
  WheelRotationSpeedRearLeft: number;
  WheelRotationSpeedRearRight: number;
  WheelOnRumbleStripFrontLeft: number;
  WheelOnRumbleStripFrontRight: number;
  WheelOnRumbleStripRearLeft: number;
  WheelOnRumbleStripRearRight: number;
  WheelInPuddleFrontLeft: number;
  WheelInPuddleFrontRight: number;
  WheelInPuddleRearLeft: number;
  WheelInPuddleRearRight: number;
  SurfaceRumbleFrontLeft: number;
  SurfaceRumbleFrontRight: number;
  SurfaceRumbleRearLeft: number;
  SurfaceRumbleRearRight: number;
  TireSlipAngleFrontLeft: number;
  TireSlipAngleFrontRight: number;
  TireSlipAngleRearLeft: number;
  TireSlipAngleRearRight: number;
  TireTempFrontLeft: number;
  TireTempFrontRight: number;
  TireTempRearLeft: number;
  TireTempRearRight: number;
  TireCombinedSlipFrontLeft: number;
  TireCombinedSlipFrontRight: number;
  TireCombinedSlipRearLeft: number;
  TireCombinedSlipRearRight: number;
  SuspensionTravelMetersFrontLeft: number;
  SuspensionTravelMetersFrontRight: number;
  SuspensionTravelMetersRearLeft: number;
  SuspensionTravelMetersRearRight: number;
  CarOrdinal: number;
  CarClass: number;
  CarPerformanceIndex: number;
  DrivetrainType: number;
  NumCylinders: number;
  CarGroup: number;
  SmashableVelDiff: number;
  SmashableMass: number;
  Power: number;
  Torque: number;
  Boost: number;
  Fuel: number;
  DistanceTraveled: number;
  BestLap: number;
  LastLap: number;
  CurrentLap: number;
  CurrentRaceTime: number;
  LapNumber: number;
  RacePosition: number;
  Accel: number;
  Brake: number;
  Clutch: number;
  HandBrake: number;
  Gear: number;
  Steer: number;
  NormalizedDrivingLine: number;
  NormalizedAIBrakeDifference: number;
  speedKmh: number;
  speedMph: number;
  powerHp: number;
  torqueNm: number;
  throttlePct: number;
  brakePct: number;
  steerPct: number;
  frontSlip: number;
  rearSlip: number;
  slipBalance: number;
  frontTemp: number;
  rearTemp: number;
  tempBalance: number;
  suspensionAvgFront: number;
  suspensionAvgRear: number;
  receivedAt?: number;
};

export type Summary = {
  sampleCount: number;
  windowSeconds: number;
  avgSpeedKmh: number;
  peakSpeedKmh: number;
  avgFrontSlip: number;
  avgRearSlip: number;
  avgSlipBalance: number;
  avgFrontTemp: number;
  avgRearTemp: number;
  minSuspensionFront: number;
  maxSuspensionFront: number;
  minSuspensionRear: number;
  maxSuspensionRear: number;
};

export type AppState = {
  connected: boolean;
  packets: number;
  badPackets: number;
  lastPacketAt?: number | null;
  lastSource?: string | null;
  localIps: string[];
  advice: Advice[];
  telemetry: Telemetry | null;
  summary: Summary | null;
  udpPort: number;
  sessionId?: string;
  runId?: string;
};

export type PathSample = {
  x: number;
  z: number;
  speedKmh: number;
  at: number;
  sampleIndex: number;
  telemetry: Telemetry;
};

export type SvgPoint = {
  x: number;
  y: number;
};
export type CalibrationTransform = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};
export type SvgViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type MapDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startViewBox: SvgViewBox;
  dragging: boolean;
  mode: "pan" | "scrub";
};

export type CornerEffect =
  | "straight"
  | "leftCorner"
  | "rightCorner";
export type CornerPhaseEffect =
  | "cornerEntry"
  | "cornerMid"
  | "cornerExit";
export type MapPathEffect = CornerEffect | CornerPhaseEffect;
export type PathRenderSegment = {
  effect: MapPathEffect;
  points: SvgPoint[];
};
export type CornerSegment = {
  id: number;
  startIndex: number;
  endIndex: number;
  effect: Exclude<CornerEffect, "straight">;
  samples: PathSample[];
};
export type TireMfdTire = {
  id: string;
  temp: number;
  slipAngle: number;
  combinedSlip: number;
  steerAngleDeg: number;
};
export type TelemetryValue = number | string | null | undefined;
export type TelemetryFieldName = Extract<keyof Telemetry, string>;
export type RightPanelTab = "car" | "behavior" | "data";
export type RunSelection = "live" | string;
export type SessionSelection = RunSelection;
export type SessionSummary = {
  id: string;
  startedAt: number;
  lastPacketAt: number | null;
  endedAt: number | null;
  packetCount: number;
  badPacketCount: number;
  runCount: number;
  lastSource: string | null;
};
export type RunSummary = {
  id: string;
  sessionId: string;
  startedAt: number;
  lastPacketAt: number | null;
  endedAt: number | null;
  packetCount: number;
  badPacketCount: number;
  lastSource: string | null;
  splitReason: string | null;
  carOrdinal: number | null;
  carClass: number | null;
  carPerformanceIndex: number | null;
  drivetrainType: number | null;
};
export type SessionWithRuns = {
  session: SessionSummary;
  runs: RunSummary[];
};
export type RunDetail = {
  run: RunSummary;
  samples: Telemetry[];
  summary: Summary | null;
};
export type SessionDetail = RunDetail;
export type DocTelemetryField = {
  name: TelemetryFieldName;
  label: string;
  suffix?: string;
  precision?: number;
  boolean?: boolean;
};
export type DocTelemetrySection = {
  title: string;
  comment: string;
  fields: DocTelemetryField[];
};


export const emptyState: AppState = {
  connected: false,
  packets: 0,
  badPackets: 0,
  localIps: [],
  advice: [],
  telemetry: null,
  summary: null,
  udpPort: 9999
};
