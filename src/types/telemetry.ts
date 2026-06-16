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
  udpListening: boolean;
  runId?: string;
  completedRunsVersion?: number;
};

export type PathSample = {
  x: number;
  z: number;
  speedKmh: number;
  at: number;
  sampleIndex: number;
  telemetry: Telemetry | null;
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
export type DashboardTab = "car" | "corner" | "straights";
export type AppPage = "live" | "runs" | "cars";
export type RunTelemetrySet = {
  runId: string;
  label: string;
  samples: Telemetry[];
};
export type RunType = "freeroam" | "event";
export type RunStatus = "active" | "completed";
export type RunSummary = {
  id: string;
  status: RunStatus;
  runType: RunType;
  startedAt: number;
  lastPacketAt: number | null;
  endedAt: number | null;
  packetCount: number;
  lastSource: string | null;
  splitReason: string | null;
  endReason: string | null;
  carOrdinal: number | null;
  carClass: number | null;
  carPerformanceIndex: number | null;
  drivetrainType: number | null;
  numCylinders: number | null;
  carGroup: number | null;
  pathPointCount: number;
  summary: Summary | null;
};
export type RunDetail = {
  run: RunSummary;
  path: PathSample[];
  sampleWindow: RunSampleWindow;
};
export type RunSampleWindow = {
  start: number;
  total: number;
  samples: Telemetry[];
};
export type RunsPage = {
  runs: RunSummary[];
  nextCursor: string | null;
  previousCursor: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};
export type RunsPageQuery = {
  cursor?: string | null;
  direction?: "next" | "previous";
  limit?: number;
};
export type RunSampleWindowQuery = {
  runId: string;
  start?: number;
  limit?: number;
};
export type RunSectionType = "corner" | "straight";
export type RunSection = {
  id: string;
  runId: string;
  type: RunSectionType;
  index: number;
  sampleStart: number;
  sampleEnd: number;
  distanceMeters: number;
  durationMs: number;
  metrics: Record<string, number | string>;
  previewPath: Omit<PathSample, "telemetry">[];
};
export type RunSectionPage = {
  runId: string;
  type: RunSectionType;
  page: number;
  limit: number;
  total: number;
  sections: RunSection[];
};
export type RunSectionPageQuery = {
  runId: string;
  type: RunSectionType;
  page?: number;
  limit?: number;
};
export type RunSectionSamples = {
  section: RunSection;
  samples: Telemetry[];
};
export type RunSectionSamplesQuery = {
  runId: string;
  sectionId: string;
};
export type CarCatalogSortKey =
  | "make"
  | "year"
  | "carName"
  | "carClass"
  | "pi"
  | "carOrdinal"
  | "powerHp"
  | "weightLb"
  | "popularityPercent";
export type CarCatalogSortDirection = "asc" | "desc";
export type CarCatalogQuery = {
  search?: string;
  sortBy?: CarCatalogSortKey;
  sortDirection?: CarCatalogSortDirection;
};
export type CarCatalogItem = {
  id: string;
  sourceIndex: number;
  make: string;
  year: number | null;
  carName: string;
  model: string | null;
  carType: string | null;
  carClass: string | null;
  pi: number | null;
  country: string | null;
  collection: string[];
  addOns: string[];
  rarity: string | null;
  credits: number | null;
  unlock: string | null;
  popularityPercent: number | null;
  speed: number | null;
  handling: number | null;
  acceleration: number | null;
  launch: number | null;
  braking: number | null;
  offroad: number | null;
  powerHp: number | null;
  torqueLbFt: number | null;
  weightLb: number | null;
  frontPercent: number | null;
  displacementLiters: number | null;
  drive: number | null;
  carOrdinal: number | null;
  carOrdinalAsset: string | null;
  carOrdinalInternalPath: string | null;
  carOrdinalMatchConfidence: string | null;
  iconUrl: string | null;
  detailUrl: string | null;
  manufacturerLogoUrl: string | null;
};
export type CarCatalogResult = {
  cars: CarCatalogItem[];
  total: number;
  matched: number;
};
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
  udpPort: 9999,
  udpListening: false,
  completedRunsVersion: 0
};
