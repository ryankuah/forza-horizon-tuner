import React from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Clock3,
  Copy,
  Crosshair,
  Gauge,
  History,
  Minus,
  OctagonAlert,
  Plus,
  RotateCcw,
  Trash2,
  Wrench,
} from "lucide-react";
import "./main.css";

const MAX_PATH_POINTS = 5000;
const MIN_PATH_STEP_METERS = 1.5;
const MIN_IMPACT_EVENT_GAP_MS = 1500;
const MIN_IMPACT_EVENT_GAP_METERS = 25;
const MIN_IMPACT_SPEED_DROP_MPS = 5;
const MIN_IMPACT_DECEL_MPS2 = 18;
const MIN_IMPACT_HORIZONTAL_ACCEL_MPS2 = 24;
const MIN_SMASHABLE_IMPACT_VEL_DIFF = 4;
const MAP_EFFECT_SMOOTH_RADIUS = 3;
const MIN_MAP_EFFECT_RUN_POINTS = 6;
const MAP_IMAGE_URL = "/fh6-map-reveal.jpg";
const MAP_IMAGE_WIDTH = 2160;
const MAP_IMAGE_HEIGHT = 2700;
const CAR_FOLLOW_MAP_ZOOM = 8;
const MAX_MAP_ZOOM = CAR_FOLLOW_MAP_ZOOM * 8;
const MAP_ZOOM_STEP = 1.35;
const MAP_DRAG_THRESHOLD_PX = 4;

const MAP_CALIBRATION_STORAGE_KEY = "fh6MapCalibration";
const MAP_CALIBRATION_VIEWBOX_STORAGE_KEY = "fh6MapCalibrationViewBox";

const FH6_MAP_PIXELS_PER_WORLD_METER = 0.13158;

const DEFAULT_MAP_CALIBRATION: CalibrationTransform = {
  a: FH6_MAP_PIXELS_PER_WORLD_METER,
  b: 0,
  c: 1160.32838497,
  d: 0,
  e: -FH6_MAP_PIXELS_PER_WORLD_METER,
  f: 1321.0827332
};

type AdviceLevel = "idle" | "ok" | "warn" | "alert" | "note";
type SocketState = "connecting" | "open" | "closed" | "error";

type Advice = {
  level: AdviceLevel;
  title: string;
  detail: string;
};

type Telemetry = {
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

type Summary = {
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

type AppState = {
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
  httpPort: number;
  wsPort: number;
  sessionId?: string;
};

type PathSample = {
  x: number;
  z: number;
  speedKmh: number;
  at: number;
  telemetry: Telemetry;
};

type SvgPoint = {
  x: number;
  y: number;
};
type CalibrationTransform = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};
type CalibrationPoint = {
  id: string;
  worldX: number;
  worldZ: number;
  mapX: number;
  mapY: number;
  capturedAt: number;
};
type SvgViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type MapDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startViewBox: SvgViewBox;
  dragging: boolean;
};

type MapEffect =
  | "normal"
  | "understeer"
  | "oversteer"
  | "wheelspin";
type PathRenderSegment = {
  effect: MapEffect;
  points: SvgPoint[];
};
type PathEventMarker = {
  event: "impact";
  point: SvgPoint;
  sampleIndex: number;
};
type TelemetryValue = number | string | null | undefined;
type TelemetryFieldName = Extract<keyof Telemetry, string>;
type RightPanelTab = "data" | "tuning";
type SessionSelection = "live" | string;
type SessionSummary = {
  id: string;
  startedAt: number;
  lastPacketAt: number | null;
  endedAt: number | null;
  packetCount: number;
  badPacketCount: number;
  lastSource: string | null;
  carOrdinal: number | null;
  carClass: number | null;
  carPerformanceIndex: number | null;
  drivetrainType: number | null;
};
type SessionDetail = {
  session: SessionSummary;
  samples: Telemetry[];
  summary: Summary | null;
};
type DocTelemetryField = {
  name: TelemetryFieldName;
  label: string;
  suffix?: string;
  precision?: number;
  boolean?: boolean;
};
type DocTelemetrySection = {
  title: string;
  comment: string;
  fields: DocTelemetryField[];
};

const emptyState: AppState = {
  connected: false,
  packets: 0,
  badPackets: 0,
  localIps: [],
  advice: [],
  telemetry: null,
  summary: null,
  udpPort: 9999,
  httpPort: 3001,
  wsPort: 8765
};

const panelClass = "rounded-lg border border-white/[0.12] bg-[#111614]/80";
const labelClass = "text-xs font-semibold text-[#9ba6a1]";

const docTelemetrySections: DocTelemetrySection[] = [
  {
    title: "Race state",
    comment: "True when the race is active; false when in menus or when racing is stopped.",
    fields: [{ name: "IsRaceOn", label: "Race on", boolean: true }]
  },
  {
    title: "Timestamp",
    comment: "Can overflow to 0 eventually.",
    fields: [{ name: "TimestampMS", label: "Timestamp", suffix: " ms" }]
  },
  {
    title: "Engine RPM values",
    comment: "Engine RPM values.",
    fields: [
      { name: "EngineMaxRpm", label: "Max", suffix: " rpm" },
      { name: "EngineIdleRpm", label: "Idle", suffix: " rpm" },
      { name: "CurrentEngineRpm", label: "Current", suffix: " rpm" }
    ]
  },
  {
    title: "Acceleration",
    comment: "In the car's local space; X = right, Y = up, Z = forward.",
    fields: [
      { name: "AccelerationX", label: "X", precision: 3 },
      { name: "AccelerationY", label: "Y", precision: 3 },
      { name: "AccelerationZ", label: "Z", precision: 3 }
    ]
  },
  {
    title: "Velocity",
    comment: "In the car's local space; X = right, Y = up, Z = forward.",
    fields: [
      { name: "VelocityX", label: "X", suffix: " m/s", precision: 2 },
      { name: "VelocityY", label: "Y", suffix: " m/s", precision: 2 },
      { name: "VelocityZ", label: "Z", suffix: " m/s", precision: 2 }
    ]
  },
  {
    title: "Angular velocity",
    comment: "Angular velocity in the car's local space (rad/s); X = pitch, Y = yaw, Z = roll.",
    fields: [
      { name: "AngularVelocityX", label: "X", precision: 3 },
      { name: "AngularVelocityY", label: "Y", precision: 3 },
      { name: "AngularVelocityZ", label: "Z", precision: 3 }
    ]
  },
  {
    title: "Car orientation",
    comment: "Car orientation (radians).",
    fields: [
      { name: "Yaw", label: "Yaw", precision: 3 },
      { name: "Pitch", label: "Pitch", precision: 3 },
      { name: "Roll", label: "Roll", precision: 3 }
    ]
  },
  {
    title: "Normalized suspension travel",
    comment: "Suspension travel normalized: 0.0f = max stretch; 1.0 = max compression.",
    fields: [
      { name: "NormalizedSuspensionTravelFrontLeft", label: "Front left", precision: 3 },
      { name: "NormalizedSuspensionTravelFrontRight", label: "Front right", precision: 3 },
      { name: "NormalizedSuspensionTravelRearLeft", label: "Rear left", precision: 3 },
      { name: "NormalizedSuspensionTravelRearRight", label: "Rear right", precision: 3 }
    ]
  },
  {
    title: "Tire slip ratio",
    comment: "Tire normalized slip ratio, = 0 means 100% grip and |ratio| > 1.0 means loss of grip.",
    fields: [
      { name: "TireSlipRatioFrontLeft", label: "Front left", precision: 3 },
      { name: "TireSlipRatioFrontRight", label: "Front right", precision: 3 },
      { name: "TireSlipRatioRearLeft", label: "Rear left", precision: 3 },
      { name: "TireSlipRatioRearRight", label: "Rear right", precision: 3 }
    ]
  },
  {
    title: "Wheel rotation speed",
    comment: "Wheel rotation speed radians/sec.",
    fields: [
      { name: "WheelRotationSpeedFrontLeft", label: "Front left", precision: 2 },
      { name: "WheelRotationSpeedFrontRight", label: "Front right", precision: 2 },
      { name: "WheelRotationSpeedRearLeft", label: "Rear left", precision: 2 },
      { name: "WheelRotationSpeedRearRight", label: "Rear right", precision: 2 }
    ]
  },
  {
    title: "Wheel on rumble strip",
    comment: "True when the wheel is on a rumble strip; false when off.",
    fields: [
      { name: "WheelOnRumbleStripFrontLeft", label: "Front left", boolean: true },
      { name: "WheelOnRumbleStripFrontRight", label: "Front right", boolean: true },
      { name: "WheelOnRumbleStripRearLeft", label: "Rear left", boolean: true },
      { name: "WheelOnRumbleStripRearRight", label: "Rear right", boolean: true }
    ]
  },
  {
    title: "Wheel in puddle",
    comment: "True when the wheel is in a puddle; false when not.",
    fields: [
      { name: "WheelInPuddleFrontLeft", label: "Front left", boolean: true },
      { name: "WheelInPuddleFrontRight", label: "Front right", boolean: true },
      { name: "WheelInPuddleRearLeft", label: "Rear left", boolean: true },
      { name: "WheelInPuddleRearRight", label: "Rear right", boolean: true }
    ]
  },
  {
    title: "Surface rumble",
    comment: "Non-dimensional surface rumble values passed to controller force feedback.",
    fields: [
      { name: "SurfaceRumbleFrontLeft", label: "Front left", precision: 3 },
      { name: "SurfaceRumbleFrontRight", label: "Front right", precision: 3 },
      { name: "SurfaceRumbleRearLeft", label: "Rear left", precision: 3 },
      { name: "SurfaceRumbleRearRight", label: "Rear right", precision: 3 }
    ]
  },
  {
    title: "Tire slip angle",
    comment: "Tire normalized slip angle, = 0 means 100% grip and |angle| > 1.0 means loss of grip.",
    fields: [
      { name: "TireSlipAngleFrontLeft", label: "Front left", precision: 3 },
      { name: "TireSlipAngleFrontRight", label: "Front right", precision: 3 },
      { name: "TireSlipAngleRearLeft", label: "Rear left", precision: 3 },
      { name: "TireSlipAngleRearRight", label: "Rear right", precision: 3 }
    ]
  },
  {
    title: "Tire combined slip",
    comment: "Tire normalized combined slip, = 0 means 100% grip and |slip| > 1.0 means loss of grip.",
    fields: [
      { name: "TireCombinedSlipFrontLeft", label: "Front left", precision: 3 },
      { name: "TireCombinedSlipFrontRight", label: "Front right", precision: 3 },
      { name: "TireCombinedSlipRearLeft", label: "Rear left", precision: 3 },
      { name: "TireCombinedSlipRearRight", label: "Rear right", precision: 3 }
    ]
  },
  {
    title: "Suspension travel meters",
    comment: "Actual suspension travel in meters.",
    fields: [
      { name: "SuspensionTravelMetersFrontLeft", label: "Front left", suffix: " m", precision: 3 },
      { name: "SuspensionTravelMetersFrontRight", label: "Front right", suffix: " m", precision: 3 },
      { name: "SuspensionTravelMetersRearLeft", label: "Rear left", suffix: " m", precision: 3 },
      { name: "SuspensionTravelMetersRearRight", label: "Rear right", suffix: " m", precision: 3 }
    ]
  },
  {
    title: "Car",
    comment: "Unique ID of the car make/model.",
    fields: [{ name: "CarOrdinal", label: "Ordinal" }]
  },
  {
    title: "Class",
    comment: "Between 0 (D -- worst cars) and 7 (X class -- best cars) inclusive.",
    fields: [{ name: "CarClass", label: "Class" }]
  },
  {
    title: "Performance index",
    comment: "Between 100 (worst car) and 999 (best car) inclusive.",
    fields: [{ name: "CarPerformanceIndex", label: "PI" }]
  },
  {
    title: "Drivetrain",
    comment: "0 = FWD, 1 = RWD, 2 = AWD.",
    fields: [{ name: "DrivetrainType", label: "Type" }]
  },
  {
    title: "Engine cylinders",
    comment: "Number of cylinders in the engine.",
    fields: [{ name: "NumCylinders", label: "Cylinders" }]
  },
  {
    title: "Car group",
    comment: "Car group identifier.",
    fields: [{ name: "CarGroup", label: "Group" }]
  },
  {
    title: "Smashable velocity difference",
    comment: "Velocity loss from smashable object collision (m/s).",
    fields: [{ name: "SmashableVelDiff", label: "Velocity difference", suffix: " m/s", precision: 3 }]
  },
  {
    title: "Smashable mass",
    comment: "Mass of recently hit smashable object (kg).",
    fields: [{ name: "SmashableMass", label: "Mass", suffix: " kg", precision: 3 }]
  },
  {
    title: "Position",
    comment: "Position in world space (meters).",
    fields: [
      { name: "PositionX", label: "X", suffix: " m", precision: 2 },
      { name: "PositionY", label: "Y", suffix: " m", precision: 2 },
      { name: "PositionZ", label: "Z", suffix: " m", precision: 2 }
    ]
  },
  {
    title: "Speed",
    comment: "Speed in meters per second.",
    fields: [{ name: "Speed", label: "Speed", suffix: " m/s", precision: 3 }]
  },
  {
    title: "Power",
    comment: "Power in watts.",
    fields: [{ name: "Power", label: "Power", suffix: " W" }]
  },
  {
    title: "Torque",
    comment: "Torque in newton-meters.",
    fields: [{ name: "Torque", label: "Torque", suffix: " Nm", precision: 1 }]
  },
  {
    title: "Tire temperature",
    comment: "Tire temperature.",
    fields: [
      { name: "TireTempFrontLeft", label: "Front left", precision: 1 },
      { name: "TireTempFrontRight", label: "Front right", precision: 1 },
      { name: "TireTempRearLeft", label: "Rear left", precision: 1 },
      { name: "TireTempRearRight", label: "Rear right", precision: 1 }
    ]
  },
  {
    title: "Boost",
    comment: "Turbo/supercharger boost (PSI above atmospheric).",
    fields: [{ name: "Boost", label: "Boost", suffix: " psi", precision: 2 }]
  },
  {
    title: "Fuel",
    comment: "Fuel level (0.0 = empty, 1.0 = full).",
    fields: [{ name: "Fuel", label: "Fuel", precision: 3 }]
  },
  {
    title: "Distance traveled",
    comment: "Total distance traveled (meters).",
    fields: [{ name: "DistanceTraveled", label: "Distance", suffix: " m", precision: 1 }]
  },
  {
    title: "Lap times",
    comment: "Lap times (seconds); 0.0 if not applicable.",
    fields: [
      { name: "BestLap", label: "Best", suffix: " s", precision: 3 },
      { name: "LastLap", label: "Last", suffix: " s", precision: 3 },
      { name: "CurrentLap", label: "Current", suffix: " s", precision: 3 }
    ]
  },
  {
    title: "Race time",
    comment: "Total race time (seconds since driving started).",
    fields: [{ name: "CurrentRaceTime", label: "Current", suffix: " s", precision: 3 }]
  },
  {
    title: "Lap number",
    comment: "Number of laps completed.",
    fields: [{ name: "LapNumber", label: "Lap" }]
  },
  {
    title: "Race position",
    comment: "Current race position.",
    fields: [{ name: "RacePosition", label: "Position" }]
  },
  {
    title: "Player inputs",
    comment: "Player inputs (0 to 255).",
    fields: [
      { name: "Accel", label: "Accelerator" },
      { name: "Brake", label: "Brake" },
      { name: "Clutch", label: "Clutch" },
      { name: "HandBrake", label: "Handbrake" }
    ]
  },
  {
    title: "Gear",
    comment: "Current gear.",
    fields: [{ name: "Gear", label: "Gear" }]
  },
  {
    title: "Steer",
    comment: "Steering input (-127 = full left, 0 = center, 127 = full right).",
    fields: [{ name: "Steer", label: "Steer" }]
  },
  {
    title: "Driving line",
    comment: "Normalized driving line position (-127 to 127).",
    fields: [{ name: "NormalizedDrivingLine", label: "Line" }]
  },
  {
    title: "AI brake difference",
    comment: "Normalized AI braking difference (-127 to 127).",
    fields: [{ name: "NormalizedAIBrakeDifference", label: "Difference" }]
  }
];

function MapCalibrationPage() {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const dragRef = React.useRef<MapDragState | null>(null);
  const [state, setState] = React.useState<AppState>(emptyState);
  const [points, setPoints] = React.useState<CalibrationPoint[]>([]);
  const [viewBox, setViewBox] = React.useState<SvgViewBox>(() => loadStoredMapViewBox() ?? initialMapViewBox());
  const transform = React.useMemo(() => solveCalibrationTransform(points), [points]);
  const currentMapPoint = state.telemetry && transform ? worldTelemetryToMapPoint(state.telemetry, transform) : null;
  const residual = transform ? calibrationResidual(points, transform) : null;
  const canZoomIn = viewBox.width > MAP_IMAGE_WIDTH / MAX_MAP_ZOOM;
  const canZoomOut = viewBox.width < MAP_IMAGE_WIDTH;
  const zoomPct = mapZoomPercent(viewBox);
  const output = transform ? formatCalibrationForCode(transform) : "";

  React.useEffect(() => {
    const host = window.location.hostname || "localhost";
    const socket = new WebSocket(`ws://${host}:8765`);

    socket.addEventListener("message", (event) => {
      setState(JSON.parse(event.data) as AppState);
    });

    return () => socket.close();
  }, []);

  React.useEffect(() => {
    window.sessionStorage.setItem(MAP_CALIBRATION_VIEWBOX_STORAGE_KEY, JSON.stringify(viewBox));
  }, [viewBox]);

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!svgRef.current) return;

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startClientX;
    const deltaY = event.clientY - drag.startClientY;
    if (!drag.dragging && Math.hypot(deltaX, deltaY) > MAP_DRAG_THRESHOLD_PX) {
      drag.dragging = true;
    }

    if (drag.dragging) {
      event.preventDefault();
      setViewBox(clampMapViewBox({
        ...drag.startViewBox,
        x: drag.startViewBox.x - deltaX * (drag.startViewBox.width / svgRef.current.clientWidth),
        y: drag.startViewBox.y - deltaY * (drag.startViewBox.height / svgRef.current.clientHeight)
      }));
    }
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (!svgRef.current) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startViewBox: viewBox,
      dragging: false
    };
    svgRef.current.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    if (!svgRef.current) return;

    const drag = dragRef.current;
    dragRef.current = null;
    if (svgRef.current.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
    const telemetry = state.telemetry;
    if (drag?.dragging || !telemetry) return;

    const mapPoint = clientPointToSvgPoint(svgRef.current, event);
    if (!mapPoint) return;
    setPoints((current) => [
      ...current,
      {
        id: `${Date.now()}-${current.length}`,
        worldX: telemetry.PositionX,
        worldZ: telemetry.PositionZ,
        mapX: mapPoint.x,
        mapY: mapPoint.y,
        capturedAt: Date.now()
      }
    ]);
  }

  function handlePointerCancel(event: React.PointerEvent<SVGSVGElement>) {
    dragRef.current = null;
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
  }

  function handleWheel(event: React.WheelEvent<SVGSVGElement>) {
    if (!svgRef.current) return;

    event.preventDefault();
    const cursor = clientCoordinatesToSvgPoint(svgRef.current, event.clientX, event.clientY);
    setViewBox((current) => zoomViewBoxAtPoint(current, cursor ?? viewBoxCenter(current), event.deltaY > 0 ? MAP_ZOOM_STEP : 1 / MAP_ZOOM_STEP));
  }

  async function copyOutput() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
  }

  function saveOutput() {
    if (!transform) return;
    window.localStorage.setItem(MAP_CALIBRATION_STORAGE_KEY, JSON.stringify(transform));
    resetActiveMapCalibration();
  }

  return (
    <main className="grid h-screen min-h-0 grid-cols-[minmax(0,1fr)_360px] gap-4 overflow-hidden bg-[#101312] p-4 text-[#e8ecef] antialiased">
      <section className="relative min-h-0 overflow-hidden rounded-lg border border-white/10 bg-[#070a09]">
        <svg
          ref={svgRef}
          className="block h-full w-full cursor-crosshair touch-none"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          role="img"
          aria-label="FH6 map calibration"
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onWheel={handleWheel}
        >
          <image href={MAP_IMAGE_URL} x="0" y="0" width={MAP_IMAGE_WIDTH} height={MAP_IMAGE_HEIGHT} preserveAspectRatio="none" />
          <rect width="100%" height="100%" fill="rgba(7,10,9,0.10)" />
          {points.map((point, index) => (
            <g key={point.id} transform={`translate(${point.mapX} ${point.mapY})`}>
              <circle className="fill-[#63da97]/20 stroke-[#63da97] [stroke-width:2] [vector-effect:non-scaling-stroke]" r="18" />
              <text className="fill-[#101312] text-xl font-black [paint-order:stroke] [stroke:#63da97] [stroke-width:6px]" dominantBaseline="middle" textAnchor="middle">
                {index + 1}
              </text>
            </g>
          ))}
          {currentMapPoint ? (
            <g transform={`translate(${currentMapPoint.x} ${currentMapPoint.y})`}>
              <circle className="fill-[#f3d09b]/10 stroke-[#f3d09b] [stroke-dasharray:6_5] [stroke-width:2] [vector-effect:non-scaling-stroke]" r="26" />
              <Crosshair className="fill-none stroke-[#f3d09b] [stroke-width:2] [vector-effect:non-scaling-stroke]" x="-12" y="-12" width="24" height="24" />
            </g>
          ) : null}
        </svg>
        <MapControls
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
          zoomPct={zoomPct}
          onZoomIn={() => setViewBox((current) => zoomViewBoxAtPoint(current, viewBoxCenter(current), 1 / MAP_ZOOM_STEP))}
          onZoomOut={() => setViewBox((current) => zoomViewBoxAtPoint(current, viewBoxCenter(current), MAP_ZOOM_STEP))}
          onReset={() => setViewBox(initialMapViewBox())}
        />
      </section>

      <aside className={`${panelClass} flex min-h-0 flex-col gap-4 p-4`}>
        <div>
          <h1 className="m-0 text-lg font-bold text-[#f5f7f6]">Map calibration</h1>
          <p className="mt-2 text-sm leading-5 text-[#b5bfb9]">
            Drive to a known spot, click that spot on the map, then repeat.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MetricCell label="Live X" value={state.telemetry?.PositionX} precision={2} />
          <MetricCell label="Live Z" value={state.telemetry?.PositionZ} precision={2} />
          <MetricCell label="Points" value={points.length} precision={0} />
          <MetricCell label="Error" value={residual?.averagePx} suffix=" px" precision={1} tone={residual && residual.averagePx > 40 ? "warn" : "ok"} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-[#070a09]/55">
          {points.length ? (
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-[#070a09] text-[#9ba6a1]">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">World</th>
                  <th className="px-3 py-2">Map</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {points.map((point, index) => (
                  <tr key={point.id} className="border-t border-white/10">
                    <td className="px-3 py-2 font-bold text-[#f5f7f6]">{index + 1}</td>
                    <td className="px-3 py-2 tabular-nums text-[#c7d0cb]">
                      {point.worldX.toFixed(1)}, {point.worldZ.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-[#c7d0cb]">
                      {point.mapX.toFixed(0)}, {point.mapY.toFixed(0)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="inline-grid h-7 w-7 cursor-pointer place-items-center rounded-md text-[#b5bfb9] transition hover:bg-white/[0.08] hover:text-[#f5f7f6]"
                        onClick={() => setPoints((current) => current.filter((candidate) => candidate.id !== point.id))}
                        aria-label={`Remove point ${index + 1}`}
                        title="Remove point"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="grid h-full place-items-center px-5 text-center text-sm text-[#9ba6a1]">
              Click the map to pair the current telemetry position with a map pixel.
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <textarea
            className="h-36 resize-none rounded-lg border border-white/10 bg-[#070a09]/70 p-3 font-mono text-xs text-[#dfe5e2] outline-none"
            readOnly
            value={output || "Add at least 2 calibration points."}
          />
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#070a09]/70 text-sm font-bold text-[#f5f7f6] transition hover:border-[#f3d09b]/50 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!output}
              onClick={copyOutput}
            >
              <Copy size={15} /> Copy
            </button>
            <button
              type="button"
              className="h-10 cursor-pointer rounded-lg border border-white/10 bg-[#070a09]/70 text-sm font-bold text-[#f5f7f6] transition hover:border-[#63da97]/50 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!transform}
              onClick={saveOutput}
            >
              Save
            </button>
            <button
              type="button"
              className="h-10 cursor-pointer rounded-lg border border-white/10 bg-[#070a09]/70 text-sm font-bold text-[#f5f7f6] transition hover:border-[#e46645]/50 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!points.length}
              onClick={() => setPoints([])}
            >
              Clear
            </button>
          </div>
        </div>
      </aside>
    </main>
  );
}

function App() {
  const [state, setState] = React.useState<AppState>(emptyState);
  const [path, setPath] = React.useState<PathSample[]>([]);
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  const [rightPanelTab, setRightPanelTab] = React.useState<RightPanelTab>("tuning");
  const [sessions, setSessions] = React.useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = React.useState<SessionSelection>("live");
  const [sessionDetail, setSessionDetail] = React.useState<SessionDetail | null>(null);
  const liveSessionIdRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    const host = window.location.hostname || "localhost";
    const socket = new WebSocket(`ws://${host}:8765`);

    socket.addEventListener("message", (event) => {
      const nextState = JSON.parse(event.data) as AppState;
      const sessionChanged = liveSessionIdRef.current && liveSessionIdRef.current !== nextState.sessionId;
      liveSessionIdRef.current = nextState.sessionId;
      setState(nextState);
      setPath((currentPath) => addTelemetryPoint(sessionChanged ? [] : currentPath, nextState.telemetry));
    });

    return () => socket.close();
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const loadSessions = async () => {
      const nextSessions = await fetchSessions();
      if (!cancelled) setSessions(nextSessions);
    };

    loadSessions();
    const interval = window.setInterval(loadSessions, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  React.useEffect(() => {
    if (selectedSessionId === "live") {
      setSessionDetail(null);
      return;
    }

    let cancelled = false;
    fetchSessionDetail(selectedSessionId).then((detail) => {
      if (!cancelled) setSessionDetail(detail);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedSessionId]);

  React.useEffect(() => {
    if (state.connected || selectedSessionId !== "live") return;
    if (sessions[0]) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [selectedSessionId, sessions, state.connected]);

  React.useEffect(() => {
    const activePathLength = selectedSessionId === "live" ? path.length : buildPathFromTelemetry(sessionDetail?.samples ?? []).length;
    if (hoverIndex !== null && hoverIndex >= activePathLength) {
      setHoverIndex(null);
    }
    if (selectedIndex !== null && selectedIndex >= activePathLength) {
      setSelectedIndex(null);
    }
  }, [hoverIndex, path.length, selectedIndex, selectedSessionId, sessionDetail]);

  const historicalPath = React.useMemo(
    () => buildPathFromTelemetry(sessionDetail?.samples ?? []),
    [sessionDetail]
  );
  const displayPath = selectedSessionId === "live" ? path : historicalPath;
  const latestSample = displayPath[displayPath.length - 1] ?? null;
  const hoverSample = hoverIndex === null ? null : displayPath[hoverIndex];
  const selectedSample = selectedIndex === null ? null : displayPath[selectedIndex];
  const activeSample = hoverSample ?? selectedSample ?? latestSample;
  const telemetry = activeSample?.telemetry ?? (selectedSessionId === "live" ? state.telemetry : sessionDetail?.samples.at(-1) ?? null);
  const displayState = selectedSessionId === "live"
    ? state
    : buildHistoricalState(state, sessionDetail, telemetry);

  return (
    <main
      className="h-screen overflow-hidden bg-[#101312] bg-[radial-gradient(circle_at_80%_10%,rgba(199,58,31,0.18),transparent_28%),linear-gradient(120deg,rgba(35,75,69,0.45),transparent_38%)] p-4 text-[#e8ecef] antialiased md:p-6"
      onPointerMove={(event) => {
        if (!(event.target as Element).closest("[data-path-surface]")) {
          setHoverIndex(null);
        }
      }}
    >
      <section className="grid h-full min-h-0 gap-4 lg:grid-cols-2">
        <section className="grid min-h-0 min-w-0 grid-rows-[minmax(0,7fr)_minmax(150px,3fr)] gap-4">
          <div className="min-h-0">
            <PathPanel
              path={displayPath}
              hoverIndex={hoverIndex}
              selectedIndex={selectedIndex}
              onHoverIndex={setHoverIndex}
              onSelectIndex={setSelectedIndex}
            />
          </div>
          <LiveInputsPanel telemetry={telemetry} />
        </section>

        <section className="flex min-h-0 min-w-0 flex-col">
          <RightPanel
            activeTab={rightPanelTab}
            onTabChange={setRightPanelTab}
            telemetry={telemetry}
            state={displayState}
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            onSessionChange={(sessionId) => {
              setSelectedSessionId(sessionId);
              setHoverIndex(null);
              setSelectedIndex(null);
            }}
            onNewSession={async () => {
              const created = await createNewSession();
              const nextSessions = await fetchSessions();
              setSessions(nextSessions);
              setSelectedSessionId(created ? "live" : nextSessions[0]?.id ?? "live");
              setHoverIndex(null);
              setSelectedIndex(null);
              setPath([]);
            }}
          />
        </section>
      </section>
    </main>
  );
}

function addTelemetryPoint(currentPath: PathSample[], telemetry: Telemetry | null) {
  if (!telemetry || telemetry.IsRaceOn !== 1) return currentPath;
  if (!Number.isFinite(telemetry.PositionX) || !Number.isFinite(telemetry.PositionZ)) return currentPath;

  const point: PathSample = {
    x: telemetry.PositionX,
    z: telemetry.PositionZ,
    speedKmh: telemetry.speedKmh || 0,
    at: telemetry.receivedAt || Date.now(),
    telemetry
  };
  const previous = currentPath[currentPath.length - 1];

  if (previous) {
    const distance = Math.hypot(point.x - previous.x, point.z - previous.z);
    if (distance < MIN_PATH_STEP_METERS) return currentPath;
  }

  const nextPath = [...currentPath, point];
  return nextPath.length > MAX_PATH_POINTS
    ? nextPath.slice(nextPath.length - MAX_PATH_POINTS)
    : nextPath;
}

async function fetchSessions() {
  try {
    const response = await fetch(`${apiBaseUrl()}/api/sessions`);
    if (!response.ok) return [];
    const data = await response.json() as { sessions: SessionSummary[] };
    return data.sessions;
  } catch {
    return [];
  }
}

async function fetchSessionDetail(sessionId: string) {
  try {
    const response = await fetch(`${apiBaseUrl()}/api/sessions/${sessionId}?limit=50000`);
    if (!response.ok) return null;
    return await response.json() as SessionDetail;
  } catch {
    return null;
  }
}

async function createNewSession() {
  try {
    const response = await fetch(`${apiBaseUrl()}/api/sessions/new`, { method: "POST" });
    return response.ok;
  } catch {
    return false;
  }
}

function apiBaseUrl() {
  const host = window.location.hostname || "localhost";
  return `http://${host}:3001`;
}

function buildPathFromTelemetry(samples: Telemetry[]) {
  return samples.reduce<PathSample[]>((currentPath, telemetry) => addTelemetryPoint(currentPath, telemetry), []);
}

function buildHistoricalState(liveState: AppState, detail: SessionDetail | null, telemetry: Telemetry | null): AppState {
  const session = detail?.session;
  return {
    ...liveState,
    connected: false,
    packets: session?.packetCount ?? 0,
    badPackets: session?.badPacketCount ?? 0,
    lastPacketAt: session?.lastPacketAt ?? null,
    lastSource: session?.lastSource ?? "stored session",
    telemetry,
    summary: detail?.summary ?? null,
    sessionId: session?.id
  };
}

function PathPanel({
  path,
  hoverIndex,
  selectedIndex,
  onHoverIndex,
  onSelectIndex
}: {
  path: PathSample[];
  hoverIndex: number | null;
  selectedIndex: number | null;
  onHoverIndex: (index: number | null) => void;
  onSelectIndex: (index: number | null) => void;
}) {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const dragRef = React.useRef<MapDragState | null>(null);
  const [viewBox, setViewBox] = React.useState<SvgViewBox>(() => initialMapViewBox());
  const geometry = buildPathGeometry(path);
  const renderSegments = buildPathRenderSegments(path, geometry.points);
  const eventMarkers = buildPathEventMarkers(path, geometry.points);
  const currentPoint = geometry.points[geometry.points.length - 1];
  const currentSample = path[path.length - 1];
  const hoverPoint = hoverIndex === null ? null : geometry.points[hoverIndex];
  const hoverSample = hoverIndex === null ? null : path[hoverIndex];
  const selectedPoint = selectedIndex === null ? null : geometry.points[selectedIndex];
  const selectedSample = selectedIndex === null ? null : path[selectedIndex];
  const canZoomIn = viewBox.width > geometry.width / MAX_MAP_ZOOM;
  const canZoomOut = viewBox.width < geometry.width;
  const zoomPct = mapZoomPercent(viewBox);

  React.useEffect(() => {
    if (!currentPoint) {
      setViewBox(initialMapViewBox());
      return;
    }

    setViewBox((current) => {
      const width = current.width === MAP_IMAGE_WIDTH
        ? MAP_IMAGE_WIDTH / CAR_FOLLOW_MAP_ZOOM
        : current.width;
      const height = current.height === MAP_IMAGE_HEIGHT
        ? MAP_IMAGE_HEIGHT / CAR_FOLLOW_MAP_ZOOM
        : current.height;

      return centerViewBoxAtPoint(currentPoint, width, height);
    });
  }, [currentPoint?.x, currentPoint?.y]);

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!svgRef.current) return;

    const drag = dragRef.current;
    if (drag && drag.pointerId === event.pointerId) {
      const deltaX = event.clientX - drag.startClientX;
      const deltaY = event.clientY - drag.startClientY;

      if (!drag.dragging && Math.hypot(deltaX, deltaY) > MAP_DRAG_THRESHOLD_PX) {
        drag.dragging = true;
      }

      if (drag.dragging) {
        event.preventDefault();
        onHoverIndex(null);
        setViewBox(clampMapViewBox({
          ...drag.startViewBox,
          x: drag.startViewBox.x - deltaX * (drag.startViewBox.width / svgRef.current.clientWidth),
          y: drag.startViewBox.y - deltaY * (drag.startViewBox.height / svgRef.current.clientHeight)
        }));
        return;
      }
    }

    if (geometry.points.length === 0) return;

    const cursor = clientPointToSvgPoint(svgRef.current, event);
    if (!cursor) return;
    onHoverIndex(nearestPointIndex(geometry.points, cursor));
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (!svgRef.current) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startViewBox: viewBox,
      dragging: false
    };
    svgRef.current.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    if (!svgRef.current) return;

    const drag = dragRef.current;
    dragRef.current = null;
    if (svgRef.current.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
    if (drag?.dragging || geometry.points.length === 0) return;

    const cursor = clientPointToSvgPoint(svgRef.current, event);
    if (!cursor) return;
    onSelectIndex(nearestPointIndex(geometry.points, cursor));
  }

  function handlePointerCancel(event: React.PointerEvent<SVGSVGElement>) {
    dragRef.current = null;
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
  }

  function handleWheel(event: React.WheelEvent<SVGSVGElement>) {
    if (!svgRef.current) return;

    event.preventDefault();
    zoomMapAt(currentPoint ?? viewBoxCenter(viewBox), event.deltaY > 0 ? MAP_ZOOM_STEP : 1 / MAP_ZOOM_STEP);
  }

  function zoomMapAt(focus: SvgPoint, factor: number) {
    setViewBox((current) => {
      const zoomed = zoomViewBoxAtPoint(current, focus, factor);
      return currentPoint
        ? centerViewBoxAtPoint(currentPoint, zoomed.width, zoomed.height)
        : zoomed;
    });
  }

  function zoomMapFromCenter(factor: number) {
    zoomMapAt(currentPoint ?? viewBoxCenter(viewBox), factor);
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div
        data-path-surface
        className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),transparent),rgba(7,10,9,0.62)]"
        onMouseLeave={() => onHoverIndex(null)}
        onPointerLeave={() => onHoverIndex(null)}
      >
        <svg
          className="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          role="img"
          aria-label="Live car map"
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={() => onHoverIndex(null)}
          onWheel={handleWheel}
        >
          <image
            href={MAP_IMAGE_URL}
            x="0"
            y="0"
            width={geometry.width}
            height={geometry.height}
            preserveAspectRatio="none"
          />
          <rect width="100%" height="100%" fill="rgba(7,10,9,0.16)" />
          {geometry.polyline ? (
            <>
              <polyline className="fill-none stroke-[rgba(228,102,69,0.28)] [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:12] [vector-effect:non-scaling-stroke]" points={geometry.polyline} />
              {renderSegments.map((segment, index) => (
                <polyline
                  key={`${segment.effect}-${index}`}
                  className={[
                    "fill-none [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:4] [vector-effect:non-scaling-stroke]",
                    mapEffectStrokeClass(segment.effect)
                  ].join(" ")}
                  points={segment.points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")}
                />
              ))}
            </>
          ) : (
            <text className="fill-[#f5f7f6] text-5xl font-bold [paint-order:stroke] [stroke:#070a09] [stroke-width:8px]" x="50%" y="50%" dominantBaseline="middle" textAnchor="middle">
              Waiting for position samples
            </text>
          )}
          {eventMarkers.map((marker) => (
            <ImpactMarker key={`${marker.event}-${marker.sampleIndex}`} point={marker.point} />
          ))}
          {selectedPoint && selectedSample ? (
            <CarMarker point={selectedPoint} yaw={selectedSample.telemetry.Yaw} variant="selected" />
          ) : null}
          {hoverPoint && hoverSample ? (
            <CarMarker point={hoverPoint} yaw={hoverSample.telemetry.Yaw} variant="hover" />
          ) : null}
          {currentPoint && currentSample ? (
            <CarMarker point={currentPoint} yaw={currentSample.telemetry.Yaw} variant="current" />
          ) : null}
        </svg>
        <MapControls
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
          zoomPct={zoomPct}
          onZoomIn={() => zoomMapFromCenter(1 / MAP_ZOOM_STEP)}
          onZoomOut={() => zoomMapFromCenter(MAP_ZOOM_STEP)}
          onReset={() => {
            setViewBox(currentPoint
              ? centerViewBoxAtPoint(currentPoint, MAP_IMAGE_WIDTH / CAR_FOLLOW_MAP_ZOOM, MAP_IMAGE_HEIGHT / CAR_FOLLOW_MAP_ZOOM)
              : initialMapViewBox()
            );
          }}
        />
        <MapLegend />
      </div>
    </section>
  );
}

function MapControls({
  canZoomIn,
  canZoomOut,
  zoomPct,
  onZoomIn,
  onZoomOut,
  onReset
}: {
  canZoomIn: boolean;
  canZoomOut: boolean;
  zoomPct: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  function stopControlEvent(event: React.SyntheticEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <div
      className="absolute right-3 top-3 flex items-center overflow-hidden rounded-md border border-white/10 bg-[#070a09]/75 text-[#f5f7f6] shadow-[0_12px_30px_rgba(0,0,0,0.22)] backdrop-blur"
      onClick={stopControlEvent}
      onDoubleClick={stopControlEvent}
      onMouseDown={stopControlEvent}
      onMouseMove={(event) => event.stopPropagation()}
      onMouseUp={stopControlEvent}
      onPointerCancel={stopControlEvent}
      onPointerDown={stopControlEvent}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={stopControlEvent}
      onWheel={stopControlEvent}
    >
      <button
        type="button"
        className="grid h-9 w-9 cursor-pointer place-items-center border-r border-white/10 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
        onClick={(event) => {
          stopControlEvent(event);
          onZoomOut();
        }}
        disabled={!canZoomOut}
        aria-label="Zoom out"
        title="Zoom out"
      >
        <Minus size={16} strokeWidth={2.4} />
      </button>
      <span className="min-w-14 px-2 text-center text-[11px] font-bold tabular-nums text-[#c7d0cb]">
        {zoomPct}%
      </span>
      <button
        type="button"
        className="grid h-9 w-9 cursor-pointer place-items-center border-l border-white/10 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
        onClick={(event) => {
          stopControlEvent(event);
          onZoomIn();
        }}
        disabled={!canZoomIn}
        aria-label="Zoom in"
        title="Zoom in"
      >
        <Plus size={16} strokeWidth={2.4} />
      </button>
      <button
        type="button"
        className="grid h-9 w-9 cursor-pointer place-items-center border-l border-white/10 transition hover:bg-white/[0.08]"
        onClick={(event) => {
          stopControlEvent(event);
          onReset();
        }}
        aria-label="Reset map view"
        title="Reset map view"
      >
        <RotateCcw size={15} strokeWidth={2.3} />
      </button>
    </div>
  );
}

function CarMarker({ point, yaw, variant }: { point: SvgPoint; yaw: number; variant: "current" | "hover" | "selected" }) {
  const rotation = yawToSvgDegrees(yaw);
  const isHover = variant === "hover";
  const isSelected = variant === "selected";

  return (
    <g transform={`translate(${point.x} ${point.y}) rotate(${rotation})`}>
      <circle
        className={[
          isSelected
            ? "fill-[#63da97]/15 stroke-[#63da97]/70"
            : isHover
              ? "fill-[#f3d09b]/15 stroke-[#f3d09b]/60"
              : "fill-[#e46645]/15 stroke-[#e46645]/50",
          "[stroke-width:1] [vector-effect:non-scaling-stroke]"
        ].join(" ")}
        r={isSelected ? 20 : isHover ? 18 : 14}
      />
      <path
        className={[
          isSelected
            ? "fill-[#63da97] stroke-[#101312]"
            : isHover
              ? "fill-[#f3d09b] stroke-[#101312]"
              : "fill-[#e46645] stroke-[#f5f7f6]",
          "[stroke-linejoin:round] [stroke-width:1.8] [vector-effect:non-scaling-stroke]"
        ].join(" ")}
        d="M 0 -13 L 8 9 L 3 7 L 0 12 L -3 7 L -8 9 Z"
      />
      <path
        className={[
          isHover || isSelected ? "stroke-[#101312]" : "stroke-[#f5f7f6]",
          "fill-none [stroke-linecap:round] [stroke-width:1.2] [vector-effect:non-scaling-stroke]"
        ].join(" ")}
        d="M -3 -3 L 3 -3 M -4 4 L 4 4"
      />
    </g>
  );
}

function ImpactMarker({ point }: { point: SvgPoint }) {
  return (
    <g transform={`translate(${point.x} ${point.y})`}>
      <circle className="fill-[#ff243d]/15 stroke-[#ff243d]/60 [stroke-width:2] [vector-effect:non-scaling-stroke]" r="15" />
      <foreignObject x="-9" y="-9" width="18" height="18" className="overflow-visible">
        <div className="grid h-[18px] w-[18px] place-items-center rounded-full bg-[#ff243d] text-[#f5f7f6]">
          <OctagonAlert size={13} strokeWidth={2.4} />
        </div>
      </foreignObject>
    </g>
  );
}

function yawToSvgDegrees(yaw: number) {
  if (!Number.isFinite(yaw)) return 0;
  return (yaw * 180) / Math.PI;
}

function MapLegend() {
  const items: { effect: MapEffect; label: string }[] = [
    { effect: "normal", label: "Normal" },
    { effect: "understeer", label: "Understeer" },
    { effect: "oversteer", label: "Oversteer" },
    { effect: "wheelspin", label: "Wheelspin" }
  ];

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-x-3 gap-y-1.5 rounded-md border border-white/10 bg-[#070a09]/75 px-3 py-2 text-[11px] font-bold text-[#c7d0cb] backdrop-blur">
      {items.map((item) => (
        <span key={item.effect} className="flex items-center gap-1.5">
          <span className={`h-2 w-4 rounded-full ${mapEffectSwatchClass(item.effect)}`} />
          {item.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="grid h-4 w-4 place-items-center rounded-full bg-[#ff243d] text-[#f5f7f6]">
          <OctagonAlert size={10} strokeWidth={2.5} />
        </span>
        Impact
      </span>
    </div>
  );
}

function clientPointToSvgPoint(svg: SVGSVGElement, event: React.PointerEvent<SVGSVGElement>): SvgPoint | null {
  return clientCoordinatesToSvgPoint(svg, event.clientX, event.clientY);
}

function clientCoordinatesToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): SvgPoint | null {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;

  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(matrix.inverse());
  return { x: transformed.x, y: transformed.y };
}

function initialMapViewBox(): SvgViewBox {
  return {
    x: 0,
    y: 0,
    width: MAP_IMAGE_WIDTH,
    height: MAP_IMAGE_HEIGHT
  };
}

function mapZoomPercent(viewBox: SvgViewBox) {
  return Math.round((MAP_IMAGE_WIDTH / viewBox.width / CAR_FOLLOW_MAP_ZOOM) * 100);
}

function loadStoredMapViewBox(): SvgViewBox | null {
  try {
    const raw = window.sessionStorage.getItem(MAP_CALIBRATION_VIEWBOX_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SvgViewBox>;
    if (
      Number.isFinite(parsed.x)
      && Number.isFinite(parsed.y)
      && Number.isFinite(parsed.width)
      && Number.isFinite(parsed.height)
    ) {
      return clampMapViewBox({
        x: parsed.x,
        y: parsed.y,
        width: parsed.width,
        height: parsed.height
      } as SvgViewBox);
    }
  } catch {
    return null;
  }

  return null;
}

function zoomViewBoxAtPoint(viewBox: SvgViewBox, focus: SvgPoint, factor: number): SvgViewBox {
  const minWidth = MAP_IMAGE_WIDTH / MAX_MAP_ZOOM;
  const nextWidth = clampNumber(viewBox.width * factor, minWidth, MAP_IMAGE_WIDTH);
  const nextHeight = clampNumber(viewBox.height * factor, MAP_IMAGE_HEIGHT / MAX_MAP_ZOOM, MAP_IMAGE_HEIGHT);

  const focusRatioX = (focus.x - viewBox.x) / viewBox.width;
  const focusRatioY = (focus.y - viewBox.y) / viewBox.height;

  return clampMapViewBox({
    x: focus.x - nextWidth * focusRatioX,
    y: focus.y - nextHeight * focusRatioY,
    width: nextWidth,
    height: nextHeight
  });
}

function centerViewBoxAtPoint(center: SvgPoint, width: number, height: number): SvgViewBox {
  return clampMapViewBox({
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height
  });
}

function clampMapViewBox(viewBox: SvgViewBox): SvgViewBox {
  const width = clampNumber(viewBox.width, MAP_IMAGE_WIDTH / MAX_MAP_ZOOM, MAP_IMAGE_WIDTH);
  const height = clampNumber(viewBox.height, MAP_IMAGE_HEIGHT / MAX_MAP_ZOOM, MAP_IMAGE_HEIGHT);

  return {
    x: clampNumber(viewBox.x, 0, MAP_IMAGE_WIDTH - width),
    y: clampNumber(viewBox.y, 0, MAP_IMAGE_HEIGHT - height),
    width,
    height
  };
}

function viewBoxCenter(viewBox: SvgViewBox): SvgPoint {
  return {
    x: viewBox.x + viewBox.width / 2,
    y: viewBox.y + viewBox.height / 2
  };
}

function buildPathRenderSegments(path: PathSample[], points: SvgPoint[]): PathRenderSegment[] {
  if (path.length < 2 || points.length < 2) return [];

  const segments: PathRenderSegment[] = [];
  const effects = smoothMapEffects(path);

  for (let index = 1; index < points.length; index += 1) {
    const effect = effects[index] ?? "normal";
    const previousPoint = points[index - 1];
    const point = points[index];
    const current = segments[segments.length - 1];

    if (current && current.effect === effect) {
      current.points.push(point);
    } else {
      segments.push({
        effect,
        points: [previousPoint, point]
      });
    }
  }

  return segments;
}

function buildPathEventMarkers(path: PathSample[], points: SvgPoint[]): PathEventMarker[] {
  const markers: PathEventMarker[] = [];
  let lastImpact: PathSample | null = null;

  path.forEach((sample, index) => {
    const point = points[index];
    const previous = index > 0 ? path[index - 1] : null;
    if (!point || !isImpact(sample, previous)) return;

    if (lastImpact) {
      const elapsedMs = sample.at - lastImpact.at;
      const distance = Math.hypot(sample.x - lastImpact.x, sample.z - lastImpact.z);
      if (elapsedMs < MIN_IMPACT_EVENT_GAP_MS || distance < MIN_IMPACT_EVENT_GAP_METERS) {
        return;
      }
    }

    markers.push({
      event: "impact" as const,
      point,
      sampleIndex: index
    });
    lastImpact = sample;
  });

  return markers;
}

function classifyMapEffect(telemetry: Telemetry): MapEffect {
  const slipBalance = telemetry.slipBalance;
  const yawRate = Math.abs(telemetry.AngularVelocityY);
  const lateralAcceleration = Math.abs(telemetry.AccelerationX);
  const turning = Math.abs(telemetry.steerPct) > 12 || yawRate > 0.18 || lateralAcceleration > 2;
  const wheelspin = telemetry.throttlePct > 45 && telemetry.rearSlip > 0.75;
  const understeer = turning && slipBalance > 0.18 && telemetry.frontSlip > 0.45;
  const oversteer = turning && slipBalance < -0.18 && telemetry.rearSlip > 0.45;

  if (wheelspin) return "wheelspin";
  if (understeer) return "understeer";
  if (oversteer) return "oversteer";
  return "normal";
}

function smoothMapEffects(path: PathSample[]) {
  const effects = path.map((_sample, index) => classifyMapEffectWindow(path, index));
  return removeShortEffectRuns(effects);
}

function classifyMapEffectWindow(path: PathSample[], index: number): MapEffect {
  const start = Math.max(0, index - MAP_EFFECT_SMOOTH_RADIUS);
  const end = Math.min(path.length, index + MAP_EFFECT_SMOOTH_RADIUS + 1);
  const samples = path.slice(start, end).map((sample) => sample.telemetry);
  const avg = (read: (telemetry: Telemetry) => number) => average(samples.map(read));

  const slipBalance = avg((telemetry) => telemetry.slipBalance);
  const yawRate = avg((telemetry) => Math.abs(telemetry.AngularVelocityY));
  const lateralAcceleration = avg((telemetry) => Math.abs(telemetry.AccelerationX));
  const steerPct = avg((telemetry) => Math.abs(telemetry.steerPct));
  const throttlePct = avg((telemetry) => telemetry.throttlePct);
  const frontSlip = avg((telemetry) => telemetry.frontSlip);
  const rearSlip = avg((telemetry) => telemetry.rearSlip);
  const turning = steerPct > 12 || yawRate > 0.18 || lateralAcceleration > 2;
  const wheelspin = throttlePct > 45 && rearSlip > 0.75;
  const understeer = turning && slipBalance > 0.18 && frontSlip > 0.45;
  const oversteer = turning && slipBalance < -0.18 && rearSlip > 0.45;

  if (wheelspin) return "wheelspin";
  if (understeer) return "understeer";
  if (oversteer) return "oversteer";
  return "normal";
}

function removeShortEffectRuns(effects: MapEffect[]) {
  const smoothed = [...effects];
  let index = 0;

  while (index < smoothed.length) {
    const runStart = index;
    const effect = smoothed[index];

    while (index < smoothed.length && smoothed[index] === effect) {
      index += 1;
    }

    const runEnd = index;
    const runLength = runEnd - runStart;
    if (runLength >= MIN_MAP_EFFECT_RUN_POINTS) continue;

    const previousEffect = runStart > 0 ? smoothed[runStart - 1] : null;
    const nextEffect = runEnd < smoothed.length ? smoothed[runEnd] : null;
    const replacement = previousEffect && previousEffect === nextEffect
      ? previousEffect
      : previousEffect ?? nextEffect ?? "normal";

    for (let runIndex = runStart; runIndex < runEnd; runIndex += 1) {
      smoothed[runIndex] = replacement;
    }
  }

  return smoothed;
}

function isImpact(sample: PathSample, previous: PathSample | null) {
  const telemetry = sample.telemetry;
  if (telemetry.SmashableVelDiff > MIN_SMASHABLE_IMPACT_VEL_DIFF) return true;
  if (!previous) return false;

  const elapsedSeconds = (sample.at - previous.at) / 1000;
  if (elapsedSeconds <= 0 || elapsedSeconds > 1) return false;

  const previousSpeedMps = velocityMagnitude(previous.telemetry);
  const currentSpeedMps = velocityMagnitude(telemetry);
  const speedDropMps = previousSpeedMps - currentSpeedMps;
  if (speedDropMps < MIN_IMPACT_SPEED_DROP_MPS) return false;

  const decelMps2 = speedDropMps / elapsedSeconds;
  const horizontalAccel = Math.hypot(telemetry.AccelerationX, telemetry.AccelerationZ);
  const verticalAccel = Math.abs(telemetry.AccelerationY);
  const likelyLanding = verticalAccel > horizontalAccel * 1.25 && verticalAccel > MIN_IMPACT_HORIZONTAL_ACCEL_MPS2;
  const likelyIntentionalBraking = telemetry.brakePct > 75 && speedDropMps < 9;

  return decelMps2 > MIN_IMPACT_DECEL_MPS2
    && horizontalAccel > MIN_IMPACT_HORIZONTAL_ACCEL_MPS2
    && !likelyLanding
    && !likelyIntentionalBraking;
}

function velocityMagnitude(telemetry: Telemetry) {
  return Math.hypot(telemetry.VelocityX, telemetry.VelocityY, telemetry.VelocityZ);
}

function mapEffectStrokeClass(effect: MapEffect) {
  return {
    normal: "stroke-[#f3d09b]",
    understeer: "stroke-[#59a7ff]",
    oversteer: "stroke-[#ff5a55]",
    wheelspin: "stroke-[#f7b84b]"
  }[effect];
}

function mapEffectSwatchClass(effect: MapEffect) {
  return {
    normal: "bg-[#f3d09b]",
    understeer: "bg-[#59a7ff]",
    oversteer: "bg-[#ff5a55]",
    wheelspin: "bg-[#f7b84b]"
  }[effect];
}

function buildPathGeometry(path: PathSample[]) {
  const width = MAP_IMAGE_WIDTH;
  const height = MAP_IMAGE_HEIGHT;
  if (path.length === 0) {
    return { width, height, points: [] as SvgPoint[], polyline: "" };
  }

  const points = path.map(worldPointToMapPoint);

  return {
    width,
    height,
    points,
    polyline: points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")
  };
}

function worldPointToMapPoint(point: PathSample): SvgPoint {
  return worldCoordinatesToMapPoint(point.x, point.z, activeMapCalibration());
}

function worldTelemetryToMapPoint(telemetry: Telemetry, transform: CalibrationTransform): SvgPoint {
  return worldCoordinatesToMapPoint(telemetry.PositionX, telemetry.PositionZ, transform);
}

function worldCoordinatesToMapPoint(worldX: number, worldZ: number, transform: CalibrationTransform): SvgPoint {
  return {
    x: transform.a * worldX + transform.b * worldZ + transform.c,
    y: transform.d * worldX + transform.e * worldZ + transform.f
  };
}

let cachedMapCalibration: CalibrationTransform | null | undefined;

function activeMapCalibration() {
  if (cachedMapCalibration !== undefined) return cachedMapCalibration ?? DEFAULT_MAP_CALIBRATION;

  cachedMapCalibration = loadSavedMapCalibration();
  return cachedMapCalibration ?? DEFAULT_MAP_CALIBRATION;
}

function resetActiveMapCalibration() {
  cachedMapCalibration = undefined;
}

function loadSavedMapCalibration(): CalibrationTransform | null {
  try {
    const raw = window.localStorage.getItem(MAP_CALIBRATION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CalibrationTransform>;
    if (
      Number.isFinite(parsed.a)
      && Number.isFinite(parsed.b)
      && Number.isFinite(parsed.c)
      && Number.isFinite(parsed.d)
      && Number.isFinite(parsed.e)
      && Number.isFinite(parsed.f)
    ) {
      return {
        a: parsed.a,
        b: parsed.b,
        c: parsed.c,
        d: parsed.d,
        e: parsed.e,
        f: parsed.f
      } as CalibrationTransform;
    }
  } catch {
    return null;
  }

  return null;
}

function solveCalibrationTransform(points: CalibrationPoint[]): CalibrationTransform | null {
  if (points.length >= 3) {
    return solveAffineTransform(points) ?? solveSimilarityTransform(points);
  }

  if (points.length >= 2) {
    return solveSimilarityTransform(points);
  }

  return null;
}

function solveSimilarityTransform(points: CalibrationPoint[]): CalibrationTransform | null {
  const worldMeanX = average(points.map((point) => point.worldX));
  const worldMeanZ = average(points.map((point) => point.worldZ));
  const mapMeanX = average(points.map((point) => point.mapX));
  const mapMeanY = average(points.map((point) => point.mapY));

  let denominator = 0;
  let alphaNumerator = 0;
  let betaNumerator = 0;

  points.forEach((point) => {
    const worldX = point.worldX - worldMeanX;
    const worldZ = point.worldZ - worldMeanZ;
    const mapX = point.mapX - mapMeanX;
    const mapY = point.mapY - mapMeanY;

    denominator += worldX ** 2 + worldZ ** 2;
    alphaNumerator += mapX * worldX + mapY * worldZ;
    betaNumerator += mapY * worldX - mapX * worldZ;
  });

  if (Math.abs(denominator) < 0.000001) return null;

  const alpha = alphaNumerator / denominator;
  const beta = betaNumerator / denominator;

  return {
    a: alpha,
    b: -beta,
    c: mapMeanX - alpha * worldMeanX + beta * worldMeanZ,
    d: beta,
    e: alpha,
    f: mapMeanY - beta * worldMeanX - alpha * worldMeanZ
  };
}

function solveAffineTransform(points: CalibrationPoint[]): CalibrationTransform | null {
  const normal = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  const rhsX = [0, 0, 0];
  const rhsY = [0, 0, 0];

  points.forEach((point) => {
    const row = [point.worldX, point.worldZ, 1];
    for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
      rhsX[rowIndex] += row[rowIndex] * point.mapX;
      rhsY[rowIndex] += row[rowIndex] * point.mapY;

      for (let colIndex = 0; colIndex < 3; colIndex += 1) {
        normal[rowIndex][colIndex] += row[rowIndex] * row[colIndex];
      }
    }
  });

  const xCoefficients = solveLinear3(normal, rhsX);
  const yCoefficients = solveLinear3(normal, rhsY);
  if (!xCoefficients || !yCoefficients) return null;

  return {
    a: xCoefficients[0],
    b: xCoefficients[1],
    c: xCoefficients[2],
    d: yCoefficients[0],
    e: yCoefficients[1],
    f: yCoefficients[2]
  };
}

function solveLinear3(matrix: number[][], vector: number[]): [number, number, number] | null {
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let pivotIndex = 0; pivotIndex < 3; pivotIndex += 1) {
    let bestRow = pivotIndex;
    for (let rowIndex = pivotIndex + 1; rowIndex < 3; rowIndex += 1) {
      if (Math.abs(augmented[rowIndex][pivotIndex]) > Math.abs(augmented[bestRow][pivotIndex])) {
        bestRow = rowIndex;
      }
    }

    if (Math.abs(augmented[bestRow][pivotIndex]) < 0.000001) return null;
    [augmented[pivotIndex], augmented[bestRow]] = [augmented[bestRow], augmented[pivotIndex]];

    const pivot = augmented[pivotIndex][pivotIndex];
    for (let colIndex = pivotIndex; colIndex < 4; colIndex += 1) {
      augmented[pivotIndex][colIndex] /= pivot;
    }

    for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
      if (rowIndex === pivotIndex) continue;

      const factor = augmented[rowIndex][pivotIndex];
      for (let colIndex = pivotIndex; colIndex < 4; colIndex += 1) {
        augmented[rowIndex][colIndex] -= factor * augmented[pivotIndex][colIndex];
      }
    }
  }

  return [augmented[0][3], augmented[1][3], augmented[2][3]];
}

function calibrationResidual(points: CalibrationPoint[], transform: CalibrationTransform) {
  if (!points.length) return { averagePx: 0, maxPx: 0 };

  const errors = points.map((point) => {
    const projected = worldCoordinatesToMapPoint(point.worldX, point.worldZ, transform);
    return Math.hypot(projected.x - point.mapX, projected.y - point.mapY);
  });

  return {
    averagePx: average(errors),
    maxPx: Math.max(...errors)
  };
}

function formatCalibrationForCode(transform: CalibrationTransform) {
  return `const DEFAULT_MAP_CALIBRATION: CalibrationTransform = {
  a: ${formatCoefficient(transform.a)},
  b: ${formatCoefficient(transform.b)},
  c: ${formatCoefficient(transform.c)},
  d: ${formatCoefficient(transform.d)},
  e: ${formatCoefficient(transform.e)},
  f: ${formatCoefficient(transform.f)}
};`;
}

function formatCoefficient(value: number) {
  return Number.isInteger(value) ? value.toString() : Number(value.toPrecision(12)).toString();
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function nearestPointIndex(points: SvgPoint[], cursor: SvgPoint) {
  let bestIndex = 0;
  let bestDistance = Infinity;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const distance = (point.x - cursor.x) ** 2 + (point.y - cursor.y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function LiveInputsPanel({ telemetry }: { telemetry: Telemetry | null }) {
  const steerPct = clampPercent(telemetry?.steerPct ?? 0);
  const throttlePct = clampPercent(telemetry?.throttlePct ?? 0);
  const brakePct = clampPercent(telemetry?.brakePct ?? 0);
  const steeringRotation = steerPct * 1.35;

  return (
    <section className={`${panelClass} grid min-h-0 grid-cols-[150px_minmax(0,1fr)] gap-5 p-5`}>
      <div className="flex min-w-0 flex-col items-center justify-center gap-3 border-r border-white/10 pr-5">
        <div
          className="grid h-[86px] w-[86px] place-items-center rounded-full border border-white/15 bg-[#070a09]/60 text-[#f3d09b] shadow-[inset_0_0_0_8px_rgba(255,255,255,0.035)] transition-transform duration-100"
          style={{ transform: `rotate(${steeringRotation}deg)` }}
          aria-hidden="true"
        >
          <Gauge size={48} strokeWidth={1.7} />
        </div>
        <div className="grid gap-1 text-center">
          <span className={labelClass}>Steering</span>
          <strong className="text-xl tabular-nums text-[#f5f7f6]">{formatSignedPercent(steerPct)}</strong>
        </div>
      </div>

      <div className="flex min-w-0 flex-col justify-center gap-4">
        <InputBar label="Throttle" value={throttlePct} color="#63da97" />
        <InputBar label="Brake" value={brakePct} color="#e46645" />
      </div>
    </section>
  );
}

function InputBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className={labelClass}>{label}</span>
        <span className="text-sm font-bold tabular-nums text-[#f5f7f6]">{value.toFixed(0)}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full border border-white/10 bg-[#070a09]/70">
        <div
          className="h-full rounded-full transition-[width] duration-100"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function RightPanel({
  activeTab,
  onTabChange,
  telemetry,
  state,
  sessions,
  selectedSessionId,
  onSessionChange,
  onNewSession
}: {
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  telemetry: Telemetry | null;
  state: AppState;
  sessions: SessionSummary[];
  selectedSessionId: SessionSelection;
  onSessionChange: (sessionId: SessionSelection) => void;
  onNewSession: () => void;
}) {
  const tabs: { id: RightPanelTab; label: string; icon: React.ReactNode }[] = [
    { id: "tuning", label: "Tuning", icon: <Wrench size={16} /> },
    { id: "data", label: "Data", icon: <Activity size={16} /> }
  ];

  return (
    <section className={`${panelClass} flex h-full min-h-0 flex-col p-5`}>
      <div className="mb-4 grid shrink-0 gap-3">
        <SessionSwitcher
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          canSelectLive={state.connected}
          liveSessionId={state.sessionId}
          onSessionChange={onSessionChange}
          onNewSession={onNewSession}
        />
        <div className="flex rounded-lg border border-white/10 bg-[#070a09]/55 p-1" role="tablist" aria-label="Right panel views">
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={[
                  "flex h-9 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-bold transition",
                  selected
                    ? "bg-[#f3d09b] text-[#101312]"
                    : "text-[#b5bfb9] hover:bg-white/[0.06] hover:text-[#f5f7f6]"
                ].join(" ")}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${tab.id}-panel`}
                id={`${tab.id}-tab`}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto pr-1"
        role="tabpanel"
        id={`${activeTab}-panel`}
        aria-labelledby={`${activeTab}-tab`}
      >
        <div className="flex flex-col gap-[18px] pb-2">
          {activeTab === "data" ? (
            <TelemetryDashboard telemetry={telemetry} state={state} />
          ) : (
            <TuningPanel telemetry={telemetry} state={state} />
          )}
        </div>
      </div>
    </section>
  );
}

function SessionSwitcher({
  sessions,
  selectedSessionId,
  canSelectLive,
  liveSessionId,
  onSessionChange,
  onNewSession
}: {
  sessions: SessionSummary[];
  selectedSessionId: SessionSelection;
  canSelectLive: boolean;
  liveSessionId?: string;
  onSessionChange: (sessionId: SessionSelection) => void;
  onNewSession: () => void;
}) {
  const selectedValue = canSelectLive
    ? selectedSessionId
    : selectedSessionId === "live"
      ? sessions[0]?.id ?? "__none"
      : selectedSessionId;

  return (
    <div className="grid gap-2">
      <label className={`${labelClass} flex items-center gap-2`} htmlFor="session-select">
        <History size={15} />
        Session
      </label>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <select
          id="session-select"
          className="h-10 w-full rounded-lg border border-white/10 bg-[#070a09]/70 px-3 text-sm font-bold text-[#f5f7f6] outline-none transition focus:border-[#f3d09b]/60"
          value={selectedValue}
          onChange={(event) => onSessionChange(event.currentTarget.value)}
        >
          {canSelectLive ? (
            <option value="live">Live{liveSessionId ? ` - ${shortSessionId(liveSessionId)}` : ""}</option>
          ) : null}
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {formatSessionLabel(session)}
            </option>
          ))}
          {!canSelectLive && sessions.length === 0 ? (
            <option value="__none">No saved sessions</option>
          ) : null}
        </select>
        <button
          className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-[#070a09]/70 px-3 text-sm font-bold text-[#f5f7f6] transition hover:border-[#f3d09b]/50 hover:bg-[#f3d09b]/[0.08]"
          type="button"
          onClick={onNewSession}
          title="Start new session"
          aria-label="Start new session"
        >
          <Plus size={17} />
          <span className="hidden sm:inline">New session</span>
        </button>
      </div>
    </div>
  );
}

function TuningPanel({ telemetry, state }: { telemetry: Telemetry | null; state: AppState }) {
  const tires = buildTireMfdData(telemetry);
  const bodyAngleDeg = telemetry ? bodyAngleToTravelDegrees(telemetry) : 0;
  const absBodyAngle = Math.abs(bodyAngleDeg);
  const frontSlipAngle = average([
    Math.abs(telemetry?.TireSlipAngleFrontLeft ?? 0),
    Math.abs(telemetry?.TireSlipAngleFrontRight ?? 0)
  ]);
  const rearSlipAngle = average([
    Math.abs(telemetry?.TireSlipAngleRearLeft ?? 0),
    Math.abs(telemetry?.TireSlipAngleRearRight ?? 0)
  ]);
  const slipAngleBalance = frontSlipAngle - rearSlipAngle;
  const maxCombinedSlip = Math.max(...tires.map((tire) => tire.combinedSlip), 0);
  const stateLabel = telemetry
    ? classifyLiveMfdState(absBodyAngle, maxCombinedSlip, slipAngleBalance, telemetry.throttlePct)
    : "Waiting";

  return (
    <div className="grid gap-[18px]">
      <TelemetryGroup title="Live tire MFD" icon={<Gauge size={18} />}>
        <div className="overflow-hidden rounded-lg border border-white/10 bg-[#070a09]/70 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={`${labelClass} mb-1`}>Travel direction</p>
              <div className="flex items-center gap-2 text-sm font-bold text-[#f5f7f6]">
                <span className="grid size-7 place-items-center rounded-md border border-[#f3d09b]/30 bg-[#f3d09b]/10 text-[#f3d09b]">↑</span>
                <span className="truncate">Body angle {formatDegrees(bodyAngleDeg)}</span>
              </div>
            </div>
            <div className={`rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] ${mfdStateClass(stateLabel)}`}>
              {stateLabel}
            </div>
          </div>

          <div className="relative mx-auto aspect-[0.82] w-full max-w-[300px]">
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[#f3d09b]/25" />
            <div className="absolute left-1/2 top-0 flex -translate-x-1/2 flex-col items-center text-[#f3d09b]">
              <div className="h-0 w-0 border-x-[7px] border-b-[13px] border-x-transparent border-b-[#f3d09b]" />
              <span className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.12em]">travel</span>
            </div>

            <div
              className="absolute inset-[16%_12%] transition-transform duration-200 ease-out"
              style={{ transform: `rotate(${bodyAngleDeg}deg)` }}
            >
              <div className="absolute left-1/2 top-1/2 h-[72%] w-px -translate-x-1/2 -translate-y-1/2 bg-white/10" />
              {tires.map((tire) => (
                <TireMfdBlock key={tire.id} tire={tire} />
              ))}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
          <MetricCell label="Balance" value={balanceLabel(slipAngleBalance)} tone={slipTone(slipAngleBalance)} />
          <MetricCell label="Slip angle delta" value={slipAngleBalance} precision={3} tone={slipTone(slipAngleBalance)} />
          <MetricCell label="Max combined" value={maxCombinedSlip} precision={3} tone={maxCombinedSlip > 0.9 ? "alert" : maxCombinedSlip > 0.65 ? "warn" : "ok"} />
          <MetricCell label="Samples" value={state.summary?.sampleCount ?? 0} precision={0} />
        </dl>
      </TelemetryGroup>
    </div>
  );
}

type TireMfdTire = {
  id: string;
  label: string;
  temp: number;
  slipAngle: number;
  combinedSlip: number;
  left: string;
  top: string;
};

function TireMfdBlock({ tire }: { tire: TireMfdTire }) {
  const tempColor = tireTemperatureColor(tire.temp);
  const slipIntensity = clampNumber(Math.abs(tire.combinedSlip), 0, 1.2) / 1.2;
  const slipPercent = Math.round(slipIntensity * 100);

  return (
    <div
      className="absolute h-[27%] w-[22%] -translate-x-1/2 -translate-y-1/2 rounded-[6px] border border-white/20 bg-[#101614] p-1.5 shadow-[0_10px_22px_rgba(0,0,0,0.28)] transition-colors duration-200"
      style={{ left: tire.left, top: tire.top }}
    >
      <div
        className="relative flex h-full flex-col justify-between overflow-hidden rounded-[4px] border border-black/30 px-1.5 py-1 text-[#07100d]"
        style={{ backgroundColor: tempColor }}
      >
        <div
          className="absolute inset-x-0 bottom-0 bg-black/30 transition-[height] duration-200"
          style={{ height: `${slipPercent}%` }}
        />
        <div className="relative flex items-center justify-between gap-1 text-[0.58rem] font-black uppercase tracking-[0.08em]">
          <span>{tire.label}</span>
          <span>{Math.round(tire.temp)}°</span>
        </div>
        <div className="relative text-[0.55rem] font-black tabular-nums">
          S {formatValue(tire.combinedSlip, { precision: 2 })}
        </div>
      </div>
    </div>
  );
}

function buildTireMfdData(telemetry: Telemetry | null): TireMfdTire[] {
  return [
    {
      id: "front-left",
      label: "FL",
      temp: telemetry?.TireTempFrontLeft ?? 0,
      slipAngle: Math.abs(telemetry?.TireSlipAngleFrontLeft ?? 0),
      combinedSlip: Math.abs(telemetry?.TireCombinedSlipFrontLeft ?? 0),
      left: "28%",
      top: "24%"
    },
    {
      id: "front-right",
      label: "FR",
      temp: telemetry?.TireTempFrontRight ?? 0,
      slipAngle: Math.abs(telemetry?.TireSlipAngleFrontRight ?? 0),
      combinedSlip: Math.abs(telemetry?.TireCombinedSlipFrontRight ?? 0),
      left: "72%",
      top: "24%"
    },
    {
      id: "rear-left",
      label: "RL",
      temp: telemetry?.TireTempRearLeft ?? 0,
      slipAngle: Math.abs(telemetry?.TireSlipAngleRearLeft ?? 0),
      combinedSlip: Math.abs(telemetry?.TireCombinedSlipRearLeft ?? 0),
      left: "28%",
      top: "76%"
    },
    {
      id: "rear-right",
      label: "RR",
      temp: telemetry?.TireTempRearRight ?? 0,
      slipAngle: Math.abs(telemetry?.TireSlipAngleRearRight ?? 0),
      combinedSlip: Math.abs(telemetry?.TireCombinedSlipRearRight ?? 0),
      left: "72%",
      top: "76%"
    }
  ];
}

function bodyAngleToTravelDegrees(telemetry: Telemetry) {
  const speed = velocityMagnitude(telemetry);
  if (speed < 1.5) return 0;

  const localVelocityAngle = Math.atan2(telemetry.VelocityX, telemetry.VelocityZ);
  return clampNumber(radiansToDegrees(-localVelocityAngle), -90, 90);
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function formatDegrees(value: number) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}°`;
}

function tireTemperatureColor(temp: number) {
  if (!Number.isFinite(temp) || temp <= 0) return "#26302d";
  if (temp < 55) return "#59a7ff";
  if (temp < 82) return "#63da97";
  if (temp < 102) return "#f3d09b";
  return "#e46645";
}

function classifyLiveMfdState(bodyAngle: number, combinedSlip: number, slipAngleBalance: number, throttlePct: number) {
  if (combinedSlip > 1.05 || bodyAngle > 35) return "Unstable";
  if (throttlePct > 45 && combinedSlip > 0.75) return "Wheelspin";
  if (Math.abs(slipAngleBalance) > 0.14 || bodyAngle > 12) return "Rotating";
  return "Stable";
}

function mfdStateClass(state: string) {
  if (state === "Unstable") return "border-[#e46645]/40 bg-[#e46645]/10 text-[#ffd1c7]";
  if (state === "Wheelspin") return "border-[#f7b84b]/40 bg-[#f7b84b]/10 text-[#ffe1a5]";
  if (state === "Rotating") return "border-[#59a7ff]/35 bg-[#59a7ff]/10 text-[#cfe5ff]";
  if (state === "Stable") return "border-[#63da97]/35 bg-[#63da97]/10 text-[#d8ffe7]";
  return "border-white/10 bg-white/[0.035] text-[#b5bfb9]";
}

function MetricCell({
  label,
  value,
  suffix = "",
  precision = 0,
  tone = "default"
}: {
  label: string;
  value: TelemetryValue;
  suffix?: string;
  precision?: number;
  tone?: "default" | "ok" | "warn" | "alert";
}) {
  const toneClass = {
    default: "text-[#f5f7f6]",
    ok: "text-[#63da97]",
    warn: "text-[#f3d09b]",
    alert: "text-[#e46645]"
  }[tone];

  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-3">
      <dt className={`${labelClass} mb-1.5`}>{label}</dt>
      <dd className={`break-words font-bold leading-tight tabular-nums ${toneClass}`}>
        {formatValue(value, { precision })}{suffix}
      </dd>
    </div>
  );
}

function TelemetryDashboard({
  telemetry,
  state
}: {
  telemetry: Telemetry | null;
  state: AppState;
}) {
  return (
    <div className="grid gap-[18px]">
      <TelemetryGroup title="App info" icon={<Clock3 size={18} />}>
        <dl className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
          {[
            ["Connected", state.connected ? "yes" : "no"],
            ["Packets", state.packets],
            ["Bad packets", state.badPackets],
            ["Status", tuningStatusLabel(state.advice)],
            ["Samples", state.summary?.sampleCount ?? 0],
            ["Window", `${formatValue(state.summary?.windowSeconds ?? 0, { precision: 1 })} s`],
            ["UDP port", state.udpPort],
            ["HTTP port", state.httpPort],
            ["WebSocket port", state.wsPort],
            ["Session", state.sessionId ? shortSessionId(state.sessionId) : "none"],
            ["Source", state.lastSource || "none"],
            ["Last packet", state.lastPacketAt ? new Date(state.lastPacketAt).toLocaleTimeString() : "none"],
            ["Local IPs", state.localIps.length ? state.localIps.join(", ") : "none"]
          ].map(([label, value]) => (
            <DataCell key={label} label={String(label)} value={value} />
          ))}
        </dl>
      </TelemetryGroup>

      <TelemetryGroup title="Raw game info" icon={<Activity size={18} />}>
        {docTelemetrySections.map((section) => (
          <DocDataSection key={section.title} section={section} telemetry={telemetry} />
        ))}
      </TelemetryGroup>
    </div>
  );
}

function TelemetryGroup({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <SectionTitle icon={icon} compact>{title}</SectionTitle>
      <div className="grid gap-[18px]">
        {children}
      </div>
    </section>
  );
}

function DocDataSection({ section, telemetry }: { section: DocTelemetrySection; telemetry: Telemetry | null }) {
  return (
    <section className="grid gap-3">
      <div className="grid gap-1.5">
        <SectionTitle icon={<Activity size={18} />} compact>{section.title}</SectionTitle>
        <p className="m-0 text-sm leading-5 text-[#b5bfb9]">{section.comment}</p>
      </div>
      <dl className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {section.fields.map((field) => (
          <DataCell
            key={field.name}
            label={field.label}
            value={telemetry?.[field.name]}
            suffix={field.suffix}
            precision={field.precision}
            boolean={field.boolean}
          />
        ))}
      </dl>
    </section>
  );
}

function DataCell({
  label,
  value,
  suffix = "",
  precision = 0,
  boolean = false
}: {
  label: string;
  value: TelemetryValue;
  suffix?: string;
  precision?: number;
  boolean?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-3">
      <dt className={`${labelClass} mb-1.5`}>{label}</dt>
      <dd className="overflow-hidden text-ellipsis whitespace-nowrap font-bold text-[#f5f7f6]">
        {formatValue(value, { precision, boolean })}{boolean ? "" : suffix}
      </dd>
    </div>
  );
}

function SectionTitle({ children, icon, compact = false }: { children: React.ReactNode; icon?: React.ReactNode; compact?: boolean }) {
  return (
    <h2 className={`${compact ? "mb-0" : "mb-4"} flex items-center gap-2 text-[0.95rem] font-bold text-[#f5f7f6]`}>
      {icon}{children}
    </h2>
  );
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(-100, value));
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function formatSignedPercent(value: number) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function drivetrainLabel(value: number | undefined) {
  if (value === 0) return "FWD";
  if (value === 1) return "RWD";
  if (value === 2) return "AWD";
  return "Unknown";
}

function formatSessionLabel(session: SessionSummary) {
  const started = new Date(session.startedAt).toLocaleString();
  const packets = `${session.packetCount.toLocaleString()} packets`;
  const car = session.carPerformanceIndex ? ` PI ${session.carPerformanceIndex}` : "";
  return `${started} - ${packets}${car} - ${shortSessionId(session.id)}`;
}

function shortSessionId(sessionId: string) {
  return sessionId.slice(0, 8);
}

function tuningStatusLabel(advice: Advice[]) {
  if (advice.some((item) => item.level === "alert")) return "Needs setup change";
  if (advice.some((item) => item.level === "warn")) return "Watch balance";
  if (advice.some((item) => item.level === "note")) return "Minor notes";
  if (advice.some((item) => item.level === "ok")) return "Settled";
  return "Collecting data";
}

function slipTone(value: number): "ok" | "warn" | "alert" {
  const magnitude = Math.abs(value);
  if (magnitude > 0.3) return "alert";
  if (magnitude > 0.12) return "warn";
  return "ok";
}

function balanceLabel(value: number) {
  if (value > 0.12) return "Understeer";
  if (value < -0.12) return "Oversteer";
  return "Neutral";
}

function temperatureTone(value: number): "ok" | "warn" | "alert" {
  const magnitude = Math.abs(value);
  if (magnitude > 18) return "alert";
  if (magnitude > 10) return "warn";
  return "ok";
}

function temperatureLabel(value: number) {
  if (value > 10) return "Front hot";
  if (value < -10) return "Rear hot";
  return "Even";
}

function compressionTone(value: number | undefined): "default" | "ok" | "warn" | "alert" {
  if (value === undefined) return "default";
  if (value > 0.96) return "alert";
  if (value > 0.9) return "warn";
  return "ok";
}

function formatValue(value: number | string | null | undefined, options: { precision?: number; boolean?: boolean } = {}) {
  if (value === undefined || value === null) return "0";
  if (options.boolean) return Number(value) === 1 ? "true" : "false";
  if (typeof value === "string") return value;
  if (Number.isNaN(value)) return "0";
  return Number(value).toFixed(options.precision ?? 0);
}

const rootElement = document.getElementById("root") as HTMLElement;
const rootWindow = window as Window & {
  __forzaTunerRoot?: ReturnType<typeof createRoot>;
};

rootWindow.__forzaTunerRoot ??= createRoot(rootElement);
rootWindow.__forzaTunerRoot.render(
  window.location.pathname === "/calibrate-map"
    ? <MapCalibrationPage />
    : <App />
);
