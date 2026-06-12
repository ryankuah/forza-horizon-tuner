import type { Telemetry, TireMfdTire } from "@/types/telemetry";
import { clampNumber } from "@/lib/math";

export function buildTireMfdData(telemetry: Telemetry | null): TireMfdTire[] {
  const frontSteerAngle = approximateFrontTireSteerDegrees(telemetry?.steerPct ?? 0);

  return [
    {
      id: "front-left",
      temp: telemetry?.TireTempFrontLeft ?? 0,
      slipAngle: Math.abs(telemetry?.TireSlipAngleFrontLeft ?? 0),
      combinedSlip: Math.abs(telemetry?.TireCombinedSlipFrontLeft ?? 0),
      steerAngleDeg: frontSteerAngle
    },
    {
      id: "front-right",
      temp: telemetry?.TireTempFrontRight ?? 0,
      slipAngle: Math.abs(telemetry?.TireSlipAngleFrontRight ?? 0),
      combinedSlip: Math.abs(telemetry?.TireCombinedSlipFrontRight ?? 0),
      steerAngleDeg: frontSteerAngle
    },
    {
      id: "rear-left",
      temp: telemetry?.TireTempRearLeft ?? 0,
      slipAngle: Math.abs(telemetry?.TireSlipAngleRearLeft ?? 0),
      combinedSlip: Math.abs(telemetry?.TireCombinedSlipRearLeft ?? 0),
      steerAngleDeg: 0
    },
    {
      id: "rear-right",
      temp: telemetry?.TireTempRearRight ?? 0,
      slipAngle: Math.abs(telemetry?.TireSlipAngleRearRight ?? 0),
      combinedSlip: Math.abs(telemetry?.TireCombinedSlipRearRight ?? 0),
      steerAngleDeg: 0
    }
  ];
}

export function tireTemperatureColor(temp: number) {
  if (!Number.isFinite(temp) || temp <= 0) return "#26302d";
  if (temp < 55) return "#59a7ff";
  if (temp < 82) return "#63da97";
  if (temp < 102) return "#f3d09b";
  return "#e46645";
}

export function tireTextColorClass(temp: number) {
  if (!Number.isFinite(temp) || temp <= 0) return "text-[#f5f7f6]";
  if (temp < 55) return "text-[#59a7ff]";
  if (temp < 82) return "text-[#63da97]";
  if (temp < 102) return "text-[#f3d09b]";
  return "text-[#e46645]";
}

function approximateFrontTireSteerDegrees(steerPct: number) {
  return clampNumber(steerPct, -100, 100) * 0.28;
}
