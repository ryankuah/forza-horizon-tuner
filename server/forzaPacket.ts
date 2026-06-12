import type { Telemetry } from "../src/types/telemetry";

export const PACKET_SIZE = 324;

type DerivedTelemetryField =
  | "speedKmh"
  | "speedMph"
  | "powerHp"
  | "torqueNm"
  | "throttlePct"
  | "brakePct"
  | "steerPct"
  | "frontSlip"
  | "rearSlip"
  | "slipBalance"
  | "frontTemp"
  | "rearTemp"
  | "tempBalance"
  | "suspensionAvgFront"
  | "suspensionAvgRear"
  | "receivedAt";

export type RawTelemetry = Omit<Telemetry, DerivedTelemetryField>;

type PacketReaderType = "i32" | "u32" | "f32" | "u16" | "u8" | "i8";
type PacketField = [keyof RawTelemetry, PacketReaderType];
type PacketReader = {
  size: number;
  read: (buffer: Buffer, offset: number) => number;
};

const fields: PacketField[] = [
  ["IsRaceOn", "i32"],
  ["TimestampMS", "u32"],
  ["EngineMaxRpm", "f32"],
  ["EngineIdleRpm", "f32"],
  ["CurrentEngineRpm", "f32"],
  ["AccelerationX", "f32"],
  ["AccelerationY", "f32"],
  ["AccelerationZ", "f32"],
  ["VelocityX", "f32"],
  ["VelocityY", "f32"],
  ["VelocityZ", "f32"],
  ["AngularVelocityX", "f32"],
  ["AngularVelocityY", "f32"],
  ["AngularVelocityZ", "f32"],
  ["Yaw", "f32"],
  ["Pitch", "f32"],
  ["Roll", "f32"],
  ["NormalizedSuspensionTravelFrontLeft", "f32"],
  ["NormalizedSuspensionTravelFrontRight", "f32"],
  ["NormalizedSuspensionTravelRearLeft", "f32"],
  ["NormalizedSuspensionTravelRearRight", "f32"],
  ["TireSlipRatioFrontLeft", "f32"],
  ["TireSlipRatioFrontRight", "f32"],
  ["TireSlipRatioRearLeft", "f32"],
  ["TireSlipRatioRearRight", "f32"],
  ["WheelRotationSpeedFrontLeft", "f32"],
  ["WheelRotationSpeedFrontRight", "f32"],
  ["WheelRotationSpeedRearLeft", "f32"],
  ["WheelRotationSpeedRearRight", "f32"],
  ["WheelOnRumbleStripFrontLeft", "i32"],
  ["WheelOnRumbleStripFrontRight", "i32"],
  ["WheelOnRumbleStripRearLeft", "i32"],
  ["WheelOnRumbleStripRearRight", "i32"],
  ["WheelInPuddleFrontLeft", "i32"],
  ["WheelInPuddleFrontRight", "i32"],
  ["WheelInPuddleRearLeft", "i32"],
  ["WheelInPuddleRearRight", "i32"],
  ["SurfaceRumbleFrontLeft", "f32"],
  ["SurfaceRumbleFrontRight", "f32"],
  ["SurfaceRumbleRearLeft", "f32"],
  ["SurfaceRumbleRearRight", "f32"],
  ["TireSlipAngleFrontLeft", "f32"],
  ["TireSlipAngleFrontRight", "f32"],
  ["TireSlipAngleRearLeft", "f32"],
  ["TireSlipAngleRearRight", "f32"],
  ["TireCombinedSlipFrontLeft", "f32"],
  ["TireCombinedSlipFrontRight", "f32"],
  ["TireCombinedSlipRearLeft", "f32"],
  ["TireCombinedSlipRearRight", "f32"],
  ["SuspensionTravelMetersFrontLeft", "f32"],
  ["SuspensionTravelMetersFrontRight", "f32"],
  ["SuspensionTravelMetersRearLeft", "f32"],
  ["SuspensionTravelMetersRearRight", "f32"],
  ["CarOrdinal", "i32"],
  ["CarClass", "i32"],
  ["CarPerformanceIndex", "i32"],
  ["DrivetrainType", "i32"],
  ["NumCylinders", "i32"],
  ["CarGroup", "u32"],
  ["SmashableVelDiff", "f32"],
  ["SmashableMass", "f32"],
  ["PositionX", "f32"],
  ["PositionY", "f32"],
  ["PositionZ", "f32"],
  ["Speed", "f32"],
  ["Power", "f32"],
  ["Torque", "f32"],
  ["TireTempFrontLeft", "f32"],
  ["TireTempFrontRight", "f32"],
  ["TireTempRearLeft", "f32"],
  ["TireTempRearRight", "f32"],
  ["Boost", "f32"],
  ["Fuel", "f32"],
  ["DistanceTraveled", "f32"],
  ["BestLap", "f32"],
  ["LastLap", "f32"],
  ["CurrentLap", "f32"],
  ["CurrentRaceTime", "f32"],
  ["LapNumber", "u16"],
  ["RacePosition", "u8"],
  ["Accel", "u8"],
  ["Brake", "u8"],
  ["Clutch", "u8"],
  ["HandBrake", "u8"],
  ["Gear", "u8"],
  ["Steer", "i8"],
  ["NormalizedDrivingLine", "i8"],
  ["NormalizedAIBrakeDifference", "i8"]
];

const readers: Record<PacketReaderType, PacketReader> = {
  i32: { size: 4, read: (buffer, offset) => buffer.readInt32LE(offset) },
  u32: { size: 4, read: (buffer, offset) => buffer.readUInt32LE(offset) },
  f32: { size: 4, read: (buffer, offset) => buffer.readFloatLE(offset) },
  u16: { size: 2, read: (buffer, offset) => buffer.readUInt16LE(offset) },
  u8: { size: 1, read: (buffer, offset) => buffer.readUInt8(offset) },
  i8: { size: 1, read: (buffer, offset) => buffer.readInt8(offset) }
};

export function parseForzaPacket(buffer: Buffer): RawTelemetry {
  if (buffer.length !== PACKET_SIZE) {
    throw new Error(`Invalid packet size: expected ${PACKET_SIZE}, got ${buffer.length}`);
  }

  let offset = 0;
  const data = {} as RawTelemetry;

  for (const [name, type] of fields) {
    const reader = readers[type];
    data[name] = reader.read(buffer, offset);
    offset += reader.size;
  }

  return data;
}

export function enrichTelemetry(data: RawTelemetry, receivedAt = Date.now()): Telemetry {
  const velocitySpeed = magnitude([
    data.VelocityX,
    data.VelocityY,
    data.VelocityZ
  ]);
  const speedMps = usablePositive(data.Speed) ? data.Speed : velocitySpeed;
  const frontSlip = averageAbs([
    data.TireCombinedSlipFrontLeft,
    data.TireCombinedSlipFrontRight
  ]);
  const rearSlip = averageAbs([
    data.TireCombinedSlipRearLeft,
    data.TireCombinedSlipRearRight
  ]);
  const frontTemp = average([data.TireTempFrontLeft, data.TireTempFrontRight]);
  const rearTemp = average([data.TireTempRearLeft, data.TireTempRearRight]);

  return {
    ...data,
    receivedAt,
    speedKmh: speedMps * 3.6,
    speedMph: speedMps * 2.236936,
    powerHp: data.Power / 745.7,
    torqueNm: data.Torque,
    throttlePct: data.Accel / 2.55,
    brakePct: data.Brake / 2.55,
    steerPct: data.Steer / 1.27,
    frontSlip,
    rearSlip,
    slipBalance: frontSlip - rearSlip,
    frontTemp,
    rearTemp,
    tempBalance: frontTemp - rearTemp,
    suspensionAvgFront: average([
      data.NormalizedSuspensionTravelFrontLeft,
      data.NormalizedSuspensionTravelFrontRight
    ]),
    suspensionAvgRear: average([
      data.NormalizedSuspensionTravelRearLeft,
      data.NormalizedSuspensionTravelRearRight
    ])
  };
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageAbs(values: number[]) {
  return values.reduce((sum, value) => sum + Math.abs(value), 0) / values.length;
}

function magnitude(values: number[]) {
  return Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0));
}

function usablePositive(value: number) {
  return Number.isFinite(value) && value > 0.01;
}
