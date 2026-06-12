import type { DocTelemetrySection } from "@/types/telemetry";

export const docTelemetrySections: DocTelemetrySection[] = [
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

